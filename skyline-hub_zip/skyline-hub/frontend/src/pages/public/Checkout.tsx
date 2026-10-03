import * as React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CreditCard, Lock, ShoppingBag, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/EmptyState';
import { ticketsApi } from '@/api/tickets';
import { membershipsApi } from '@/api/memberships';
import { ordersApi } from '@/api/orders';
import { apiErrorMessage } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/hooks/useCart';
import { formatCurrency } from '@/lib/utils';

type Intent =
  | { kind: 'TICKET'; checkout_id: string; event_id: number; event_title: string; quantity: number; unit_price: number; total: number; is_member_price: boolean }
  | { kind: 'MEMBERSHIP'; membership_id: number; plan_name: string; amount_due: number }
  | { kind: 'MEMBERSHIP_CHECKOUT'; plan_id: number }
  | undefined;

export default function Checkout(): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const cart = useCart();
  const intent = location.state as Intent;
  const [orderId, setOrderId] = React.useState<number | null>(null);
  const [guestName, setGuestName] = React.useState('');
  const [guestEmail, setGuestEmail] = React.useState('');

  const payTicket = useMutation({
    mutationFn: (checkoutId: string) => ticketsApi.pay(checkoutId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['event'] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['membership', 'me'] });
      toast.success(`Payment complete — ticket${result.tickets.length > 1 ? 's' : ''} emailed to ${result.emailed_to}`);
      navigate(`/tickets/${result.tickets[0].ticket_code}`, { state: { emailedTo: result.emailed_to, multiple: result.tickets.length } });
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const payMembership = useMutation({
    mutationFn: (values: { membershipId: number }) => membershipsApi.pay(values.membershipId),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success('Membership active — your digital card is ready');
      navigate('/app/card');
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const createMembershipCheckout = useMutation({
    mutationFn: (planId: number) => membershipsApi.checkout(planId),
    onSuccess: (result) => {
      navigate('/checkout', {
        state: { kind: 'MEMBERSHIP', membership_id: result.membership_id, plan_name: result.plan_name, amount_due: result.amount_due },
        replace: true,
      });
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const createOrder = useMutation({
    mutationFn: () =>
      ordersApi.checkout({
        items: cart.lines.map((line) => ({ variant_id: line.variant_id, quantity: line.quantity })),
        buyer_name: user ? undefined : guestName,
        buyer_email: user ? undefined : guestEmail,
      }),
    onSuccess: (order) => {
      setOrderId(order.id);
      toast.success('Order created — confirm payment to reserve your items');
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const payOrder = useMutation({
    mutationFn: (id: number) => ordersApi.pay(id),
    onSuccess: (result) => {
      cart.clear();
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['product'] });
      toast.success(`Paid ${formatCurrency(result.order.total)} — ${result.order.is_member_discount ? `${result.order.discount_percent}% member discount applied` : 'thanks!'}`);
      navigate('/app/my-orders');
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  React.useEffect(() => {
    if (intent?.kind === 'MEMBERSHIP_CHECKOUT') {
      createMembershipCheckout.mutate(intent.plan_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent?.kind]);

  const cartDiscountPercent = React.useMemo(() => {
    const subtotal = cart.subtotal;
    return subtotal > 0 && user ? 0 : 0;
  }, [cart.subtotal, user]);
  void cartDiscountPercent;

  const isBusy = payTicket.isPending || payMembership.isPending || createOrder.isPending || payOrder.isPending || createMembershipCheckout.isPending;

  /* ------------------------------------------------ membership intent view */
  if (intent?.kind === 'MEMBERSHIP') {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CreditCard className="size-4 text-primary" /> Pay your membership dues</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2 rounded-xl border border-border p-4 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Plan</span><span className="font-medium">{intent.plan_name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Valid until</span><span className="font-medium">end of the academic year</span></div>
              <Separator />
              <div className="flex justify-between text-base font-semibold"><span>Amount due</span><span>{formatCurrency(intent.amount_due)}</span></div>
            </div>
            <Button
              className="w-full"
              size="lg"
              loading={payMembership.isPending}
              onClick={() => payMembership.mutate({ membershipId: intent.membership_id })}
            >
              <Lock /> Pay Now (mock payment)
            </Button>
            <p className="text-center text-xs text-muted-foreground">No card details are collected — this simulates a successful Stripe payment.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ----------------------------------------------------- ticket intent view */
  if (intent?.kind === 'TICKET') {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Ticket className="size-4 text-primary" /> Confirm your tickets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2 rounded-xl border border-border p-4 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Event</span><span className="font-medium">{intent.event_title}</span></div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tickets</span>
                <span className="font-medium">
                  {intent.quantity} × {formatCurrency(intent.unit_price)}
                  {intent.is_member_price ? <Badge variant="success" className="ml-2">member price</Badge> : null}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between text-base font-semibold"><span>Total</span><span>{formatCurrency(intent.total)}</span></div>
            </div>
            <Button
              className="w-full"
              size="lg"
              loading={payTicket.isPending}
              onClick={() => payTicket.mutate(intent.checkout_id)}
            >
              <Lock /> Pay Now (mock payment)
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Price was calculated on the server from your membership status. Tickets are emailed and stored in your account.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ------------------------------------------------------- merchandise cart */
  if (cart.lines.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <EmptyState
          icon={ShoppingBag}
          title="Your cart is empty"
          description="Browse the merch store and pick a size — members get their discount applied at checkout."
          action={<Button asChild><Link to="/store">Go to the store</Link></Button>}
        />
      </div>
    );
  }

  const orderInFlight = orderId !== null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-semibold">Checkout</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Prices and discounts are recalculated on the server when the order is created.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {cart.lines.map((line) => (
              <div key={line.variant_id} className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{line.product_name}</p>
                  <p className="text-xs text-muted-foreground">Size {line.size} · {formatCurrency(line.unit_price)} each</p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    aria-label={`Quantity for ${line.product_name} size ${line.size}`}
                    className="h-9 w-16 text-center"
                    type="number"
                    min={1}
                    max={line.max_stock}
                    value={line.quantity}
                    onChange={(e) => cart.setQuantity(line.variant_id, Number(e.target.value))}
                  />
                  <span className="w-20 text-right font-medium">{formatCurrency(line.unit_price * line.quantity)}</span>
                  <Button variant="ghost" size="icon-sm" aria-label={`Remove ${line.product_name}`} onClick={() => cart.remove(line.variant_id)}>
                    ×
                  </Button>
                </div>
              </div>
            ))}
            <Separator />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{formatCurrency(cart.subtotal)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {user ? 'Your member discount is applied on the server when you create the order.' : 'Sign in before checkout to get your member discount.'}
            </p>
          </CardContent>
        </Card>

        <Card className="lg:sticky lg:top-24 lg:self-start">
          <CardHeader>
            <CardTitle className="text-base">Payment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!user ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
                  Guest checkout — we'll email your receipt.
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="guest-name">Full name</Label>
                  <Input id="guest-name" value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Alex Morgan" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="guest-email">Email</Label>
                  <Input id="guest-email" type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} placeholder="alex@example.com" />
                </div>
                <p className="text-xs text-muted-foreground">
                  <Link to="/login" className="font-medium text-primary underline underline-offset-2">Sign in</Link> to use your member discount.
                </p>
              </div>
            ) : (
              <div className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
                Order will be billed to <span className="font-medium text-foreground">{user.email}</span>
              </div>
            )}

            {!orderInFlight ? (
              <Button
                className="w-full"
                size="lg"
                loading={createOrder.isPending}
                disabled={!user && (!guestName.trim() || !guestEmail.trim())}
                onClick={() => createOrder.mutate()}
              >
                <CreditCard /> Create order & review total
              </Button>
            ) : (
              <Button className="w-full" size="lg" loading={payOrder.isPending} onClick={() => payOrder.mutate(orderId)}>
                <Lock /> Pay Now (mock payment)
              </Button>
            )}
            <p className="text-center text-xs text-muted-foreground">Stock is reserved and decremented only when payment succeeds.</p>
            {isBusy ? <p className="text-center text-xs text-muted-foreground">Working…</p> : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
