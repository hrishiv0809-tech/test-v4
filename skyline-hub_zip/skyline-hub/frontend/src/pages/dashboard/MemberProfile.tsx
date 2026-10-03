import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, BadgeCheck, Mail, Receipt, ShoppingBag, Ticket, UserCog } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { MembershipBadge, OrderBadge } from '@/components/shared/StatusBadge';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { membersApi } from '@/api/members';
import { membershipsApi } from '@/api/memberships';
import { apiErrorMessage } from '@/api/client';
import { daysUntil, formatCurrency, formatDate } from '@/lib/utils';

export default function MemberProfile(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const memberId = Number(id);
  const queryClient = useQueryClient();

  const query = useQuery({ queryKey: ['member', memberId], queryFn: () => membersApi.detail(memberId), enabled: Number.isFinite(memberId) });

  const markPaid = useMutation({
    mutationFn: (membershipId: number) => membershipsApi.markPaid(membershipId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member', memberId] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['finance'] });
      toast.success('Dues recorded — membership is now active');
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const remind = useMutation({
    mutationFn: () => membershipsApi.sendReminders(),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      toast.success(`Reminder run complete — ${result.reminded} member(s) emailed (logged in the Email log)`);
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return <EmptyState icon={UserCog} title="Member not found" action={<Button asChild><Link to="/app/members">Back to members</Link></Button>} />;
  }

  const { user, membership, plan, tickets, orders, totals } = query.data;
  const daysLeft = membership?.end_date ? daysUntil(membership.end_date) : 0;

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-3">
        <Link to="/app/members">
          <ArrowLeft /> All members
        </Link>
      </Button>

      <PageHeader
        title={user.name}
        description={`${user.email}${user.student_id ? ` · ${user.student_id}` : ''}`}
        actions={
          <>
            <Button variant="outline" loading={remind.isPending} onClick={() => remind.mutate()}>
              <Mail /> Send renewal reminders
            </Button>
            {membership && !membership.dues_paid ? (
              <Button loading={markPaid.isPending} onClick={() => markPaid.mutate(membership.id)}>
                <BadgeCheck /> Mark dues paid (cash)
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardContent className="flex flex-wrap items-center gap-4 p-5">
              <UserAvatar name={user.name} className="size-14 text-base" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-lg font-semibold">
                  {user.name} <MembershipBadge status={membership?.status ?? 'NONE'} />
                  {membership?.dues_paid ? <Badge variant="success">Dues paid</Badge> : <Badge variant="warn">Dues outstanding</Badge>}
                </p>
                <p className="text-sm text-muted-foreground">
                  {plan?.name ?? 'No plan'} · joined {formatDate(user.created_at)}
                  {membership?.end_date ? ` · valid until ${formatDate(membership.end_date)}${membership.status === 'ACTIVE' ? ` (${daysLeft} days)` : ''}` : ''}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Ticket className="size-4 text-primary" /> Ticket history
                <Badge variant="secondary">{tickets.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tickets.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tickets purchased yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tickets.map((ticket) => (
                      <TableRow key={ticket.id}>
                        <TableCell className="text-sm">{ticket.event_title}</TableCell>
                        <TableCell className="font-mono text-xs">{ticket.ticket_code}</TableCell>
                        <TableCell>
                          <Badge variant={ticket.status === 'CHECKED_IN' ? 'success' : ticket.status === 'CANCELLED' ? 'danger' : 'default'}>
                            {ticket.status.replace('_', ' ').toLowerCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(ticket.price_paid)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <ShoppingBag className="size-4 text-primary" /> Order history
                <Badge variant="secondary">{orders.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <p className="text-sm text-muted-foreground">No merch orders yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="text-sm">#{order.id}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {order.items.map((item) => `${item.product_name} (${item.size}) ×${item.quantity}`).join(', ')}
                        </TableCell>
                        <TableCell><OrderBadge status={order.status} /></TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(order.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Receipt className="size-4 text-primary" /> Spend with the association
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Tickets</span>
                <span className="font-medium">{formatCurrency(totals.spent_on_tickets)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Merch</span>
                <span className="font-medium">{formatCurrency(totals.spent_on_merch)}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between text-base font-semibold">
                <span>Total</span>
                <span>{formatCurrency(totals.spent_on_tickets + totals.spent_on_merch)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Plan & discounts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {plan ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="default">{plan.ticket_discount_percent}% off tickets</Badge>
                    <Badge variant="accent">{plan.merch_discount_percent}% off merch</Badge>
                    <Badge variant="secondary">{formatCurrency(membership?.amount_paid ?? 0)} paid</Badge>
                  </div>
                  <ul className="space-y-1.5 text-sm text-muted-foreground">
                    {plan.benefits.map((benefit) => (
                      <li key={benefit}>• {benefit}</li>
                    ))}
                  </ul>
                  {membership?.member_code ? (
                    <p className="rounded-xl bg-muted/60 p-3 font-mono text-xs">Member code: {membership.member_code}</p>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">This member has no plan attached.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
