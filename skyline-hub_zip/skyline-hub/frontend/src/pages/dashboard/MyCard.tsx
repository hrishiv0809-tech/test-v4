import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { BadgeCheck, CalendarClock, CreditCard, IdCard, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import { QRCodeView } from '@/components/shared/QRCodeView';
import { MembershipBadge } from '@/components/shared/StatusBadge';
import { membershipsApi } from '@/api/memberships';
import { useAuth } from '@/context/AuthContext';
import { daysUntil, formatDate } from '@/lib/utils';

export default function MyCard(): JSX.Element {
  const { user } = useAuth();
  const card = useQuery({ queryKey: ['membership', 'card'], queryFn: () => membershipsApi.card() });
  const membership = useQuery({ queryKey: ['membership', 'me'], queryFn: () => membershipsApi.mine() });

  if (card.isLoading) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <Skeleton className="h-56 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    );
  }

  const data = card.data;
  const daysLeft = data?.end_date ? daysUntil(data.end_date) : 0;
  const isActive = data?.status === 'ACTIVE';

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader
        title="Membership card"
        description="Show this screen at the door — staff scan the QR to verify you instantly."
        actions={
          <Button variant="outline" asChild>
            <Link to="/app/verify">Verify someone</Link>
          </Button>
        }
      />

      <div className="brand-grad relative overflow-hidden rounded-3xl p-6 text-white shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-white/70">Skyline Student Association</p>
            <p className="mt-1 text-xl font-semibold">{data?.member_name ?? user?.name}</p>
          </div>
          <span className="grid size-10 place-items-center rounded-xl bg-white/15">
            <IdCard className="size-5" />
          </span>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-white/60">Member code</p>
            <p className="font-mono text-base font-semibold">{data?.member_code ?? '—'}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-white/60">Plan</p>
            <p className="font-medium">{data?.plan_name ?? '—'}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-white/60">Valid until</p>
            <p className="font-medium">{formatDate(data?.end_date)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-white/60">Status</p>
            <p className="font-medium">{isActive ? `Active · ${daysLeft} days left` : data?.status?.replace('_', ' ').toLowerCase()}</p>
          </div>
        </div>
      </div>

      <Card className="mt-5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <BadgeCheck className="size-4 text-primary" /> Scan to verify
            </span>
            <MembershipBadge status={data?.status ?? 'EXPIRED'} />
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {data?.member_code ? (
            <QRCodeView value={data.member_code} pngBase64={data.qr_png_base64} size={224} />
          ) : (
            <p className="py-8 text-sm text-muted-foreground">Your member code is issued the moment your dues are paid.</p>
          )}
          <p className="text-center text-xs text-muted-foreground">
            Hold at arm's length in a bright spot. Increase your screen brightness if the scanner struggles.
          </p>
          {!isActive ? (
            <Button className="w-full" asChild>
              <Link to="/membership">
                <Sparkles /> {data?.status === 'PENDING_PAYMENT' ? 'Pay dues to activate' : 'Renew my membership'}
              </Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {membership.data?.plan ? (
        <Card className="mt-5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <CreditCard className="size-4 text-primary" /> Your benefits
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="default">{membership.data.plan.ticket_discount_percent}% off tickets</Badge>
              <Badge variant="accent">{membership.data.plan.merch_discount_percent}% off merch</Badge>
              {membership.data.dues_paid ? <Badge variant="success">Dues paid</Badge> : <Badge variant="warn">Dues outstanding</Badge>}
            </div>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {membership.data.plan.benefits.map((benefit) => (
                <li key={benefit}>• {benefit}</li>
              ))}
            </ul>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarClock className="size-3.5" /> Renewal reminders go out 30 days before expiry.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
