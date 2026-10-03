import { httpGet, httpPost } from './client';

export const newsletterApi = {
  subscribe: (payload: { email: string; name?: string }) => httpPost<{ subscribed: boolean; email: string }>('/newsletter/subscribe', payload),
  unsubscribe: (token: string) => httpGet<{ unsubscribed: boolean; email: string }>(`/newsletter/unsubscribe/${token}`),
};
