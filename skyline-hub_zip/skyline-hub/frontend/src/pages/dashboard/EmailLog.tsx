import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Mail, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/shared/PageHeader';
import { SearchInput } from '@/components/shared/SearchInput';
import { TableSkeleton } from '@/components/shared/LoadingSkeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { DataPagination } from '@/components/shared/DataPagination';
import { Markdown } from '@/components/shared/Markdown';
import { emailsApi } from '@/api/emails';
import { USE_MOCKS } from '@/api/client';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDateTime } from '@/lib/utils';
import type { EmailLog as EmailLogRow } from '@/api/types';

export default function EmailLog(): JSX.Element {
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [selected, setSelected] = React.useState<EmailLogRow | null>(null);
  const debounced = useDebounce(search);

  React.useEffect(() => setPage(1), [debounced]);

  const query = useQuery({
    queryKey: ['emails', debounced, page],
    queryFn: () => emailsApi.list({ search: debounced || undefined, page, page_size: 25 }),
  });

  return (
    <>
      <PageHeader
        title="Email log"
        description="Every email the system 'sent'. Without SMTP credentials, messages are logged here instead of being delivered."
      />

      {USE_MOCKS ? (
        <Card className="mb-4 border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10">
          <CardContent className="p-4 text-sm">
            <span className="font-medium">SMTP is not configured.</span>{' '}
            <span className="text-muted-foreground">
              Announcement, ticket and membership emails are recorded in this table so nothing is lost — the real backend prints them to
              the console as well.
            </span>
          </CardContent>
        </Card>
      ) : null}

      <div className="mb-4 max-w-sm">
        <SearchInput value={search} onChange={setSearch} placeholder="Search recipient or subject…" ariaLabel="Search emails" />
      </div>

      {query.isLoading ? (
        <TableSkeleton rows={8} columns={4} />
      ) : (query.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          icon={search ? Search : Mail}
          title={search ? 'No emails match that search' : 'No emails sent yet'}
          description={search ? 'Try a different recipient or subject.' : 'Post an announcement with email enabled and they will show up here.'}
          action={search ? <Button variant="outline" onClick={() => setSearch('')}>Clear search</Button> : undefined}
        />
      ) : (
        <>
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>To</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Related</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(query.data?.items ?? []).map((log) => (
                  <TableRow key={log.id} className="cursor-pointer" onClick={() => setSelected(log)}>
                    <TableCell className="text-sm">{log.to_email}</TableCell>
                    <TableCell className="max-w-xs">
                      <p className="truncate text-sm font-medium">{log.subject}</p>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {log.related_type ? `${log.related_type}#${log.related_id ?? ''}` : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDateTime(log.sent_at)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary">{log.status.toLowerCase()}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          {query.data ? (
            <DataPagination page={query.data.page} pages={query.data.pages} total={query.data.total} pageSize={query.data.page_size} onPageChange={setPage} />
          ) : null}
        </>
      )}

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selected?.subject}</DialogTitle>
            <DialogDescription>
              To {selected?.to_email} · {selected ? formatDateTime(selected.sent_at) : ''}
              {selected?.related_type ? ` · ${selected.related_type}#${selected.related_id ?? ''}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-border p-4">
            <Markdown content={selected?.body ?? ''} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
