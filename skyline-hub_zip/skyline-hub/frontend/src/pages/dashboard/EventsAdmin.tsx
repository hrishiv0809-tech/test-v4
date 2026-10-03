import * as React from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BarChart3, CalendarDays, CalendarPlus, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/shared/PageHeader';
import { TableSkeleton } from '@/components/shared/LoadingSkeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { DataPagination } from '@/components/shared/DataPagination';
import { eventsApi } from '@/api/events';
import { apiErrorMessage } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency, formatDateTime, percent } from '@/lib/utils';
import type { EventStatus } from '@/api/types';

const STATUS_VARIANT: Record<EventStatus, 'success' | 'warn' | 'secondary' | 'danger'> = {
  PUBLISHED: 'success',
  DRAFT: 'warn',
  COMPLETED: 'secondary',
  CANCELLED: 'danger',
};

export default function EventsAdmin(): JSX.Element {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [status, setStatus] = React.useState<EventStatus | 'ALL'>('ALL');
  const [page, setPage] = React.useState(1);

  const query = useQuery({
    queryKey: ['events', 'admin', status, page],
    queryFn: () => eventsApi.list({ status, page, page_size: 12 }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => eventsApi.remove(id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success(result.cancelled ? `Event cancelled — it had ${result.tickets_sold} ticket(s) sold` : 'Event deleted');
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const changeStatus = useMutation({
    mutationFn: ({ id, next }: { id: number; next: EventStatus }) => eventsApi.update(id, { status: next }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Event updated');
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  return (
    <>
      <PageHeader
        title="Events"
        description="Create events, watch capacity fill up and open the report for any event's numbers."
        actions={
          <>
            <Select
              aria-label="Filter by status"
              className="w-40"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as EventStatus | 'ALL');
                setPage(1);
              }}
              options={[
                { value: 'ALL', label: 'All statuses' },
                { value: 'PUBLISHED', label: 'Published' },
                { value: 'DRAFT', label: 'Draft' },
                { value: 'COMPLETED', label: 'Completed' },
                { value: 'CANCELLED', label: 'Cancelled' },
              ]}
            />
            <Button asChild>
              <Link to="/app/events/new">
                <CalendarPlus /> New event
              </Link>
            </Button>
          </>
        }
      />

      {query.isLoading ? (
        <TableSkeleton rows={6} columns={6} />
      ) : (query.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No events yet"
          description="Publish your first event and tickets go on sale immediately."
          action={
            <Button asChild>
              <Link to="/app/events/new">Create an event</Link>
            </Button>
          }
        />
      ) : (
        <>
          <Card className="hidden overflow-hidden lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sold</TableHead>
                  <TableHead>Prices</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(query.data?.items ?? []).map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>
                      <p className="font-medium">{event.title}</p>
                      <p className="text-xs text-muted-foreground">{event.location}</p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDateTime(event.start_date)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[event.status]}>{event.status.toLowerCase()}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {event.sold} / {event.capacity}
                      <span className="ml-1 text-xs text-muted-foreground">({percent(event.sold, event.capacity)}%)</span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatCurrency(event.member_price)} <span className="text-muted-foreground">/ {formatCurrency(event.non_member_price)}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" asChild>
                          <Link to={`/app/events/${event.id}/report`}>
                            <BarChart3 /> Report
                          </Link>
                        </Button>
                        <Button size="sm" variant="outline" asChild>
                          <Link to={`/app/events/${event.id}/edit`}>
                            <Pencil /> Edit
                          </Link>
                        </Button>
                        {user?.role === 'ADMIN' ? (
                          <ConfirmDialog
                            trigger={
                              <Button size="sm" variant="ghost" aria-label={`Delete ${event.title}`}>
                                <Trash2 />
                              </Button>
                            }
                            title="Delete this event?"
                            description={
                              event.sold > 0
                                ? `This event has ${event.sold} tickets sold, so it will be marked CANCELLED instead of deleted.`
                                : 'This permanently removes the event. This cannot be undone.'
                            }
                            confirmLabel="Yes, remove it"
                            destructive
                            loading={remove.isPending}
                            onConfirm={() => remove.mutate(event.id)}
                          />
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <div className="space-y-3 lg:hidden">
            {(query.data?.items ?? []).map((event) => (
              <Card key={event.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{event.title}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(event.start_date)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {event.sold}/{event.capacity} sold · {formatCurrency(event.member_price)} members
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANT[event.status]}>{event.status.toLowerCase()}</Badge>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" asChild>
                    <Link to={`/app/events/${event.id}/edit`}>Edit</Link>
                  </Button>
                  <Button size="sm" variant="ghost" className="flex-1" asChild>
                    <Link to={`/app/events/${event.id}/report`}>Report</Link>
                  </Button>
                  {event.status === 'DRAFT' ? (
                    <Button size="sm" className="flex-1" onClick={() => changeStatus.mutate({ id: event.id, next: 'PUBLISHED' })}>
                      Publish
                    </Button>
                  ) : null}
                </div>
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
