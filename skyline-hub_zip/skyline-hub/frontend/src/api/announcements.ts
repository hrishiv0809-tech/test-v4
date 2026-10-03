import { httpDelete, httpGet, httpPatch, httpPost } from './client';
import type { Announcement, AnnouncementCategory, Paginated } from './types';

export const announcementsApi = {
  list: (query: { category?: AnnouncementCategory | 'ALL'; search?: string; page?: number; page_size?: number } = {}) =>
    httpGet<Paginated<Announcement>>('/announcements', query as Record<string, unknown>),
  create: (payload: { title: string; body: string; category: AnnouncementCategory; send_email: boolean }) =>
    httpPost<{ announcement: Announcement; recipient_count: number; emailed: boolean }>('/announcements', payload),
  update: (id: number, payload: Partial<{ title: string; body: string; category: AnnouncementCategory }>) =>
    httpPatch<Announcement>(`/announcements/${id}`, payload),
  remove: (id: number) => httpDelete<{ deleted: boolean }>(`/announcements/${id}`),
};
