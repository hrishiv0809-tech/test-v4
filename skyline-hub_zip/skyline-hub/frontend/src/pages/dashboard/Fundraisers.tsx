import * as React from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { CalendarDays, HeartHandshake, Plus, Target } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { HealthBadge } from '@/components/shared/StatusBadge';
import { fundraisersApi } from '@/api/fundraisers';
import { apiErrorMessage } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency, formatDate } from '@/lib/utils';

const schema = z.object({
  title: z.string().min(3, 'Give the fundraiser a title'),
  description: z.string().optional(),
  goal_amount: z.coerce.number().min(1, 'Goal must be at least $1'),
  event_date: z.string().min(1, 'Pick the event date'),
  status: z.enum(['PLANNING', 'ACTIVE', 'COMPLETED']),
});
type FormValues = z.infer<typeof schema>;

function CreateFundraiserDialog(): JSX.Element {
  const [open, setOpen] = React.useState(false);
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', description: '', goal_amount: 500, event_date: '', status: 'PLANNING' },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      fundraisersApi.create({
        ...values,
        event_date: new Date(values.event_date).toISOString(),
        description: values.description ?? '',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fundraisers'] });
      toast.success('Fundraiser created — add tasks on its board');
      reset();
      setOpen(false);
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> New fundraiser
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New fundraiser</DialogTitle>
          <DialogDescription>Set a goal and a date — the board tracks tasks and money raised against it.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="f-title">Title</Label>
            <Input id="f-title" {...register('title')} placeholder="Spring Bake Sale" aria-invalid={Boolean(errors.title)} />
            {errors.title ? <p className="text-xs text-red-600">{errors.title.message}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-desc">Description</Label>
            <Textarea id="f-desc" rows={3} {...register('description')} placeholder="What are we raising money for?" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="f-goal">Goal amount ($)</Label>
              <Input id="f-goal" type="number" min={1} step="0.01" {...register('goal_amount')} aria-invalid={Boolean(errors.goal_amount)} />
              {errors.goal_amount ? <p className="text-xs text-red-600">{errors.goal_amount.message}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-date">Event date</Label>
              <Input id="f-date" type="date" {...register('event_date')} aria-invalid={Boolean(errors.event_date)} />
              {errors.event_date ? <p className="text-xs text-red-600">{errors.event_date.message}</p> : null}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-status">Status</Label>
            <Select
              id="f-status"
              {...register('status')}
              options={[
                { value: 'PLANNING', label: 'Planning' },
                { value: 'ACTIVE', label: 'Active' },
                { value: 'COMPLETED', label: 'Completed' },
              ]}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Fundraisers(): JSX.Element {
  const { user } = useAuth();
  const canCreate = user?.role === 'ADMIN' || user?.role === 'TREASURER';
  const query = useQuery({ queryKey: ['fundraisers'], queryFn: () => fundraisersApi.list() });

  return (
    <>
      <PageHeader
        title="Fundraisers"
        description="Every fundraiser, its board progress and how close it is to the goal."
        actions={canCreate ? <CreateFundraiserDialog /> : undefined}
      />

      {query.isLoading ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-56 w-full rounded-2xl" />
          ))}
        </div>
      ) : (query.data ?? []).length === 0 ? (
        <EmptyState
          icon={HeartHandshake}
          title="No fundraisers yet"
          description="Create one, then plan it out on the Kanban board with your volunteers."
          action={canCreate ? <CreateFundraiserDialog /> : undefined}
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {(query.data ?? []).map((fundraiser) => (
            <Card key={fundraiser.id} className="transition-all hover:-translate-y-0.5 hover:border-primary/40">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-start justify-between gap-3">
                  <span>{fundraiser.title}</span>
                  <HealthBadge health={fundraiser.progress.health} />
                </CardTitle>
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CalendarDays className="size-3.5" /> {formatDate(fundraiser.event_date, 'EEE, MMM d, yyyy')}
                  <Badge variant={fundraiser.status === 'ACTIVE' ? 'success' : fundraiser.status === 'COMPLETED' ? 'secondary' : 'warn'}>
                    {fundraiser.status.toLowerCase()}
                  </Badge>
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="line-clamp-2 text-sm text-muted-foreground">{fundraiser.description}</p>

                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                      <Target className="size-3.5 text-primary" /> {formatCurrency(fundraiser.raised_amount)} raised
                    </span>
                    <span className="text-muted-foreground">goal {formatCurrency(fundraiser.goal_amount)}</span>
                  </div>
                  <Progress className="mt-2" value={fundraiser.progress.raised_pct} max={100} tone="accent" />
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">Tasks</span>
                    <span className="text-muted-foreground">
                      {fundraiser.progress.tasks_done}/{fundraiser.progress.tasks_total} done
                      {fundraiser.progress.overdue_count > 0 ? ` · ${fundraiser.progress.overdue_count} overdue` : ''}
                    </span>
                  </div>
                  <Progress className="mt-2" value={fundraiser.progress.pct_done} max={100} tone={fundraiser.progress.health === 'AT_RISK' ? 'danger' : 'primary'} />
                </div>

                <Button className="w-full" variant="outline" asChild>
                  <Link to={`/app/fundraisers/${fundraiser.id}`}>Open board</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
