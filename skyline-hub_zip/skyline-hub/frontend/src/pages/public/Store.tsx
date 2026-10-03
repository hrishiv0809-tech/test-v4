import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ShoppingBag, Store as StoreIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { ProductImage } from '@/components/shared/ProductImage';
import { productsApi } from '@/api/products';
import { plansApi } from '@/api/memberships';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/hooks/useCart';
import { formatCurrency } from '@/lib/utils';

export default function Store(): JSX.Element {
  const { user } = useAuth();
  const { count } = useCart();
  const products = useQuery({ queryKey: ['products'], queryFn: () => productsApi.list(true) });
  const plans = useQuery({ queryKey: ['plans'], queryFn: () => plansApi.list() });

  const bestDiscount = Math.max(0, ...(plans.data ?? []).map((p) => p.merch_discount_percent));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <PageHeader
        title="Merch store"
        description="Club hoodies, tees and totes. Members get an automatic discount at checkout."
        actions={
          <Button variant="outline" asChild>
            <Link to={user ? '/app/my-orders' : '/login'}>
              <ShoppingBag /> {count > 0 ? `Cart (${count})` : 'My orders'}
            </Link>
          </Button>
        }
      />

      {!user ? (
        <Card className="mb-6 flex flex-col items-start justify-between gap-3 border-primary/20 bg-primary/[0.04] p-5 sm:flex-row sm:items-center">
          <div>
            <p className="font-medium">Save up to {bestDiscount}% on every order</p>
            <p className="text-sm text-muted-foreground">Join the association and the discount is applied automatically at checkout.</p>
          </div>
          <Button asChild>
            <Link to="/membership">See membership plans</Link>
          </Button>
        </Card>
      ) : null}

      {products.isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="h-48 w-full rounded-none" />
              <CardContent className="space-y-3 p-5">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (products.data ?? []).length === 0 ? (
        <EmptyState icon={StoreIcon} title="The store is empty" description="New merch drops will be listed here." />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {(products.data ?? []).map((product) => {
            const available = product.variants.filter((v) => v.stock > 0);
            return (
              <Link key={product.id} to={`/store/${product.id}`} className="group">
                <Card className="flex h-full flex-col overflow-hidden transition-all group-hover:-translate-y-0.5 group-hover:border-primary/40">
                  <div className="relative h-48 w-full overflow-hidden">
                    <ProductImage name={product.name} imageUrl={product.image_url} className="transition-transform duration-300 group-hover:scale-[1.03]" />
                    {available.length === 0 ? (
                      <div className="absolute inset-0 grid place-items-center bg-black/55">
                        <span className="rounded-xl bg-white/95 px-4 py-2 text-sm font-semibold uppercase tracking-wide">Sold out</span>
                      </div>
                    ) : product.is_low_stock ? (
                      <Badge variant="warn" className="absolute right-3 top-3">Low stock</Badge>
                    ) : null}
                  </div>
                  <CardContent className="flex flex-1 flex-col p-5">
                    <h2 className="text-lg font-semibold">{product.name}</h2>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{product.description}</p>
                    <div className="mt-auto flex items-center justify-between pt-4">
                      <span className="text-xl font-semibold">{formatCurrency(product.base_price)}</span>
                      <div className="flex flex-wrap justify-end gap-1">
                        {product.variants.map((variant) => (
                          <span
                            key={variant.id}
                            className={
                              variant.stock > 0
                                ? 'rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground'
                                : 'rounded-md bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground line-through'
                            }
                          >
                            {variant.size}
                          </span>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
