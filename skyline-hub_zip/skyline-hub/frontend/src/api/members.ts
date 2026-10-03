import { httpGet, httpPost } from './client';
import type { MemberFilter, MemberProfile, MemberRow, Membership, Paginated, User, VerifyResponse } from './types';

export interface MemberQuery {
  search?: string;
  status?: MemberFilter | 'ALL';
  page?: number;
  page_size?: number;
}

export const membersApi = {
  list: (query: MemberQuery) => httpGet<Paginated<MemberRow>>('/members', query as Record<string, unknown>),
  detail: (id: number) => httpGet<MemberProfile>(`/members/${id}`),
  quickAdd: (payload: {
    name: string;
    email: string;
    phone?: string;
    student_id?: string;
    plan_id: number;
    mark_dues_paid: boolean;
  }) => httpPost<{ user: User; membership: Membership; temp_password: string | null }>('/members/quick-add', payload),
  exportCsv: (query: Pick<MemberQuery, 'search' | 'status'>) =>
    httpGet<{ csv: string; filename: string }>('/members/export.csv', query as Record<string, unknown>),
  verify: (params: { code?: string; q?: string }) =>
    httpGet<VerifyResponse>('/members/verify', params as Record<string, unknown>),
};
