import * as React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  DollarSign,
  GripVertical,
  HeartHandshake,
  Plus,
  Target,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { HealthBadge, PriorityBadge } from '@/components/shared/StatusBadge';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { fundraisersApi, tasksApi } from '@/api/fundraisers';
import { membersApi } from '@/api/members';
import { apiErrorMessage } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { cn, formatCurrency, formatDate, percent } from '@/lib/utils';
import type { FundraiserTask, TaskStatus } from '@/api/types';

const COLUMNS: { id: TaskStatus; title: string; accent: string }[] = [
  { id: 'TODO', title: 'To do', accent: 'bg-slate-400' },
  { id: 'IN_PROGRESS', title: 'In progress', accent: 'bg-amber-400' },
  { id: 'DONE', title: 'Done', accent: 'bg-emerald-500' },
];

type Board = Record<TaskStatus, FundraiserTask[]>;

const emptyBoard: Board = { TODO: [], IN_PROGRESS: [], DONE: [] };

function groupTasks(tasks: FundraiserTask[]): Board {
  const board: Board = { TODO: [], IN_PROGRESS: [], DONE: [] };
  tasks
    .slice()
    .sort((a, b) => a.position - b.position || a.id - b.id)
    .forEach((task) => {
      board[task.status].push(task);
    });
  return board;
}

function TaskCard({ task, dragging = false }: { task: FundraiserTask; dragging?: boolean }): JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group rounded-xl border border-border bg-card p-3 shadow-sm',
        (isDragging || dragging) && 'opacity-60 ring-2 ring-primary',
      )}
      {...attributes}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="mt-0.5 cursor-grab touch-none rounded p-0.5 text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary"
          aria-label={`Drag ${task.title}`}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug">{task.title}</p>
          {task.description ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{task.description}</p> : null}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <PriorityBadge priority={task.priority} />
            {task.due_date ? (
              <span className={cn('flex items-center gap-1 text-[11px]', task.is_overdue ? 'font-semibold text-red-600' : 'text-muted-foreground')}>
                <CalendarClock className="size-3" /> {formatDate(task.due_date, 'MMM d')}
                {task.is_overdue ? ' · overdue' : ''}
              </span>
            ) : null}
          </div>
        </div>
        {task.assignee_name ? <UserAvatar name={task.assignee_name} className="size-7" /> : (
          <span className="grid size-7 place-items-center rounded-full border border-dashed border-border text-[10px] text-muted-foreground" title="Unassigned">
            ?
          </span>
        )}
      </div>
    </div>
  );
}

function Column({ id, title, accent, tasks }: { id: TaskStatus; title: string; accent: string; tasks: FundraiserTask[] }): JSX.Element {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div className={cn('flex min-h-[300px] flex-col rounded-2xl border border-border bg-muted/40 p-3', isOver && 'border-primary/50 bg-primary/5')} ref={setNodeRef}>
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <span className={cn('size-2 rounded-full', accent)} /> {title}
        </p>
        <Badge variant="secondary">{tasks.length}</Badge>
      </div>
      <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-1 flex-col gap-2">
          {tasks.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
              Drop a task here
            </p>
          ) : (
            tasks.map((task) => <TaskCard key={task.id} task={task} />)
          )}
        </div>
      </SortableContext>
    </div>
  );
}

const taskSchema = z.object({
  title: z.string().min(3, 'Give the task a title'),
  description: z.string().optional(),
  assignee_id: z.string().optional(),
  due_date: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE']),
});
type TaskValues = z.infer<typeof taskSchema>;

