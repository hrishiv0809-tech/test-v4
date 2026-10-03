import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, CalendarDays, CheckCircle2, Clock, MapPin, Minus, Plus, ShieldCheck, Ticket, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { EventImage } from '@/components/shared/ProductImage';
import { eventsApi } from '@/api/events';
import { ticketsApi } from '@/api/tickets';
import { apiErrorMessage } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency, formatDateTime, percent } from '@/lib/utils';

export default function EventDetail(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const eventId = Number(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [quantity, setQuantity] = React.useState(1);
  const [buyerName, setBuyerName] = React.useState('');
  const [buyerEmail, setBuyerEmail] = React.useState('');

  const query = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => eventsApi.detail(eventId),
    enabled: Number.isFinite(eventId),
  });

  const checkout = useMutation({
    mutationFn: () =>
      ticketsApi.checkout(eventId, {
        quantity,
        buyer_name: user ? undefined : buyerName,
        buyer_email: user ? undefined : buyerEmail,
      }),
    onSuccess: (intent) => {
      navigate('/checkout', {
        state: {
          kind: 'TICKET',
          checkout_id: intent.checkout_id,
          event_id: intent.event_id,
          event_title: intent.event_title,
          quantity: intent.quantity,
          unit_price: intent.unit_price,
          total: intent.total,
          is_member_price: intent.is_member_price,
        },
      });
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-10">
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState
          icon={CalendarDays}
          title="Event not found"
          description="This event may have been removed or the link is incorrect."
          action={<Button asChild><Link to="/events">Back to events</Link></Button>}
        />
      </div>
    );
  }

  const event = query.data;
  const total = event.my_price * quantity;
  const guestTotal = event.non_member_price * quantity;
  const savings = guestTotal - total;
  const canBuy = event.status === 'PUBLISHED' && !event.is_sold_out;
  const guestFormInvalid = !user && (!buyerName.trim() || !buyerEmail.trim());

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link to="/events">
          <ArrowLeft /> All events
        </Link>
      </Button>

      <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <div>
          <div className="h-64 w-full overflow-hidden rounded-2xl sm:h-80">
            <EventImage title={event.title} imageUrl={event.image_url} />
          </div>

          <div className="mt-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={event.status === 'PUBLISHED' ? 'success' : event.status === 'COMPLETED' ? 'secondary' : 'warn'}>
                {event.status.toLowerCase()}
              </Badge>
              {event.is_sold_out ? <Badge variant="danger">Sold out</Badge> : <Badge variant="secondary">{event.seats_left} seats left</Badge>}
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">{event.title}</h1>
            <dl className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="flex items-start gap-2 text-sm">
                <CalendarDays className="mt-0.5 size-4 text-primary" />
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Starts</dt>
                  <dd className="font-medium">{formatDateTime(event.start_date)}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <Clock className="mt-0.5 size-4 text-primary" />
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Ends</dt>
                  <dd className="font-medium">{formatDateTime(event.end_date)}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="mt-0.5 size-4 text-primary" />
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Location</dt>
                  <dd className="font-medium">{event.location}</dd>
                </div>
              </div>
            </dl>

            <Separator className="my-6" />

            <h2 className="text-lg font-semibold">About this event</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{event.description}</p>

            <div className="mt-6 rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Capacity</span>
                <span className="text-muted-foreground">
                  {event.sold} of {event.capacity} tickets sold
                </span>
              </div>
              <Progress className="mt-3" value={event.sold} max={event.capacity} tone={percent(event.sold, event.capacity) > 85 ? 'danger' : 'primary'} />
            </div>
          </div>
        </div>

        {/* Ticket box */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ticket className="size-4 text-primary" /> Tickets
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl bg-muted/60 p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">You pay</span>
                  <span className="text-3xl font-semibold">{formatCurrency(event.my_price)}</span>
                </div>
                {event.is_member_price ? (
                  <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="size-3.5" /> Member price applied — {event.my_discount_percent}% off
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">
                    <Link className="font-medium text-primary underline underline-offset-2" to="/membership">
                      Join for {formatCurrency(event.non_member_price - event.member_price)} less
                    </Link>{' '}
                    on this ticket alone.
                  </p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  Guest price {formatCurrency(event.non_member_price)}
                </p>
              </div>

              {!user ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
                    Buying as a guest — enter your details and we'll email the ticket.
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="buyer-name">Full name</Label>
                    <Input id="buyer-name" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder="Alex Morgan" autoComplete="name" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="buyer-email">Email</Label>
                    <Input id="buyer-email" type="email" value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} placeholder="alex@example.com" autoComplete="email" />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground">
                  <ShieldCheck className="size-4 text-primary" /> Tickets are tied to <span className="font-medium text-foreground">{user.email}</span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <Label htmlFor="qty" className="text-sm">Quantity</Label>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon-sm" aria-label="Decrease quantity" onClick={() => setQuantity((q) => Math.max(1, q - 1))}>
                    <Minus />
                  </Button>
                  <Input id="qty" className="h-9 w-14 text-center" value={quantity} readOnly aria-live="polite" />
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label="Increase quantity"
                    onClick={() => setQuantity((q) => Math.min(Math.min(10, event.seats_left || 10), q + 1))}
                  >
                    <Plus />
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5 rounded-xl border border-border p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{quantity} × {formatCurrency(event.my_price)}</span>
                  <span className="font-medium">{formatCurrency(total)}</span>
                </div>
                {event.is_member_price && savings > 0 ? (
                  <div className="flex justify-between text-emerald-700 dark:text-emerald-300">
                    <span>Member saving</span>
                    <span>−{formatCurrency(savings)}</span>
                  </div>
                ) : null}
                <Separator />
                <div className="flex justify-between text-base font-semibold">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>

              <Button
                className="w-full"
                size="lg"
                disabled={!canBuy || guestFormInvalid || checkout.isPending}
                loading={checkout.isPending}
                onClick={() => checkout.mutate()}
              >
                {event.is_sold_out ? 'Sold out' : 'Continue to checkout'}
              </Button>

              {!canBuy && !event.is_sold_out ? (
                <p className="text-center text-xs text-muted-foreground">Tickets are not on sale for this event yet.</p>
              ) : null}
              {!user && guestFormInvalid && canBuy ? (
                <p className="text-center text-xs text-muted-foreground">Enter your name and email to continue.</p>
              ) : null}

              <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
                <Users className="size-3.5" /> Mock payment — no card required
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
