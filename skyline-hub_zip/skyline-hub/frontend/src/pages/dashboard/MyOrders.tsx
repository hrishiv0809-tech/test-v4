import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ShoppingBag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { ListSkeleton } from '@/components/shared/LoadingSkeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { OrderBadge } from '@/components/shared/StatusBadge';
import { ordersApi } from '@/api/orders';
import { useCart } from '@/hooks/useCart';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function MyOrders(): JSX.Element {
  const query = useQuery({ queryKey: ['orders', 'mine'], queryFn: () => ordersApi.mine() });
  const cart = useCart();

  const reorder = (items: { variant_id: number; product_name: string; size: string; unit_price: number; quantity: number }[]): void => {
    items.forEach((item) => {
      cart.add(
        {
          variant_id: item.variant_id,
          product_id: 0,
          product_name: item.product_name,
          size: item.size,
          unit_price: item.unit_price,
          max_stock: Math.max(item.quantity, 1),
        },
        item.quantity,
      );
    });
    toast.success('Added those items back to your cart');
  };

  return (
    <>
      <PageHeader
        title="My orders"
        description="Merch orders and their fulfilment status. Pickup is at the union office, Tuesdays 2–4pm."
        actions={
          <Button asChild>
            <Link to="/store">Back to store</Link>
          </Button>
        }
      />

      {query.isLoading ? (
        <ListSkeleton rows={3} />
      ) : (query.data ?? []).length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="No orders yet"
          description="Club hoodies, tees and totes are waiting — members get an automatic discount."
          action={
            <Button asChild>
              <Link to="/store">Visit the store</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {(query.data ?? []).map((order) => (
            <Card key={order.id}>
              <CardContent className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">Order #{order.id}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(order.created_at, 'MMM d, yyyy · h:mm a')}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <OrderBadge status={order.status} />
                    <span className="text-lg font-semibold">{formatCurrency(order.total)}</span>
                  </div>
                </div>

                <ul className="mt-4 space-y-2">
                  {order.items.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm">
                      <span className="min-w-0 truncate">
                        {item.product_name} <span className="text-muted-foreground">· size {item.size}</span>
                      </span>
                      <span className="shrink-0 text-muted-foreground">
                        {item.quantity} × {formatCurrency(item.unit_price)}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-sm">
                  <div className="flex items-center gap-2">
                    {order.is_member_discount ? (
                      <Badge variant="success">member discount −{order.discount_percent}%</Badge>
                    ) : (
                      <Badge variant="secondary">no discount applied</Badge>
                    )}
                    {order.discount > 0 ? <span className="text-muted-foreground">saved {formatCurrency(order.discount)}</span> : null}
                  </div>
                  {order.status === 'PENDING' ? (
                    <Button size="sm" asChild>
                      <Link to="/checkout">Complete payment</Link>
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => reorder(order.items)}>
                      Order again
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
