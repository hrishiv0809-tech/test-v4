import * as React from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarClock, CheckCircle2, ListChecks, PlayCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { ListSkeleton } from '@/components/shared/LoadingSkeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { PriorityBadge } from '@/components/shared/StatusBadge';
import { tasksApi } from '@/api/fundraisers';
import { apiErrorMessage } from '@/api/client';
import { cn, formatDate } from '@/lib/utils';
import type { FundraiserTask, TaskStatus } from '@/api/types';

type Group = { key: string; title: string; tone: string; tasks: FundraiserTask[] };

function groupTasks(tasks: FundraiserTask[]): Group[] {
  const now = Date.now();
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const done = tasks.filter((task) => task.status === 'DONE');
  const open = tasks.filter((task) => task.status !== 'DONE');
  const overdue = open.filter((task) => task.due_date && new Date(task.due_date).getTime() < now);
  const today = open.filter((task) => !overdue.includes(task) && task.due_date && new Date(task.due_date).getTime() <= endOfToday.getTime());
  const upcoming = open.filter((task) => !overdue.includes(task) && !today.includes(task));

  return [
    { key: 'overdue', title: 'Overdue', tone: 'text-red-600', tasks: overdue },
    { key: 'today', title: 'Due today', tone: 'text-amber-600', tasks: today },
    { key: 'upcoming', title: 'Upcoming', tone: 'text-foreground', tasks: upcoming },
    { key: 'done', title: 'Completed', tone: 'text-muted-foreground', tasks: done },
  ];
}

export default function MyTasks(): JSX.Element {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['tasks', 'mine'], queryFn: () => tasksApi.mine() });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: TaskStatus }) => tasksApi.update(id, { status }),
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['fundraisers'] });
      queryClient.invalidateQueries({ queryKey: ['fundraiser'] });
      toast.success(`Task marked ${task.status.replace('_', ' ').toLowerCase()}`);
    },
    onError: (error) => toast.error(error instanceof Error ? apiErrorMessage(error) : 'Could not update the task'),
  });

  const groups = React.useMemo(() => groupTasks(query.data ?? []), [query.data]);
  const openCount = (query.data ?? []).filter((task) => task.status !== 'DONE').length;

  return (
    <>
      <PageHeader
        title="My tasks"
        description={`${openCount} open task${openCount === 1 ? '' : 's'} assigned to you across all fundraisers.`}
      />

      {query.isLoading ? (
        <ListSkeleton rows={5} />
      ) : (query.data ?? []).length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="Nothing assigned to you"
          description="When a board member assigns you a task on a fundraiser board, it appears here."
          action={
            <Button asChild>
              <Link to="/app/fundraisers">Browse fundraisers</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {groups
            .filter((group) => group.tasks.length > 0)
            .map((group) => (
              <section key={group.key}>
                <h2 className={cn('mb-3 flex items-center gap-2 text-sm font-semibold', group.tone)}>
                  {group.title}
                  <Badge variant="secondary">{group.tasks.length}</Badge>
                </h2>
                <div className="space-y-3">
                  {group.tasks.map((task) => (
                    <Card key={task.id}>
                      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="font-medium">{task.title}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            <Link className="text-primary hover:underline" to={`/app/fundraisers/${task.fundraiser_id}`}>
                              {task.fundraiser_title}
                            </Link>
                            {task.due_date ? (
                              <span className={cn('ml-2 inline-flex items-center gap-1', task.is_overdue && 'font-semibold text-red-600')}>
                                <CalendarClock className="size-3" /> due {formatDate(task.due_date, 'MMM d')}
                              </span>
                            ) : null}
                          </p>
                          {task.description ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{task.description}</p> : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <PriorityBadge priority={task.priority} />
                          {task.status === 'TODO' ? (
                            <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: task.id, status: 'IN_PROGRESS' })}>
                              <PlayCircle /> Start
                            </Button>
                          ) : null}
                          {task.status !== 'DONE' ? (
                            <Button size="sm" onClick={() => setStatus.mutate({ id: task.id, status: 'DONE' })}>
                              <CheckCircle2 /> Done
                            </Button>
                          ) : (
                            <Badge variant="success">Completed</Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            ))}
        </div>
      )}
    </>
  );
}
