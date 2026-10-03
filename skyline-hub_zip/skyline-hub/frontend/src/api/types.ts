/**
 * Shared API types. These mirror the backend contract EXACTLY (see README §API contract).
 * Enums are string unions, never TS enums, so they round-trip with JSON cleanly.
 * Money is always a number with 2 decimals in the client; the backend uses DECIMAL(10,2).
 */

export type Role = 'ADMIN' | 'TREASURER' | 'VOLUNTEER' | 'MEMBER';
export type MembershipStatus = 'PENDING_PAYMENT' | 'ACTIVE' | 'EXPIRED';
export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'COMPLETED' | 'CANCELLED';
export type TicketStatus = 'VALID' | 'CHECKED_IN' | 'CANCELLED';
export type AnnouncementCategory = 'MEETING' | 'DEADLINE' | 'CHANGE_OF_PLAN' | 'GENERAL';
export type OrderStatus = 'PENDING' | 'PAID' | 'FULFILLED' | 'CANCELLED';
export type Size = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL';
export type FundraiserStatus = 'PLANNING' | 'ACTIVE' | 'COMPLETED';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type ExpenseStatus = 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'REIMBURSED';
export type TransactionType = 'INCOME' | 'EXPENSE';
export type TransactionSource =
  | 'DUES'
  | 'TICKET'
  | 'MERCH'
  | 'FUNDRAISER'
  | 'DONATION'
  | 'REIMBURSEMENT'
  | 'OTHER';
export type Health = 'ON_TRACK' | 'AT_RISK';
export type CheckInResult = 'WELCOME' | 'ALREADY_CHECKED_IN' | 'INVALID';
export type VerifyStatus = 'ACTIVE' | 'EXPIRED' | 'PENDING' | 'NOT_FOUND';
export type MemberFilter = 'ALL' | 'ACTIVE' | 'EXPIRED' | 'PENDING' | 'EXPIRING_30';

