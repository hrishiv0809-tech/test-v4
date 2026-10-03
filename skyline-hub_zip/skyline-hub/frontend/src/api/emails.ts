import { httpGet } from './client';
import type { EmailLog, Paginated } from './types';

export const emailsApi = {
  list: (query: { search?: string; page?: number; page_size?: number } = {}) =>
    httpGet<Paginated<EmailLog>>('/emails', query as Record<string, unknown>),
};