function AddTaskDialog({ fundraiserId }: { fundraiserId: number }): JSX.Element {
  const [open, setOpen] = React.useState(false);
  const queryClient = useQueryClient();
  const people = useQuery({ queryKey: ['members', 'assignees'], queryFn: () => membersApi.list({ page: 1, page_size: 100 }), enabled: open });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TaskValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: { title: '', description: '', assignee_id: '', due_date: '', priority: 'MEDIUM', status: 'TODO' },
  });

  const mutation = useMutation({
    mutationFn: (values: TaskValues) =>
      fundraisersApi.addTask(fundraiserId, {
        title: values.title,
        description: values.description,
        assignee_id: values.assignee_id ? Number(values.assignee_id) : null,
        due_date: values.due_date ? new Date(values.due_date).toISOString() : null,
        priority: values.priority,
        status: values.status,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fundraiser', fundraiserId] });
      queryClient.invalidateQueries({ queryKey: ['fundraisers'] });
      queryClient.invalidateQueries({ queryKey: ['tasks', 'mine'] });
      toast.success('Task added');
      reset();
      setOpen(false);
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus /> Add task
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a task</DialogTitle>
          <DialogDescription>Tasks show up on the Kanban board and in the assignee's task list.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="t-title">Title</Label>
            <Input id="t-title" {...register('title')} placeholder="Buy baking supplies" aria-invalid={Boolean(errors.title)} />
            {errors.title ? <p className="text-xs text-red-600">{errors.title.message}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-desc">Details</Label>
            <Textarea id="t-desc" rows={3} {...register('description')} placeholder="What does done look like?" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="t-assignee">Assignee</Label>
              <Select id="t-assignee" {...register('assignee_id')} options={[{ value: '', label: 'Unassigned' }, ...(people.data?.items ?? []).map((m) => ({ value: String(m.id), label: m.name }))]} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-due">Due date</Label>
              <Input id="t-due" type="date" {...register('due_date')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-priority">Priority</Label>
              <Select
                id="t-priority"
                {...register('priority')}
                options={[
                  { value: 'LOW', label: 'Low' },
                  { value: 'MEDIUM', label: 'Medium' },
                  { value: 'HIGH', label: 'High' },
                ]}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-status">Column</Label>
              <Select
                id="t-status"
                {...register('status')}
                options={[
                  { value: 'TODO', label: 'To do' },
                  { value: 'IN_PROGRESS', label: 'In progress' },
                  { value: 'DONE', label: 'Done' },
                ]}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              Add task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RecordIncomeDialog({ fundraiserId, title }: { fundraiserId: number; title: string }): JSX.Element {
  const [open, setOpen] = React.useState(false);
  const [amount, setAmount] = React.useState('50');
  const [description, setDescription] = React.useState('');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      fundraisersApi.recordIncome(fundraiserId, {
        amount: Number(amount),
        description: description || `Fundraiser income — ${title}`,
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['fundraiser', fundraiserId] });
      queryClient.invalidateQueries({ queryKey: ['fundraisers'] });
      queryClient.invalidateQueries({ queryKey: ['finance'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(`Recorded ${formatCurrency(result.fundraiser.raised_amount)} raised in total`);
      setOpen(false);
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="accent">
          <DollarSign /> Record income
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Record fundraiser income</DialogTitle>
          <DialogDescription>Adds to the raised amount and creates an INCOME / FUNDRAISER row in the ledger.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="i-amount">Amount ($)</Label>
            <Input id="i-amount" type="number" min={1} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="i-desc">Description</Label>
            <Input id="i-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Cash box total — Friday shift" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button loading={mutation.isPending} onClick={() => mutation.mutate()}>
            Record income
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function FundraiserDetail(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const fundraiserId = Number(id);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'TREASURER' || user?.role === 'VOLUNTEER';

  const query = useQuery({ queryKey: ['fundraiser', fundraiserId], queryFn: () => fundraisersApi.detail(fundraiserId), enabled: Number.isFinite(fundraiserId) });

  const [board, setBoard] = React.useState<Board>(emptyBoard);
  const [activeTask, setActiveTask] = React.useState<FundraiserTask | null>(null);
  const dragSnapshot = React.useRef<Board | null>(null);

  React.useEffect(() => {
    if (query.data) setBoard(groupTasks(query.data.tasks));
  }, [query.data]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const save = useMutation({
    mutationFn: (payload: { id: number; status: TaskStatus; position: number }) =>
      tasksApi.update(payload.id, { status: payload.status, position: payload.position }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fundraiser', fundraiserId] });
      queryClient.invalidateQueries({ queryKey: ['fundraisers'] });
      queryClient.invalidateQueries({ queryKey: ['tasks', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error) => {
      toast.error(apiErrorMessage(error));
      if (dragSnapshot.current) setBoard(dragSnapshot.current);
    },
  });

  const columnOf = (taskId: number): TaskStatus | undefined =>
    (Object.keys(board) as TaskStatus[]).find((status) => board[status].some((task) => task.id === taskId));

  const onDragStart = (event: DragStartEvent): void => {
    dragSnapshot.current = board;
    const task = Object.values(board).flat().find((t) => t.id === Number(event.active.id));
    setActiveTask(task ?? null);
  };

  const onDragOver = (event: DragOverEvent): void => {
    const { active, over } = event;
    if (!over) return;
    const activeId = Number(active.id);
    const from = columnOf(activeId);
    if (!from) return;

    const overId = String(over.id);
    const to: TaskStatus | undefined = (['TODO', 'IN_PROGRESS', 'DONE'] as TaskStatus[]).includes(overId as TaskStatus)
      ? (overId as TaskStatus)
      : columnOf(Number(overId));
    if (!to || to === from) return;

    setBoard((prev) => {
      const task = prev[from].find((t) => t.id === activeId);
      if (!task) return prev;
      const target = prev[to];
      const overIndex = target.findIndex((t) => String(t.id) === overId);
      const insertAt = overIndex >= 0 ? overIndex : target.length;
      return {
        ...prev,
        [from]: prev[from].filter((t) => t.id !== activeId),
        [to]: [...target.slice(0, insertAt), { ...task, status: to }, ...target.slice(insertAt)],
      } as Board;
    });
  };

  const onDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event;
    setActiveTask(null);
    if (!over) {
      if (dragSnapshot.current) setBoard(dragSnapshot.current);
      return;
    }
    const activeId = Number(active.id);
    const column = columnOf(activeId);
    if (!column) return;

    const overId = String(over.id);
    let targetColumn: TaskStatus = column;
    let index = board[column].findIndex((t) => t.id === activeId);

    if ((['TODO', 'IN_PROGRESS', 'DONE'] as TaskStatus[]).includes(overId as TaskStatus)) {
      targetColumn = overId as TaskStatus;
      index = board[targetColumn].length - 1;
    } else {
      const overIdNum = Number(overId);
      const overColumn = columnOf(overIdNum);
      if (overColumn) targetColumn = overColumn;
      const overIndex = board[targetColumn].findIndex((t) => t.id === overIdNum);
      if (overIndex >= 0) index = overIndex;
    }

    // Re-order locally so the UI is instant, then persist status + position.
    setBoard((prev) => {
      const list = prev[targetColumn].filter((t) => t.id !== activeId);
      const task = prev[column].find((t) => t.id === activeId) ?? prev[targetColumn].find((t) => t.id === activeId);
      if (!task) return prev;
      const moved = { ...task, status: targetColumn };
      list.splice(Math.max(0, Math.min(index, list.length)), 0, moved);
      return {
        ...prev,
        [column]: prev[column].filter((t) => t.id !== activeId),
        [targetColumn]: list,
      } as Board;
    });

    save.mutate({ id: activeId, status: targetColumn, position: Math.max(0, index) });
  };

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-80 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (query.isError || !query.data) {
    return <EmptyState icon={HeartHandshake} title="Fundraiser not found" action={<Button asChild><Link to="/app/fundraisers">Back to fundraisers</Link></Button>} />;
  }

  const fundraiser = query.data;
  const progress = fundraiser.progress;
  const overdue = fundraiser.tasks.filter((task) => task.is_overdue);

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-3">
        <Link to="/app/fundraisers">
          <ArrowLeft /> All fundraisers
        </Link>
      </Button>

      <PageHeader
        title={fundraiser.title}
        description={`${formatDate(fundraiser.event_date, 'EEEE, MMM d, yyyy')} · ${fundraiser.description}`}
        actions={
          <>
            <HealthBadge health={progress.health} />
            <AddTaskDialog fundraiserId={fundraiser.id} />
            <RecordIncomeDialog fundraiserId={fundraiser.id} title={fundraiser.title} />
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Target className="size-4 text-primary" /> Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Tasks complete</span>
                <span className="text-muted-foreground">
                  {progress.tasks_done} / {progress.tasks_total} ({progress.pct_done}%)
                </span>
              </div>
              <Progress className="mt-2" value={progress.pct_done} max={100} tone={progress.health === 'AT_RISK' ? 'danger' : 'primary'} />
            </div>

            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Money raised</span>
                <span className="text-muted-foreground">
                  {formatCurrency(fundraiser.raised_amount)} of {formatCurrency(fundraiser.goal_amount)} ({progress.raised_pct}%)
                </span>
              </div>
              <Progress className="mt-2" value={progress.raised_pct} max={100} tone="accent" />
            </div>

            <Separator />

            <div>
              <p className="flex items-center gap-2 text-sm font-medium">
                <AlertTriangle className={cn('size-4', overdue.length ? 'text-red-600' : 'text-muted-foreground')} />
                Overdue tasks ({overdue.length})
              </p>
              {overdue.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Nothing is overdue — the board is on track.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {overdue.map((task) => (
                    <li key={task.id} className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-2.5 text-sm dark:border-red-500/30 dark:bg-red-500/10">
                      <span className="truncate">{task.title}</span>
                      <span className="shrink-0 text-xs font-medium text-red-700 dark:text-red-300">due {formatDate(task.due_date, 'MMM d')}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="size-4 text-primary" /> Team
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from(new Set(fundraiser.tasks.map((task) => task.assignee_name ?? 'Unassigned'))).map((name) => {
              const count = fundraiser.tasks.filter((task) => (task.assignee_name ?? 'Unassigned') === name).length;
              const done = fundraiser.tasks.filter((task) => (task.assignee_name ?? 'Unassigned') === name && task.status === 'DONE').length;
              return (
                <div key={name} className="flex items-center gap-3">
                  {name === 'Unassigned' ? (
                    <span className="grid size-8 place-items-center rounded-full border border-dashed border-border text-xs text-muted-foreground">?</span>
                  ) : (
                    <UserAvatar name={name} className="size-8" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{name}</p>
                    <p className="text-xs text-muted-foreground">
                      {done}/{count} done ({percent(done, count)}%)
                    </p>
                  </div>
                </div>
              );
            })}
            <p className="border-t border-border pt-3 text-xs text-muted-foreground">
              Drag cards between columns — status and order are saved to the server immediately.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>
          <div className="grid gap-4 md:grid-cols-3">
            {COLUMNS.map((column) => (
              <div key={column.id} className="min-w-0">
                <Column id={column.id} title={column.title} accent={column.accent} tasks={board[column.id]} />
              </div>
            ))}
          </div>
          <DragOverlay>{activeTask ? <TaskCard task={activeTask} dragging /> : null}</DragOverlay>
        </DndContext>
        {!canManage ? <p className="mt-3 text-xs text-muted-foreground">You have read-only access to this board.</p> : null}
      </div>
    </>
  );
}
