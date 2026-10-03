import { httpGet, httpPost } from './client';
import type { CardInfo, Membership, MembershipPlan, Transaction } from './types';

export const plansApi = {
  list: () => httpGet<MembershipPlan[]>('/membership-plans'),
};

export const membershipsApi = {
  mine: () => httpGet<Membership | null>('/memberships/me'),
  card: () => httpGet<CardInfo>('/memberships/me/card'),
  checkout: (planId: number) => httpPost<{ membership_id: number; amount_due: number; plan_name: string }>('/memberships/checkout', { plan_id: planId }),
  pay: (membershipId: number) => httpPost<{ membership: Membership; transaction: Transaction }>(`/memberships/${membershipId}/pay`),
  markPaid: (membershipId: number) => httpPost<{ membership: Membership }>(`/memberships/${membershipId}/mark-paid`),
  sendReminders: () => httpPost<{ reminded: number; expired: number }>('/memberships/send-reminders'),
};
