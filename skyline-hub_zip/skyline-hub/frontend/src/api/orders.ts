import { httpGet, httpPatch, httpPost } from './client';
import type { OrderStatus, OrderWithItems, Paginated, SizeSummaryRow, Transaction } from './types';

export const ordersApi = {
  checkout: (payload: { items: { variant_id: number; quantity: number }[]; buyer_name?: string; buyer_email?: string }) =>
    httpPost<OrderWithItems>('/orders/checkout', payload),
  pay: (orderId: number) => httpPost<{ order: OrderWithItems; transaction: Transaction }>(`/orders/${orderId}/pay`),
  mine: () => httpGet<OrderWithItems[]>('/orders/mine'),
  list: (query: { status?: OrderStatus | 'ALL'; page?: number; page_size?: number } = {}) =>
    httpGet<Paginated<OrderWithItems>>('/orders', query as Record<string, unknown>),
  setStatus: (orderId: number, status: OrderStatus) => httpPatch<OrderWithItems>(`/orders/${orderId}/status`, { status }),
  sizeSummary: () => httpGet<{ rows: SizeSummaryRow[]; low_stock: SizeSummaryRow[] }>('/orders/size-summary'),
};