export const SIZES: Size[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
export const LOW_STOCK_THRESHOLD = 5;

export interface User {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  student_id: string | null;
  role: Role;
  created_at: string;
}

export interface MembershipPlan {
  id: number;
  name: string;
  price: number;
  duration_months: number;
  ticket_discount_percent: number;
  merch_discount_percent: number;
  benefits: string[];
}

export interface Membership {
  id: number;
  user_id: number;
  user_name?: string;
  user_email?: string;
  plan_id: number;
  plan?: MembershipPlan;
  status: MembershipStatus;
  start_date: string | null;
  end_date: string | null;
  dues_paid: boolean;
  amount_paid: number;
  member_code: string | null;
  renewal_reminder_sent: boolean;
}

export interface MemberRow extends User {
  membership_id: number | null;
  membership_status: MembershipStatus | 'NONE';
  plan_name: string | null;
  end_date: string | null;
  dues_paid: boolean;
  member_code: string | null;
}

export interface MemberProfile {
  user: User;
  membership: Membership | null;
  plan: MembershipPlan | null;
  tickets: Ticket[];
  orders: OrderWithItems[];
  totals: { spent_on_tickets: number; spent_on_merch: number };
}

export interface Event {
  id: number;
  title: string;
  description: string;
  location: string;
  start_date: string;
  end_date: string;
  image_url: string | null;
  capacity: number;
  member_price: number;
  non_member_price: number;
  status: EventStatus;
  created_at: string;
}

export interface EventCard extends Event {
  sold: number;
  seats_left: number;
  is_sold_out: boolean;
}

export interface EventDetail extends EventCard {
  my_price: number;
  my_discount_percent: number;
  is_member_price: boolean;
}

export interface Ticket {
  id: number;
  event_id: number;
  event_title?: string;
  event_start_date?: string;
  event_location?: string;
  user_id: number | null;
  buyer_name: string;
  buyer_email: string;
  price_paid: number;
  is_member_price: boolean;
  ticket_code: string;
  status: TicketStatus;
  checked_in_at: string | null;
  checked_in_by_name?: string | null;
  created_at: string;
}

export interface TicketCheckoutIntent {
  checkout_id: string;
  event_id: number;
  event_title: string;
  quantity: number;
  unit_price: number;
  is_member_price: boolean;
  subtotal: number;
  total: number;
  expires_at: string;
}

export interface EventReport {
  event: Event;
  tickets_sold: number;
  member_tickets: number;
  non_member_tickets: number;
  checked_in: number;
  attendance_pct: number;
  no_shows: number;
  revenue: number;
  linked_expenses: number;
  net_profit: number;
  revenue_by_day: { date: string; revenue: number }[];
  status_breakdown: { name: string; value: number }[];
}

export interface Announcement {
  id: number;
  title: string;
  body: string;
  category: AnnouncementCategory;
  author_id: number;
  author_name?: string;
  published_at: string;
  email_sent: boolean;
  recipient_count: number;
}

export interface Subscriber {
  id: number;
  email: string;
  name: string | null;
  user_id: number | null;
  subscribed: boolean;
  unsubscribe_token: string;
}

export interface EmailLog {
  id: number;
  to_email: string;
  subject: string;
  body: string;
  sent_at: string;
  related_type: string | null;
  related_id: number | null;
  status: 'LOGGED' | 'SENT' | 'FAILED';
}

export interface ProductVariant {
  id: number;
  product_id: number;
  size: Size;
  stock: number;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  image_url: string | null;
  base_price: number;
  active: boolean;
  variants: ProductVariant[];
  total_stock: number;
  is_low_stock: boolean;
}

export interface OrderItem {
  id: number;
  order_id: number;
  variant_id: number;
  product_id: number;
  product_name: string;
  size: Size;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface Order {
  id: number;
  user_id: number | null;
  user_name?: string;
  buyer_name?: string;
  buyer_email?: string;
  status: OrderStatus;
  subtotal: number;
  discount: number;
  discount_percent: number;
  total: number;
  is_member_discount: boolean;
  created_at: string;
  items?: OrderItem[];
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
}

export interface SizeSummaryRow {
  product_name: string;
  size: Size;
  ordered: number;
  remaining_stock: number;
  is_low_stock: boolean;
}

export interface Fundraiser {
  id: number;
  title: string;
  description: string;
  goal_amount: number;
  raised_amount: number;
  event_date: string;
  status: FundraiserStatus;
  progress: FundraiserProgress;
}

export interface FundraiserProgress {
  tasks_done: number;
  tasks_total: number;
  pct_done: number;
  overdue_count: number;
  raised_pct: number;
  health: Health;
}

export interface FundraiserTask {
  id: number;
  fundraiser_id: number;
  fundraiser_title?: string;
  title: string;
  description: string;
  assignee_id: number | null;
  assignee_name?: string | null;
  due_date: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  position: number;
  is_overdue?: boolean;
}

export interface FundraiserDetail extends Fundraiser {
  tasks: FundraiserTask[];
}

export interface ExpenseClaim {
  id: number;
  submitted_by_id: number;
  submitter_name?: string;
  fundraiser_id: number | null;
  fundraiser_title?: string | null;
  event_id: number | null;
  event_title?: string | null;
  description: string;
  amount: number;
  category: string;
  receipt_url: string;
  receipt_name?: string;
  status: ExpenseStatus;
  reviewed_by_id: number | null;
  reviewer_name?: string | null;
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  reimbursed_at: string | null;
}

export interface Transaction {
  id: number;
  type: TransactionType;
  source: TransactionSource;
  amount: number;
  description: string;
  reference_type: string | null;
  reference_id: number | null;
  date: string;
  created_by_id: number | null;
  created_by_name?: string | null;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface ApiError {
  detail: string;
  status?: number;
}

export interface AuthResponse {
  access_token: string;
  token_type: 'bearer';
  user: User;
}

export interface CardInfo {
  member_code: string;
  member_name: string;
  plan_name: string;
  status: MembershipStatus;
  end_date: string | null;
  qr_png_base64: string | null;
}

export interface VerifyResponse {
  status: VerifyStatus;
  member_name?: string;
  plan_name?: string;
  end_date?: string;
  member_code?: string;
  message: string;
}

export interface CheckInResponse {
  result: CheckInResult;
  ticket?: {
    buyer_name: string;
    ticket_code: string;
    event_title: string;
    price_paid: number;
    is_member_price: boolean;
    checked_in_at: string | null;
  };
  message: string;
}

export interface FinanceSummary {
  total_income: number;
  total_expenses: number;
  balance: number;
  pending_reimbursements: number;
  pending_count: number;
  income_by_source: { source: TransactionSource; amount: number }[];
  monthly: { month: string; income: number; expenses: number }[];
  member_dues_collected: number;
  tickets_revenue: number;
  merch_revenue: number;
  fundraiser_revenue: number;
}

export interface PnlRow {
  id: number;
  name: string;
  revenue: number;
  expenses: number;
  profit: number;
  margin_pct: number;
}

export interface FinancePnl {
  events: PnlRow[];
  fundraisers: PnlRow[];
  totals: { revenue: number; expenses: number; profit: number; margin_pct: number };
}

export interface AdminDashboard {
  cards: {
    active_members: number;
    expiring_soon: number;
    upcoming_events: number;
    tickets_sold_this_week: number;
    open_orders: number;
    open_tasks: number;
    pending_claims: number;
    balance: number;
  };
  recent_activity: {
    id: string;
    type: string;
    title: string;
    description: string;
    amount?: number;
    actor_name: string;
    created_at: string;
  }[];
  latest_announcement: Announcement | null;
}

export interface MyDashboard {
  membership: Membership | null;
  plan: MembershipPlan | null;
  upcoming_events: EventCard[];
  my_tickets: Ticket[];
  my_orders: OrderWithItems[];
  my_claims: ExpenseClaim[];
  my_tasks: FundraiserTask[];
  announcements: Announcement[];
}

export interface MonthlyPoint {
  month: string;
  income: number;
  expenses: number;
}
