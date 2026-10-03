import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BadgeCheck, Package, ShoppingBag, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/shared/PageHeader';
import { TableSkeleton } from '@/components/shared/LoadingSkeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { OrderBadge } from '@/components/shared/StatusBadge';
import { DataPagination } from '@/components/shared/DataPagination';
import { ordersApi } from '@/api/orders';
import { apiErrorMessage } from '@/api/client';
import { LOW_STOCK_THRESHOLD } from '@/lib/constants';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { OrderStatus } from '@/api/types';

const TABS: { value: OrderStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'PAID', label: 'Paid' },
  { value: 'FULFILLED', label: 'Fulfilled' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export default function OrdersAdmin(): JSX.Element {
  const queryClient = useQueryClient();
  const [status, setStatus] = React.useState<OrderStatus | 'ALL'>('ALL');
  const [page, setPage] = React.useState(1);

  const query = useQuery({
    queryKey: ['orders', 'admin', status, page],
    queryFn: () => ordersApi.list({ status, page, page_size: 15 }),
  });

  const summary = useQuery({ queryKey: ['orders', 'size-summary'], queryFn: () => ordersApi.sizeSummary() });

  const setOrderStatus = useMutation({
    mutationFn: ({ id, next }: { id: number; next: OrderStatus }) => ordersApi.setStatus(id, next),
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success(`Order #${order.id} marked ${order.status.toLowerCase()}`);
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  return (
    <>
      <PageHeader
        title="Orders"
        description="Fulfil merch orders and keep an eye on stock per size. Cancelling a paid order returns the stock."
      />

      <Card className="mb-5">
        <CardContent className="p-4">
          <Tabs
            value={status}
            onValueChange={(value) => {
              setStatus(value as OrderStatus | 'ALL');
              setPage(1);
            }}
          >
            <TabsList className="flex-wrap">
              {TABS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      {query.isLoading ? (
        <TableSkeleton rows={6} columns={5} />
      ) : (query.data?.items.length ?? 0) === 0 ? (
        <EmptyState icon={ShoppingBag} title="No orders in this view" description="Orders appear the moment a member checks out." />
      ) : (
        <>
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(query.data?.items ?? []).map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      <p className="font-medium">#{order.id}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(order.created_at, 'MMM d, yyyy')}</p>
                    </TableCell>
                    <TableCell className="text-sm">
                      <p>{order.user_name ?? order.buyer_name}</p>
                      <p className="text-xs text-muted-foreground">{order.buyer_email}</p>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {order.items.map((item) => `${item.product_name} (${item.size}) ×${item.quantity}`).join(', ')}
                    </TableCell>
                    <TableCell className="text-sm">
                      <p className="font-medium">{formatCurrency(order.total)}</p>
                      {order.is_member_discount ? <p className="text-xs text-emerald-600">−{order.discount_percent}% member</p> : null}
                    </TableCell>
                    <TableCell><OrderBadge status={order.status} /></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {order.status === 'PAID' ? (
                          <Button size="sm" onClick={() => setOrderStatus.mutate({ id: order.id, next: 'FULFILLED' })} loading={setOrderStatus.isPending}>
                            <BadgeCheck /> Fulfil
                          </Button>
                        ) : null}
                        {order.status !== 'CANCELLED' ? (
                          <ConfirmDialog
                            trigger={
                              <Button size="sm" variant="ghost" aria-label={`Cancel order ${order.id}`}>
                                <XCircle />
                              </Button>
                            }
                            title={`Cancel order #${order.id}?`}
                            description={
                              order.status === 'PAID' || order.status === 'FULFILLED'
                                ? 'Stock will be returned to the sizes in this order.'
                                : 'The order will be cancelled and no stock is affected.'
                            }
                            confirmLabel="Cancel order"
                            destructive
                            loading={setOrderStatus.isPending}
                            onConfirm={() => setOrderStatus.mutate({ id: order.id, next: 'CANCELLED' })}
                          />
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          {query.data ? (
            <DataPagination page={query.data.page} pages={query.data.pages} total={query.data.total} pageSize={query.data.page_size} onPageChange={setPage} />
          ) : null}
        </>
      )}

      <Card className="mt-6">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Package className="size-4 text-primary" /> Size summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          {summary.isLoading ? (
            <TableSkeleton rows={4} columns={4} />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead className="text-right">Ordered</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(summary.data?.rows ?? []).map((row, index) => (
                    <TableRow key={`${row.product_name}-${row.size}-${index}`}>
                      <TableCell className="text-sm">{row.product_name}</TableCell>
                      <TableCell className="text-sm font-medium">{row.size}</TableCell>
                      <TableCell className="text-right text-sm">{row.ordered}</TableCell>
                      <TableCell className="text-right text-sm">
                        <span className={row.remaining_stock === 0 ? 'font-semibold text-red-600' : row.is_low_stock ? 'font-semibold text-amber-600' : ''}>
                          {row.remaining_stock}
                        </span>
                        {row.remaining_stock === 0 ? <Badge variant="danger" className="ml-2">Out</Badge> : row.remaining_stock < LOW_STOCK_THRESHOLD ? <Badge variant="warn" className="ml-2">Low</Badge> : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {(summary.data?.low_stock.length ?? 0) > 0 ? (
                <p className="mt-4 text-xs text-muted-foreground">
                  {summary.data?.low_stock.length} size(s) below {LOW_STOCK_THRESHOLD} units — reorder before the next event.
                </p>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
