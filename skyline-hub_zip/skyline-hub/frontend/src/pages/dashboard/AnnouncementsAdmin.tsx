import * as React from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Megaphone, PenLine, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/shared/PageHeader';
import { TableSkeleton } from '@/components/shared/LoadingSkeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { CategoryBadge } from '@/components/shared/StatusBadge';
import { DataPagination } from '@/components/shared/DataPagination';
import { announcementsApi } from '@/api/announcements';
import { apiErrorMessage } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { formatDateTime } from '@/lib/utils';
import type { AnnouncementCategory } from '@/api/types';

export default function AnnouncementsAdmin(): JSX.Element {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [category, setCategory] = React.useState<AnnouncementCategory | 'ALL'>('ALL');
  const [page, setPage] = React.useState(1);

  const query = useQuery({
    queryKey: ['announcements', 'admin', category, page],
    queryFn: () => announcementsApi.list({ category, page, page_size: 12 }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => announcementsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      toast.success('Announcement deleted');
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  return (
    <>
      <PageHeader
        title="Announcements"
        description="Who posted what, when, and how many people it went out to."
        actions={
          <>
            <Select
              aria-label="Filter by category"
              className="w-44"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value as AnnouncementCategory | 'ALL');
                setPage(1);
              }}
              options={[
                { value: 'ALL', label: 'All categories' },
                { value: 'MEETING', label: 'Meeting' },
                { value: 'DEADLINE', label: 'Deadline' },
                { value: 'CHANGE_OF_PLAN', label: 'Change of plan' },
                { value: 'GENERAL', label: 'General' },
              ]}
            />
            <Button asChild>
              <Link to="/app/announcements/new">
                <PenLine /> New announcement
              </Link>
            </Button>
          </>
        }
      />

      {query.isLoading ? (
        <TableSkeleton rows={6} columns={5} />
      ) : (query.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No announcements yet"
          description="Post meeting reminders, deadlines and changes of plan. Optionally email everyone at once."
          action={
            <Button asChild>
              <Link to="/app/announcements/new">Write the first one</Link>
            </Button>
          }
        />
      ) : (
        <>
          <Card className="hidden overflow-hidden lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead>Emailed</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(query.data?.items ?? []).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="max-w-sm">
                      <p className="truncate font-medium">{item.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{item.body.slice(0, 90)}…</p>
                    </TableCell>
                    <TableCell><CategoryBadge category={item.category} /></TableCell>
                    <TableCell className="text-sm">{item.author_name ?? 'Admin'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDateTime(item.published_at)}</TableCell>
                    <TableCell>
                      {item.email_sent ? (
                        <Badge variant="success">{item.recipient_count} recipients</Badge>
                      ) : (
                        <Badge variant="secondary">Not emailed</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {user?.role === 'ADMIN' ? (
                        <ConfirmDialog
                          trigger={
                            <Button size="sm" variant="ghost" aria-label={`Delete ${item.title}`}>
                              <Trash2 />
                            </Button>
                          }
                          title="Delete this announcement?"
                          description="It disappears from the public archive. Email logs stay intact."
                          confirmLabel="Delete"
                          destructive
                          loading={remove.isPending}
                          onConfirm={() => remove.mutate(item.id)}
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <div className="space-y-3 lg:hidden">
            {(query.data?.items ?? []).map((item) => (
              <Card key={item.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{item.title}</p>
                  <CategoryBadge category={item.category} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.author_name ?? 'Admin'} · {formatDateTime(item.published_at)}
                </p>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{item.body}</p>
                {item.email_sent ? <Badge variant="success" className="mt-2">{item.recipient_count} recipients</Badge> : null}
              </Card>
            ))}
          </div>

          {query.data ? (
            <DataPagination page={query.data.page} pages={query.data.pages} total={query.data.total} pageSize={query.data.page_size} onPageChange={setPage} />
          ) : null}
        </>
      )}
    </>
  );
}
