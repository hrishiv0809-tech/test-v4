import type { AnnouncementCategory, ExpenseStatus, MembershipStatus, OrderStatus, Role, TaskPriority } from '@/api/types';

export const APP_NAME = 'Skyline Hub';
export const ORG_NAME = 'Skyline Student Association';

export const DEMO_ACCOUNTS: { role: Role; label: string; email: string; password: string }[] = [
  { role: 'ADMIN', label: 'President (Admin)', email: 'admin@skyline.edu', password: 'admin123' },
  { role: 'TREASURER', label: 'Treasurer', email: 'treasurer@skyline.edu', password: 'treasurer123' },
  { role: 'VOLUNTEER', label: 'Volunteer', email: 'volunteer@skyline.edu', password: 'volunteer123' },
  { role: 'MEMBER', label: 'Member', email: 'member@skyline.edu', password: 'member123' },
];

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'President (Admin)',
  TREASURER: 'Treasurer',
  VOLUNTEER: 'Volunteer',
  MEMBER: 'Member',
};

export const MEMBERSHIP_STATUS_META: Record<MembershipStatus, { label: string; variant: 'success' | 'warn' | 'danger' | 'secondary' }> = {
  ACTIVE: { label: 'Active', variant: 'success' },
  PENDING_PAYMENT: { label: 'Pending payment', variant: 'warn' },
  EXPIRED: { label: 'Expired', variant: 'danger' },
};

export const CATEGORY_META: Record<AnnouncementCategory, { label: string; variant: 'default' | 'warn' | 'danger' | 'secondary' }> = {
  MEETING: { label: 'Meeting', variant: 'default' },
  DEADLINE: { label: 'Deadline', variant: 'warn' },
  CHANGE_OF_PLAN: { label: 'Change of plan', variant: 'danger' },
  GENERAL: { label: 'General', variant: 'secondary' },
};

export const ORDER_STATUS_META: Record<OrderStatus, { label: string; variant: 'warn' | 'default' | 'success' | 'danger' }> = {
  PENDING: { label: 'Pending', variant: 'warn' },
  PAID: { label: 'Paid', variant: 'default' },
  FULFILLED: { label: 'Fulfilled', variant: 'success' },
  CANCELLED: { label: 'Cancelled', variant: 'danger' },
};

export const EXPENSE_STATUS_META: Record<ExpenseStatus, { label: string; variant: 'warn' | 'default' | 'success' | 'danger' }> = {
  SUBMITTED: { label: 'Submitted', variant: 'warn' },
  APPROVED: { label: 'Approved', variant: 'default' },
  REJECTED: { label: 'Rejected', variant: 'danger' },
  REIMBURSED: { label: 'Reimbursed', variant: 'success' },
};

export const PRIORITY_META: Record<TaskPriority, { label: string; variant: 'secondary' | 'warn' | 'danger' }> = {
  LOW: { label: 'Low', variant: 'secondary' },
  MEDIUM: { label: 'Medium', variant: 'warn' },
  HIGH: { label: 'High', variant: 'danger' },
};

export const EXPENSE_CATEGORIES = [
  'Supplies',
  'Venue',
  'Marketing',
  'Transport',
  'Food & drink',
  'Equipment',
  'Printing',
  'Other',
];

export const MAX_UPLOAD_MB = 5;
export const LOW_STOCK_THRESHOLD = 5;

export const RANGE_PRESETS = ['THIS_SEMESTER', 'THIS_MONTH', 'CUSTOM'] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];
