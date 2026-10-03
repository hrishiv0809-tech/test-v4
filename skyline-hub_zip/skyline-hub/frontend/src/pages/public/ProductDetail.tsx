import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle2, Minus, Package, Plus, ShoppingBag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { ProductImage } from '@/components/shared/ProductImage';
import { productsApi } from '@/api/products';
import { plansApi } from '@/api/memberships';
import { membershipsApi } from '@/api/memberships';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/hooks/useCart';
import { cn, formatCurrency } from '@/lib/utils';
import type { Size } from '@/api/types';

export default function ProductDetail(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const productId = Number(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { add, count } = useCart();
  const [size, setSize] = React.useState<Size | null>(null);
  const [quantity, setQuantity] = React.useState(1);

  const product = useQuery({ queryKey: ['product', productId], queryFn: () => productsApi.detail(productId), enabled: Number.isFinite(productId) });
  const membership = useQuery({ queryKey: ['membership', 'me'], queryFn: () => membershipsApi.mine(), enabled: Boolean(user) });
  const plans = useQuery({ queryKey: ['plans'], queryFn: () => plansApi.list() });

  React.useEffect(() => {
    if (product.data && !size) {
      const firstAvailable = product.data.variants.find((v) => v.stock > 0);
      if (firstAvailable) setSize(firstAvailable.size);
    }
  }, [product.data, size]);

  if (product.isLoading) {
    return (
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 lg:grid-cols-2">
        <Skeleton className="h-80 w-full rounded-2xl" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (product.isError || !product.data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState icon={Package} title="Product not found" action={<Button asChild><Link to="/store">Back to store</Link></Button>} />
      </div>
    );
  }

  const item = product.data;
  const plan = membership.data?.plan ?? plans.data?.find((p) => p.id === membership.data?.plan_id);
  const isMember = membership.data?.status === 'ACTIVE';
  const discountPercent = isMember ? plan?.merch_discount_percent ?? 0 : 0;
  const unitPrice = item.base_price;
  const discounted = unitPrice * (1 - discountPercent / 100);
  const selectedVariant = item.variants.find((v) => v.size === size);
  const maxQty = selectedVariant?.stock ?? 0;

  const addToCart = (): void => {
    if (!selectedVariant) {
      toast.error('Choose a size first');
      return;
    }
    add(
      {
        variant_id: selectedVariant.id,
        product_id: item.id,
        product_name: item.name,
        size: selectedVariant.size,
        unit_price: item.base_price,
        max_stock: selectedVariant.stock,
      },
      quantity,
    );
    toast.success(`Added ${quantity} × ${item.name} (${selectedVariant.size}) to your cart`);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link to="/store">
          <ArrowLeft /> Back to store
        </Link>
      </Button>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="h-80 w-full overflow-hidden rounded-2xl sm:h-[26rem]">
          <ProductImage name={item.name} imageUrl={item.image_url} />
        </div>

        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{item.name}</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.description}</p>

          <div className="mt-5 flex items-end gap-3">
            {discountPercent > 0 ? (
              <>
                <span className="text-3xl font-semibold">{formatCurrency(discounted)}</span>
                <span className="pb-1 text-sm text-muted-foreground line-through">{formatCurrency(unitPrice)}</span>
                <Badge variant="success">−{discountPercent}% member</Badge>
              </>
            ) : (
              <span className="text-3xl font-semibold">{formatCurrency(unitPrice)}</span>
            )}
          </div>
          {!isMember ? (
            <p className="mt-2 text-sm text-muted-foreground">
              <Link to="/membership" className="font-medium text-primary underline underline-offset-2">Join the association</Link> to pay{' '}
              {formatCurrency(unitPrice * 0.8)} instead.
            </p>
          ) : null}

          <Separator className="my-6" />

          <fieldset>
            <legend className="text-sm font-medium">Size</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {item.variants.map((variant) => {
                const disabled = variant.stock === 0;
                return (
                  <button
                    key={variant.id}
                    type="button"
                    disabled={disabled}
                    aria-pressed={size === variant.size}
                    onClick={() => {
                      setSize(variant.size);
                      setQuantity(1);
                    }}
                    className={cn(
                      'min-w-[3.25rem] rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                      size === variant.size ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card hover:bg-muted',
                      disabled && 'cursor-not-allowed border-dashed text-muted-foreground line-through opacity-60 hover:bg-card',
                    )}
                  >
                    {variant.size}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {selectedVariant
                ? selectedVariant.stock > 0
                  ? selectedVariant.stock < 5
                    ? `Only ${selectedVariant.stock} left in size ${selectedVariant.size}`
                    : `${selectedVariant.stock} in stock`
                  : 'Out of stock'
                : 'Select a size'}
            </p>
          </fieldset>

          <div className="mt-6 flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon-sm" aria-label="Decrease quantity" onClick={() => setQuantity((q) => Math.max(1, q - 1))}>
                <Minus />
              </Button>
              <span className="w-10 text-center text-sm font-medium" aria-live="polite">{quantity}</span>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Increase quantity"
                disabled={quantity >= maxQty}
                onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
              >
                <Plus />
              </Button>
            </div>
            <Button className="flex-1" size="lg" disabled={!selectedVariant || maxQty === 0} onClick={addToCart}>
              <ShoppingBag /> Add to cart
            </Button>
          </div>

          <Button variant="outline" className="mt-3 w-full" onClick={() => navigate('/checkout')} disabled={count === 0}>
            Go to checkout {count > 0 ? `(${count})` : ''}
          </Button>

          <Card className="mt-6 border-primary/20 bg-primary/[0.04]">
            <CardContent className="space-y-2 p-5 text-sm">
              <p className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="size-4 text-emerald-600" /> Members save automatically
              </p>
              <p className="text-muted-foreground">
                The discount is recalculated on the server at payment time — the price you see is the price you pay.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
