import { httpGet } from './client';
import type { FinancePnl, FinanceSummary, Paginated, Transaction, TransactionSource, TransactionType } from './types';

export interface TransactionQuery {
  from?: string;
  to?: string;
  type?: TransactionType | 'ALL';
  source?: TransactionSource | 'ALL';
  search?: string;
  page?: number;
  page_size?: number;
}

export const financeApi = {
  summary: (range: { from?: string; to?: string } = {}) =>
    httpGet<FinanceSummary>('/finance/summary', range as Record<string, unknown>),
  transactions: (query: TransactionQuery) =>
    httpGet<Paginated<Transaction> & { net_total: number }>('/finance/transactions', query as Record<string, unknown>),
  exportCsv: (range: { from?: string; to?: string } = {}) =>
    httpGet<{ csv: string; filename: string }>('/finance/export.csv', range as Record<string, unknown>),
  pnl: () => httpGet<FinancePnl>('/finance/pnl'),
};
