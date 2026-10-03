import { httpGet, httpPost, httpPostForm } from './client';
import type { ExpenseClaim, ExpenseStatus, Paginated, Transaction } from './types';

export interface ExpenseInput {
  amount: number;
  description: string;
  category: string;
  fundraiser_id?: number | null;
  event_id?: number | null;
  receipt: File;
}

export const expensesApi = {
  create: (payload: ExpenseInput) => {
    const form = new FormData();
    form.append('amount', String(payload.amount));
    form.append('description', payload.description);
    form.append('category', payload.category);
    if (payload.fundraiser_id) form.append('fundraiser_id', String(payload.fundraiser_id));
    if (payload.event_id) form.append('event_id', String(payload.event_id));
    form.append('receipt', payload.receipt);
    return httpPostForm<ExpenseClaim>('/expenses', form);
  },
  mine: () => httpGet<ExpenseClaim[]>('/expenses/mine'),
  list: (query: { status?: ExpenseStatus | 'ALL'; page?: number; page_size?: number } = {}) =>
    httpGet<Paginated<ExpenseClaim>>('/expenses', query as Record<string, unknown>),
  approve: (id: number, note?: string) => httpPost<ExpenseClaim>(`/expenses/${id}/approve`, note ? { note } : undefined),
  reject: (id: number, note: string) => httpPost<ExpenseClaim>(`/expenses/${id}/reject`, { note }),
  reimburse: (id: number) => httpPost<{ claim: ExpenseClaim; transaction: Transaction }>(`/expenses/${id}/reimburse`),
};
