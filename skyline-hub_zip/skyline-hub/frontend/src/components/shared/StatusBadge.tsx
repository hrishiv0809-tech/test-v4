import { Badge } from '@/components/ui/badge';
import {
  CATEGORY_META,
  EXPENSE_STATUS_META,
  MEMBERSHIP_STATUS_META,
  ORDER_STATUS_META,
  PRIORITY_META,
} from '@/lib/constants';
import type {
  AnnouncementCategory,
  ExpenseStatus,
  MembershipStatus,
  OrderStatus,
  TaskPriority,
} from '@/api/types';

export function MembershipBadge({ status }: { status: MembershipStatus | 'NONE' }): JSX.Element {
  if (status === 'NONE') return <Badge variant="secondary">No membership</Badge>;
  const meta = MEMBERSHIP_STATUS_META[status];
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

export function OrderBadge({ status }: { status: OrderStatus }): JSX.Element {
  const meta = ORDER_STATUS_META[status];
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

export function ExpenseBadge({ status }: { status: ExpenseStatus }): JSX.Element {
  const meta = EXPENSE_STATUS_META[status];
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

export function CategoryBadge({ category }: { category: AnnouncementCategory }): JSX.Element {
  const meta = CATEGORY_META[category];
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

export function PriorityBadge({ priority }: { priority: TaskPriority }): JSX.Element {
  const meta = PRIORITY_META[priority];
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

export function HealthBadge({ health }: { health: 'ON_TRACK' | 'AT_RISK' }): JSX.Element {
  return health === 'ON_TRACK' ? <Badge variant="success">On track</Badge> : <Badge variant="danger">At risk</Badge>;
}
