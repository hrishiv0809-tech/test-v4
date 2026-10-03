import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { AlertTriangle, ImagePlus, Package, Pencil, Plus, Store } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { CardsSkeleton } from '@/components/shared/LoadingSkeleton';
import { ProductImage } from '@/components/shared/ProductImage';
import { productsApi } from '@/api/products';
import { apiErrorMessage } from '@/api/client';
import { LOW_STOCK_THRESHOLD, MAX_UPLOAD_MB } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils';
import { SIZES, type Product, type Size } from '@/api/types';

const schema = z.object({
  name: z.string().min(2, 'Product name is required'),
  description: z.string().min(5, 'Add a short description'),
  base_price: z.coerce.number().min(0.5, 'Price must be at least $0.50'),
  active: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

function ProductDialog({ product, trigger }: { product?: Product; trigger: React.ReactNode }): JSX.Element {
  const [open, setOpen] = React.useState(false);
  const [stock, setStock] = React.useState<Record<string, number>>({});
  const [image, setImage] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '', base_price: 20, active: true },
  });

  const active = watch('active');

  React.useEffect(() => {
    if (!open) return;
    reset({
      name: product?.name ?? '',
      description: product?.description ?? '',
      base_price: product?.base_price ?? 20,
      active: product?.active ?? true,
    });
    const initial: Record<string, number> = {};
    SIZES.forEach((size) => {
      initial[size] = product?.variants.find((v) => v.size === size)?.stock ?? 0;
    });
    setStock(initial);
    setImage(null);
    setPreview(product?.image_url ?? null);
  }, [open, product, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const variants = product
        ? SIZES.map((size) => ({
            id: product.variants.find((v) => v.size === size)?.id,
            size,
            stock: stock[size] ?? 0,
          }))
        : SIZES.map((size) => ({ size, stock: stock[size] ?? 0 }));
      return product
        ? productsApi.update(product.id, { ...values, variants }, image)
        : productsApi.create({ ...values, variants: variants as { size: Size; stock: number }[] }, image);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product'] });
      toast.success(product ? 'Product updated' : 'Product created');
      setOpen(false);
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const onImage = (file: File | null): void => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Use a jpg, png or webp image');
      return;
    }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      toast.error(`Image must be ${MAX_UPLOAD_MB}MB or smaller`);
      return;
    }
    setImage(file);
    setPreview(URL.createObjectURL(file));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{product ? `Edit ${product.name}` : 'New product'}</DialogTitle>
          <DialogDescription>Stock is tracked per size. Sizes with 0 stock are disabled for customers.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="p-name">Name</Label>
                <Input id="p-name" {...register('name')} aria-invalid={Boolean(errors.name)} />
                {errors.name ? <p className="text-xs text-red-600">{errors.name.message}</p> : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-desc">Description</Label>
                <Textarea id="p-desc" rows={3} {...register('description')} aria-invalid={Boolean(errors.description)} />
                {errors.description ? <p className="text-xs text-red-600">{errors.description.message}</p> : null}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="p-price">Base price ($)</Label>
                  <Input id="p-price" type="number" step="0.01" min={0} {...register('base_price')} aria-invalid={Boolean(errors.base_price)} />
                  {errors.base_price ? <p className="text-xs text-red-600">{errors.base_price.message}</p> : null}
                </div>
                <div className="flex items-center justify-between rounded-xl border border-border px-3">
                  <Label htmlFor="p-active" className="cursor-pointer text-sm">Active</Label>
                  <Switch id="p-active" checked={active} onCheckedChange={(checked) => setValue('active', checked)} />
                </div>
              </div>
            </div>

            <div className="w-full sm:w-40">
              <div className="h-40 w-full overflow-hidden rounded-xl border border-border">
                <ProductImage name={product?.name ?? 'New product'} imageUrl={preview} />
              </div>
              <Label htmlFor="p-image" className="mt-2 inline-flex cursor-pointer items-center gap-2 text-xs text-primary hover:underline">
                <ImagePlus className="size-3.5" /> Upload photo
              </Label>
              <input id="p-image" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => onImage(e.target.files?.[0] ?? null)} />
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Stock by size</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {SIZES.map((size) => (
                <div key={size} className="space-y-1.5">
                  <Label htmlFor={`stock-${size}`} className="text-xs">{size}</Label>
                  <Input
                    id={`stock-${size}`}
                    type="number"
                    min={0}
                    value={stock[size] ?? 0}
                    onChange={(e) => setStock((prev) => ({ ...prev, [size]: Math.max(0, Number(e.target.value)) }))}
                  />
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              {product ? 'Save changes' : 'Create product'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StockEditor({ productId, variantId, stock }: { productId: number; variantId: number; stock: number }): JSX.Element {
  const [value, setValue] = React.useState(String(stock));
  const queryClient = useQueryClient();
  React.useEffect(() => setValue(String(stock)), [stock]);

  const mutation = useMutation({
    mutationFn: (next: number) => productsApi.setStock(variantId, next),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
      toast.success('Stock updated');
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const dirty = Number(value) !== stock;

  return (
    <div className="flex items-center gap-1.5">
      <Input
        aria-label="Stock"
        className="h-8 w-16 text-center"
        type="number"
        min={0}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      {dirty ? (
        <Button size="icon-sm" aria-label="Save stock" loading={mutation.isPending} onClick={() => mutation.mutate(Math.max(0, Number(value)))}>
          ✓
        </Button>
      ) : null}
    </div>
  );
}

export default function StoreAdmin(): JSX.Element {
  const products = useQuery({ queryKey: ['products', 'admin'], queryFn: () => productsApi.list(false) });

  const lowStock = (products.data ?? []).flatMap((product) =>
    product.variants.filter((variant) => variant.stock < LOW_STOCK_THRESHOLD).map((variant) => ({ product: product.name, size: variant.size, stock: variant.stock })),
  );

  return (
    <>
      <PageHeader
        title="Products & stock"
        description="Manage the merch catalogue, per-size stock levels and low-stock alerts."
        actions={
          <ProductDialog
            trigger={
              <Button>
                <Plus /> New product
              </Button>
            }
          />
        }
      />

      {lowStock.length > 0 ? (
        <Card className="mb-5 border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10">
          <CardContent className="flex flex-wrap items-center gap-3 p-4 text-sm">
            <AlertTriangle className="size-4 text-amber-600" />
            <span className="font-medium">Low stock ({lowStock.length})</span>
            <div className="flex flex-wrap gap-2">
              {lowStock.map((row) => (
                <Badge key={`${row.product}-${row.size}`} variant={row.stock === 0 ? 'danger' : 'warn'}>
                  {row.product} · {row.size}: {row.stock}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {products.isLoading ? (
        <CardsSkeleton count={3} />
      ) : (products.data ?? []).length === 0 ? (
        <EmptyState
          icon={Store}
          title="No products yet"
          description="Add your first hoodie, tee or tote to start selling."
          action={
            <ProductDialog
              trigger={
                <Button>
                  <Plus /> New product
                </Button>
              }
            />
          }
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {(products.data ?? []).map((product) => (
            <Card key={product.id}>
              <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                <div className="flex items-center gap-3">
                  <div className="size-14 shrink-0 overflow-hidden rounded-xl border border-border">
                    <ProductImage name={product.name} imageUrl={product.image_url} />
                  </div>
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      {product.name}
                      {product.active ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Hidden</Badge>}
                    </CardTitle>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {formatCurrency(product.base_price)} · {product.total_stock} in stock
                    </p>
                  </div>
                </div>
                <ProductDialog
                  product={product}
                  trigger={
                    <Button size="sm" variant="outline">
                      <Pencil /> Edit
                    </Button>
                  }
                />
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="line-clamp-2 text-sm text-muted-foreground">{product.description}</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {product.variants.map((variant) => (
                    <div key={variant.id} className="rounded-xl border border-border p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">{variant.size}</span>
                        {variant.stock === 0 ? (
                          <Badge variant="danger">Out</Badge>
                        ) : variant.stock < LOW_STOCK_THRESHOLD ? (
                          <Badge variant="warn">Low</Badge>
                        ) : (
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Package className="size-3" /> ok
                          </span>
                        )}
                      </div>
                      <div className="mt-2">
                        <StockEditor productId={product.id} variantId={variant.id} stock={variant.stock} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
