import * as React from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { BadgeCheck, Download, MailCheck, UserPlus, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/PageHeader';
import { SearchInput } from '@/components/shared/SearchInput';
import { TableSkeleton } from '@/components/shared/LoadingSkeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { MembershipBadge } from '@/components/shared/StatusBadge';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { DataPagination } from '@/components/shared/DataPagination';
import { membersApi } from '@/api/members';
import { plansApi, membershipsApi } from '@/api/memberships';
import { apiErrorMessage } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { useDebounce } from '@/hooks/useDebounce';
import { downloadBlob, formatCurrency, formatDate } from '@/lib/utils';
import type { MemberFilter } from '@/api/types';

const FILTERS: { value: MemberFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'EXPIRING_30', label: 'Expiring in 30 days' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'EXPIRED', label: 'Expired' },
];

const quickAddSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Valid email required'),
  phone: z.string().optional(),
  student_id: z.string().optional(),
  plan_id: z.coerce.number().int().positive(),
  mark_dues_paid: z.boolean(),
});
type QuickAddValues = z.infer<typeof quickAddSchema>;

function QuickAddDialog(): JSX.Element {
  const [open, setOpen] = React.useState(false);
  const queryClient = useQueryClient();
  const plans = useQuery({ queryKey: ['plans'], queryFn: () => plansApi.list() });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<QuickAddValues>({
    resolver: zodResolver(quickAddSchema),
    defaultValues: { name: '', email: '', phone: '', student_id: '', plan_id: 1, mark_dues_paid: true },
  });

  const markPaid = watch('mark_dues_paid');

  const mutation = useMutation({
    mutationFn: (values: QuickAddValues) => membersApi.quickAdd(values),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['finance'] });
      toast.success(
        `${result.user.name} added${result.membership.status === 'ACTIVE' ? ' — dues marked paid (cash)' : ' — awaiting payment'}`,
      );
      reset();
      setOpen(false);
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus /> Quick add member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quick add member</DialogTitle>
          <DialogDescription>
            For sign-ups at the campus table. The member starts with the password <span className="font-mono">skyline123</span>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="qa-name">Full name</Label>
            <Input id="qa-name" {...register('name')} placeholder="Jordan Lee" aria-invalid={Boolean(errors.name)} />
            {errors.name ? <p className="text-xs text-red-600">{errors.name.message}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qa-email">Email</Label>
            <Input id="qa-email" type="email" {...register('email')} placeholder="jordan.lee@skyline.edu" aria-invalid={Boolean(errors.email)} />
            {errors.email ? <p className="text-xs text-red-600">{errors.email.message}</p> : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="qa-phone">Phone</Label>
              <Input id="qa-phone" {...register('phone')} placeholder="+1 415 555 0199" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qa-student">Student ID</Label>
              <Input id="qa-student" {...register('student_id')} placeholder="S-2026-1300" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qa-plan">Plan</Label>
            <Select id="qa-plan" {...register('plan_id')}>
              {(plans.data ?? []).map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} — {formatCurrency(plan.price)}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border p-3">
            <div>
              <Label htmlFor="qa-paid" className="cursor-pointer">Mark dues paid (cash)</Label>
              <p className="text-xs text-muted-foreground">Activates the membership immediately and records a DUES income row.</p>
            </div>
            <Switch id="qa-paid" checked={markPaid} onCheckedChange={(checked) => setValue('mark_dues_paid', checked)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting || mutation.isPending}>
              Add member
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Members(): JSX.Element {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [filter, setFilter] = React.useState<MemberFilter>('ALL');
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const debounced = useDebounce(search);

  React.useEffect(() => setPage(1), [filter, debounced]);

  const query = useQuery({
    queryKey: ['members', filter, debounced, page],
    queryFn: () => membersApi.list({ status: filter, search: debounced || undefined, page, page_size: 12 }),
  });

  const reminders = useMutation({
    mutationFn: () => membershipsApi.sendReminders(),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(`Reminded ${result.reminded} member${result.reminded === 1 ? '' : 's'} · ${result.expired} membership${result.expired === 1 ? '' : 's'} auto-expired`);
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const markPaid = useMutation({
    mutationFn: (membershipId: number) => membershipsApi.markPaid(membershipId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['finance'] });
      toast.success('Dues recorded — membership activated');
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const exportCsv = useMutation({
    mutationFn: () => membersApi.exportCsv({ status: filter, search: debounced || undefined }),
    onSuccess: (result) => {
      downloadBlob('skyline-members.csv', result.csv);
      toast.success('Members export downloaded');
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  return (
    <>
      <PageHeader
        title="Members"
        description="Search, filter and export the membership roll. Dues payments record an income row automatically."
        actions={
          <>
            <Button variant="outline" loading={exportCsv.isPending} onClick={() => exportCsv.mutate()}>
              <Download /> Export CSV
            </Button>
            {user?.role === 'ADMIN' ? (
              <Button variant="outline" loading={reminders.isPending} onClick={() => reminders.mutate()}>
                <MailCheck /> Send renewal reminders
              </Button>
            ) : null}
            <QuickAddDialog />
          </>
        }
      />

      <Card className="mb-4">
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
          <Tabs value={filter} onValueChange={(value) => setFilter(value as MemberFilter)}>
            <TabsList className="flex-wrap">
              {FILTERS.map((item) => (
                <TabsTrigger key={item.value} value={item.value}>
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <SearchInput value={search} onChange={setSearch} placeholder="Name, email, student ID or member code…" className="lg:w-80" ariaLabel="Search members" />
        </CardContent>
      </Card>

      {query.isLoading ? (
        <TableSkeleton rows={8} columns={6} />
      ) : query.isError ? (
        <EmptyState icon={Users} title="Couldn't load members" action={<Button onClick={() => query.refetch()}>Retry</Button>} />
      ) : (query.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          icon={Users}
          title="No members match those filters"
          description="Try a different status or clear the search."
          action={
            <Button variant="outline" onClick={() => { setSearch(''); setFilter('ALL'); }}>
              Reset filters
            </Button>
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden overflow-hidden lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Dues</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(query.data?.items ?? []).map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <UserAvatar name={member.name} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{member.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{member.plan_name ?? '—'}</TableCell>
                    <TableCell>
                      <MembershipBadge status={member.membership_status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{member.end_date ? formatDate(member.end_date) : '—'}</TableCell>
                    <TableCell>
                      {member.dues_paid ? <Badge variant="success">Paid</Badge> : <Badge variant="warn">Outstanding</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {!member.dues_paid && member.membership_id ? (
                          <Button
                            size="sm"
                            variant="outline"
                            loading={markPaid.isPending && markPaid.variables === member.membership_id}
                            onClick={() => member.membership_id && markPaid.mutate(member.membership_id)}
                          >
                            <BadgeCheck /> Mark paid
                          </Button>
                        ) : null}
                        <Button size="sm" variant="ghost" asChild>
                          <Link to={`/app/members/${member.id}`}>Profile</Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile cards */}
          <div className="space-y-3 lg:hidden">
            {(query.data?.items ?? []).map((member) => (
              <Card key={member.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <UserAvatar name={member.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{member.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <MembershipBadge status={member.membership_status} />
                        <span className="text-xs text-muted-foreground">{member.plan_name ?? '—'}</span>
                        {member.end_date ? <span className="text-xs text-muted-foreground">expires {formatDate(member.end_date)}</span> : null}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    {!member.dues_paid && member.membership_id ? (
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => member.membership_id && markPaid.mutate(member.membership_id)}>
                        <BadgeCheck /> Mark paid
                      </Button>
                    ) : null}
                    <Button size="sm" variant="ghost" className="flex-1" asChild>
                      <Link to={`/app/members/${member.id}`}>View profile</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

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
    </>
  );
}
