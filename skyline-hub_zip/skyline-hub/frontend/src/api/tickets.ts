import { httpGet, httpPost } from './client';
import type { Ticket, TicketCheckoutIntent, Transaction } from './types';

export const ticketsApi = {
  checkout: (eventId: number, payload: { quantity: number; buyer_name?: string; buyer_email?: string }) =>
    httpPost<TicketCheckoutIntent>(`/events/${eventId}/tickets/checkout`, payload),
  pay: (checkoutId: string) =>
    httpPost<{ tickets: Ticket[]; transaction: Transaction; emailed_to: string }>(`/tickets/checkout/${checkoutId}/pay`),
  mine: () => httpGet<Ticket[]>('/tickets/mine'),
  byCode: (code: string) => httpGet<Ticket>(`/tickets/${code}`),
};
