import { httpGet, httpPost } from './client';
import type { CheckInResponse } from './types';

export const checkinApi = {
  scan: (ticketCode: string) => httpPost<CheckInResponse>('/checkin', { ticket_code: ticketCode }),
  stats: (eventId?: number) =>
    httpGet<{ checked_in: number; total_valid: number; attendance_pct: number }>('/checkin/stats', eventId ? { event_id: eventId } : undefined),
};
