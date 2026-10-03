import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { CategoryBadge } from '@/components/shared/StatusBadge';
import { Markdown } from '@/components/shared/Markdown';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { DataPagination } from '@/components/shared/DataPagination';
import { announcementsApi } from '@/api/announcements';
import { cn, formatDateTime } from '@/lib/utils';
import type { AnnouncementCategory } from '@/api/types';

const FILTERS: { value: AnnouncementCategory | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'MEETING', label: 'Meetings' },
  { value: 'DEADLINE', label: 'Deadlines' },
  { value: 'CHANGE_OF_PLAN', label: 'Changes of plan' },
  { value: 'GENERAL', label: 'General' },
];

export default function Announcements(): JSX.Element {
  const [category, setCategory] = React.useState<AnnouncementCategory | 'ALL'>('ALL');
  const [page, setPage] = React.useState(1);
  React.useEffect(() => setPage(1), [category]);

  const query = useQuery({
    queryKey: ['announcements', 'public', category, page],
    queryFn: () => announcementsApi.list({ category, page, page_size: 10 }),
  });

  const items = query.data?.items ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <PageHeader
        title="Announcements"
        description="The permanent archive — every post from the board, with the exact date and time it went out."
      />

      <div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="Filter by category">
        {FILTERS.map((filter) => (
          <Button
            key={filter.value}
            role="tab"
            aria-selected={category === filter.value}
            variant={category === filter.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCategory(filter.value)}
            className={cn(category !== filter.value && 'bg-card')}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      {query.isLoading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="p-6">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-3 h-6 w-2/3" />
              <Skeleton className="mt-4 h-16 w-full" />
            </Card>
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={Megaphone} title="Nothing posted here yet" description="Announcements in this category will appear here." />
      ) : (
        <>
          <ol className="space-y-4">
            {items.map((item) => (
              <li key={item.id}>
                <Card className="p-6">
                  <article>
                    <div className="flex flex-wrap items-center gap-3">
                      <CategoryBadge category={item.category} />
                      <time className="text-xs text-muted-foreground" dateTime={item.published_at}>
                        {formatDateTime(item.published_at)}
                      </time>
                      {item.email_sent ? (
                        <span className="text-xs text-muted-foreground">· emailed to {item.recipient_count}</span>
                      ) : null}
                    </div>
                    <h2 className="mt-3 text-xl font-semibold">{item.title}</h2>
                    <Markdown content={item.body} className="mt-3" />
                    <div className="mt-4 flex items-center gap-2 border-t border-border pt-4">
                      <UserAvatar name={item.author_name ?? 'Admin'} className="size-7" />
                      <p className="text-xs text-muted-foreground">
                        Posted by <span className="font-medium text-foreground">{item.author_name ?? 'Board'}</span>
                      </p>
                    </div>
                  </article>
                </Card>
              </li>
            ))}
          </ol>
          {query.data ? (
            <DataPagination
              page={query.data.page}
              pages={query.data.pages}
              total={query.data.total}
              pageSize={query.data.page_size}
              onPageChange={setPage}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
