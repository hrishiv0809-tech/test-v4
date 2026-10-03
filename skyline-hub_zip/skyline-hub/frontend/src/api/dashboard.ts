import { httpGet } from './client';
import type { AdminDashboard, MyDashboard } from './types';

export const dashboardApi = {
  admin: () => httpGet<AdminDashboard>('/dashboard/admin'),
  me: () => httpGet<MyDashboard>('/dashboard/me'),
};
