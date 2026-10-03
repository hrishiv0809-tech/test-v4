import { httpDelete, httpGet, httpPatch, httpPost } from './client';
import type { Fundraiser, FundraiserDetail, FundraiserStatus, FundraiserTask, Transaction, TaskPriority, TaskStatus } from './types';

export const fundraisersApi = {
  list: () => httpGet<Fundraiser[]>('/fundraisers'),
  detail: (id: number) => httpGet<FundraiserDetail>(`/fundraisers/${id}`),
  create: (payload: { title: string; description: string; goal_amount: number; event_date: string; status: FundraiserStatus }) =>
    httpPost<Fundraiser>('/fundraisers', payload),
  update: (id: number, payload: Partial<{ title: string; description: string; goal_amount: number; event_date: string; status: FundraiserStatus }>) =>
    httpPatch<Fundraiser>(`/fundraisers/${id}`, payload),
  addTask: (fundraiserId: number, payload: { title: string; description?: string; assignee_id?: number | null; due_date?: string | null; priority: TaskPriority; status?: TaskStatus }) =>
    httpPost<FundraiserTask>(`/fundraisers/${fundraiserId}/tasks`, payload),
  recordIncome: (fundraiserId: number, payload: { amount: number; description?: string; date?: string }) =>
    httpPost<{ fundraiser: Fundraiser; transaction: Transaction }>(`/fundraisers/${fundraiserId}/income`, payload),
};

export const tasksApi = {
  mine: () => httpGet<FundraiserTask[]>('/tasks/mine'),
  update: (taskId: number, payload: Partial<{ status: TaskStatus; position: number; title: string; description: string; priority: TaskPriority; assignee_id: number | null; due_date: string | null }>) =>
    httpPatch<FundraiserTask>(`/tasks/${taskId}`, payload),
  remove: (taskId: number) => httpDelete<{ deleted: boolean }>(`/tasks/${taskId}`),
};
