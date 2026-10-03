import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BadgeCheck, CheckCircle2, CreditCard, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import { MembershipBadge } from '@/components/shared/StatusBadge';
import { plansApi, membershipsApi } from '@/api/memberships';
import { apiErrorMessage } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function Membership(): JSX.Element {
  const { user } = useAuth();
  const navigate = useNavigate();
  const plans = useQuery({ queryKey: ['plans'], queryFn: () => plansApi.list() });
  const membership = useQuery({ queryKey: ['membership', 'me'], queryFn: () => membershipsApi.mine(), enabled: Boolean(user) });

  const startCheckout = useMutation({
    mutationFn: (planId: number) => membershipsApi.checkout(planId),
    onSuccess: (intent) => {
      navigate('/checkout', {
        state: {
          kind: 'MEMBERSHIP',
          membership_id: intent.membership_id,
          plan_name: intent.plan_name,
          amount_due: intent.amount_due,
        },
      });
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const current = membership.data;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <PageHeader
        title="Membership"
        description="Dues run for the full academic year. Discounts apply instantly at ticket and merch checkout."
        actions={user ? <Button variant="outline" asChild><Link to="/app/card">View my card</Link></Button> : undefined}
      />

      {user && current ? (
        <Card className="mb-8">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Your membership</p>
              <p className="mt-1 flex items-center gap-2 text-lg font-semibold">
                {current.plan?.name ?? 'Plan'} <MembershipBadge status={current.status} />
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {current.status === 'ACTIVE'
                  ? `Valid until ${formatDate(current.end_date)} · member code ${current.member_code}`
                  : current.status === 'PENDING_PAYMENT'
                    ? `Dues outstanding: ${formatCurrency(current.plan?.price ?? 0)}`
                    : `Expired on ${formatDate(current.end_date)} — renew to keep your discounts`}
              </p>
            </div>
            {current.status === 'ACTIVE' ? (
              <Button asChild>
                <Link to="/app/card"><BadgeCheck /> Show my QR card</Link>
              </Button>
            ) : (
              <Button
                loading={startCheckout.isPending}
                onClick={() => startCheckout.mutate(current.plan_id)}
              >
                <CreditCard /> Pay {formatCurrency(current.plan?.price ?? 0)} now
              </Button>
            )}
          </CardContent>
        </Card>
      ) : null}

      {plans.isLoading ? (
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {(plans.data ?? []).map((plan, index) => (
            <Card key={plan.id} className={index === 1 ? 'relative border-primary/40 shadow-lg' : ''}>
              {index === 1 ? <Badge className="absolute -top-3 left-5 bg-accent text-accent-foreground">Best value</Badge> : null}
              <CardHeader>
                <CardTitle className="flex items-baseline justify-between">
                  <span>{plan.name}</span>
                  <span className="text-3xl">{formatCurrency(plan.price)}</span>
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(Math.round((plan.price / 12) * 100) / 100)} / month · valid {plan.duration_months} months
                </p>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="default">{plan.ticket_discount_percent}% off tickets</Badge>
                  <Badge variant="accent">{plan.merch_discount_percent}% off merch</Badge>
                </div>
                <ul className="space-y-2 text-sm">
                  {plan.benefits.map((benefit) => (
                    <li key={benefit} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                      <span className="text-muted-foreground">{benefit}</span>
                    </li>
                  ))}
                </ul>
                <div className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
                  <Sparkles className="mr-1 inline size-3.5 text-primary" />
                  A {formatCurrency(plan.price)} {plan.name} pays for itself after two gala tickets.
                </div>
                {user ? (
                  <Button
                    className="w-full"
                    variant={index === 1 ? 'default' : 'outline'}
                    loading={startCheckout.isPending}
                    disabled={current?.status === 'ACTIVE'}
                    onClick={() => startCheckout.mutate(plan.id)}
                  >
                    {current?.status === 'ACTIVE' ? 'Already a member' : `Choose ${plan.name}`}
                  </Button>
                ) : (
                  <Button className="w-full" variant={index === 1 ? 'default' : 'outline'} asChild>
                    <Link to={`/signup?plan=${plan.id}`}>Join with {plan.name.split(' ')[0]}</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>What your dues pay for</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm text-muted-foreground sm:grid-cols-3">
          <p><strong className="text-foreground">Events:</strong> venue deposits, catering and the AV hire for the gala and mixers.</p>
          <p><strong className="text-foreground">Community:</strong> the volunteering trip, hack nights and workshops.</p>
          <p><strong className="text-foreground">Merch:</strong> printing runs so club hoodies stay affordable.</p>
        </CardContent>
      </Card>
    </div>
  );
}
