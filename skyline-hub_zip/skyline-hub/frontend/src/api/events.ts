import { httpDelete, httpGet, httpPatch, httpPostForm } from './client';
import type { EventCard, EventDetail, EventReport, EventStatus, Paginated } from './types';

export interface EventFormValues {
  title: string;
  description: string;
  location: string;
  start_date: string;
  end_date: string;
  capacity: number;
  member_price: number;
  non_member_price: number;
  status: EventStatus;
  image_url?: string | null;
}

export const eventsApi = {
  list: (query: { status?: EventStatus | 'ALL'; upcoming?: boolean; search?: string; page?: number; page_size?: number } = {}) =>
    httpGet<Paginated<EventCard>>('/events', query as Record<string, unknown>),
  detail: (id: number) => httpGet<EventDetail>(`/events/${id}`),
  report: (id: number) => httpGet<EventReport>(`/events/${id}/report`),
  create: (values: EventFormValues, image?: File | null) => {
    const form = toEventForm(values, image);
    return httpPostForm<EventCard>('/events', form);
  },
  update: (id: number, values: Partial<EventFormValues>, image?: File | null) => {
    const form = toEventForm(values, image);
    return httpPatch<EventCard>(`/events/${id}`, form);
  },
  remove: (id: number) => httpDelete<{ deleted: boolean; cancelled?: boolean; tickets_sold?: number }>(`/events/${id}`),
};

function toEventForm(values: Partial<EventFormValues>, image?: File | null): FormData {
  const form = new FormData();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null) form.append(key, String(value));
  });
  if (image) form.append('image', image);
  return form;
}
