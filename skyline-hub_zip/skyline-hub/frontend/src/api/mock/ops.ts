/**
 * Domain logic for the mock API. The rules here MIRROR the real backend exactly:
 * member pricing is computed here (never trusted from the UI), capacity and stock
 * are enforced, check-in is idempotent and every money movement writes a
 * transaction row. Swap in the FastAPI backend with VITE_USE_MOCKS=false and the
 * UI behaves identically.
 */
import type {
  AdminDashboard,
  CardInfo,
  CheckInResponse,
  EventCard,
  EventDetail,
  EventReport,
  ExpenseClaim,
  FinancePnl,
  FinanceSummary,
  FundraiserDetail,
  FundraiserProgress,
  FundraiserTask,
  MemberRow,
  Membership,
  MembershipPlan,
  MyDashboard,
  OrderItem,
  OrderStatus,
  OrderWithItems,
  Paginated,
  PnlRow,
  Product,
  Size,
  SizeSummaryRow,
  Ticket,
  Transaction,
  TransactionSource,
  TransactionType,
  User,
  VerifyResponse,
} from '../types';
import {
  DAY,
  addDays,
  iso,
  money,
  nextId,
  type DbEvent,
  type DbExpense,
  type DbFundraiser,
  type DbOrder,
  type DbTask,
  type DbTransaction,
  type DbUser,
  type DbVariant,
  type MockDb,
} from './db';

/* ------------------------------------------------------------------ lookups */

export const findUser = (db: MockDb, id: number | null): DbUser | undefined =>
  id === null ? undefined : db.users.find((u) => u.id === id);

export const findUserByEmail = (db: MockDb, email: string): DbUser | undefined =>
  db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());

export const toUser = (u: DbUser): User => {
  const { password: _password, ...rest } = u;
  return rest;
};

export const membershipOf = (db: MockDb, userId: number | null) =>
  userId === null ? undefined : db.memberships.find((m) => m.user_id === userId);

export const planOf = (db: MockDb, planId: number | null | undefined): MembershipPlan | undefined =>
  planId === null || planId === undefined ? undefined : db.plans.find((p) => p.id === planId);

/** Reflects the daily APScheduler job in the backend: lapse anything past its end date. */
export function expireLapsed(db: MockDb): number {
  let expired = 0;
  const now = Date.now();
  for (const m of db.memberships) {
    if (m.status === 'ACTIVE' && m.end_date && new Date(m.end_date).getTime() < now) {
      m.status = 'EXPIRED';
      expired++;
    }
  }
  return expired;
}

export function activeMembership(db: MockDb, userId: number | null): Membership | undefined {
  const m = membershipOf(db, userId);
  if (!m) return undefined;
  if (m.status === 'ACTIVE' && m.end_date && new Date(m.end_date).getTime() < Date.now()) {
    m.status = 'EXPIRED';
  }
  return m.status === 'ACTIVE' ? m : undefined;
}

export function discountPercents(db: MockDb, userId: number | null): { ticket: number; merch: number; isMember: boolean } {
  const m = activeMembership(db, userId);
  const plan = m ? planOf(db, m.plan_id) : undefined;
  return {
    ticket: plan?.ticket_discount_percent ?? 0,
    merch: plan?.merch_discount_percent ?? 0,
    isMember: Boolean(m && plan),
  };
}

/* ------------------------------------------------------------- presenters */

export function memberView(db: MockDb, m: Membership): Membership {
  return {
    ...m,
    plan: planOf(db, m.plan_id),
    user_name: findUser(db, m.user_id)?.name,
    user_email: findUser(db, m.user_id)?.email,
  };
}

export function memberRow(db: MockDb, user: DbUser): MemberRow {
  const m = membershipOf(db, user.id);
  return {
    ...toUser(user),
    membership_id: m?.id ?? null,
    membership_status: m?.status ?? 'NONE',
    plan_name: planOf(db, m?.plan_id)?.name ?? null,
    end_date: m?.end_date ?? null,
    dues_paid: m?.dues_paid ?? false,
    member_code: m?.member_code ?? null,
  };
}

export function isExpiringSoon(db: MockDb, user: DbUser, days = 30): boolean {
  const m = membershipOf(db, user.id);
  if (!m || m.status !== 'ACTIVE' || !m.end_date) return false;
  const ms = new Date(m.end_date).getTime() - Date.now();
  return ms > 0 && ms <= days * DAY;
}

export function soldCount(db: MockDb, eventId: number): number {
  return db.tickets.filter((t) => t.event_id === eventId && t.status !== 'CANCELLED').length;
}

export function eventCard(db: MockDb, event: DbEvent): EventCard {
  const sold = soldCount(db, event.id);
  return {
    ...event,
    sold,
    seats_left: Math.max(0, event.capacity - sold),
    is_sold_out: sold >= event.capacity,
  };
}

export function eventDetail(db: MockDb, event: DbEvent, userId: number | null): EventDetail {
  const card = eventCard(db, event);
  const { ticket, isMember } = discountPercents(db, userId);
  const price = isMember ? money(priceFor(event, 'member')) : card.non_member_price;
  return {
    ...card,
    my_price: price,
    my_discount_percent: isMember ? ticket : 0,
    is_member_price: isMember,
  };
}

export function priceFor(event: DbEvent, kind: 'member' | 'non_member' | 'auto', isMember = false): number {
  if (kind === 'member') return event.member_price;
  if (kind === 'non_member') return event.non_member_price;
  return isMember ? event.member_price : event.non_member_price;
}

export function ticketView(db: MockDb, t: MockDb['tickets'][number]): Ticket {
  const event = db.events.find((e) => e.id === t.event_id);
  return {
    ...t,
    event_title: event?.title,
    event_start_date: event?.start_date,
    event_location: event?.location,
    checked_in_by_name: findUser(db, t.checked_in_by_id)?.name ?? null,
  };
}

export function orderItems(db: MockDb, orderId: number): OrderItem[] {
  return db.order_items
    .filter((i) => i.order_id === orderId)
    .map((i) => {
      const variant = db.variants.find((v) => v.id === i.variant_id);
      const product = db.products.find((p) => p.id === variant?.product_id);
      return {
        ...i,
        product_id: product?.id ?? 0,
        product_name: product?.name ?? 'Unknown product',
        size: variant?.size ?? 'M',
        line_total: money(i.unit_price * i.quantity),
      };
    });
}

export function orderView(db: MockDb, order: DbOrder): OrderWithItems {
  const user = findUser(db, order.user_id);
  return { ...order, user_name: user?.name, items: orderItems(db, order.id) };
}

export function productView(db: MockDb, product: MockDb['products'][number]): Product {
  const variants = db.variants
    .filter((v) => v.product_id === product.id)
    .sort((a, b) => ['XS', 'S', 'M', 'L', 'XL', 'XXL'].indexOf(a.size) - ['XS', 'S', 'M', 'L', 'XL', 'XXL'].indexOf(b.size));
  const total = variants.reduce((sum, v) => sum + v.stock, 0);
  return { ...product, variants, total_stock: total, is_low_stock: total < 5 };
}

export function expenseView(db: MockDb, e: DbExpense): ExpenseClaim {
  const fundraiser = db.fundraisers.find((f) => f.id === e.fundraiser_id);
  const event = db.events.find((ev) => ev.id === e.event_id);
  return {
    ...e,
    submitter_name: findUser(db, e.submitted_by_id)?.name ?? 'Unknown',
    reviewer_name: findUser(db, e.reviewed_by_id)?.name ?? null,
    fundraiser_title: fundraiser?.title ?? null,
    event_title: event?.title ?? null,
  };
}

export function transactionView(db: MockDb, t: DbTransaction): Transaction {
  return { ...t, created_by_name: findUser(db, t.created_by_id)?.name ?? null };
}

/* --------------------------------------------------------------- transactions */

export interface NewTransaction {
  type: TransactionType;
  source: TransactionSource;
  amount: number;
  description: string;
  reference_type?: string | null;
  reference_id?: number | null;
  created_by_id?: number | null;
  date?: string;
}

/** The single write-path for money. Called from every money-moving handler. */
export function recordTransaction(db: MockDb, input: NewTransaction): DbTransaction {
  const tx: DbTransaction = {
    id: nextId(db, 'transactions'),
    type: input.type,
    source: input.source,
    amount: money(input.amount),
    description: input.description,
    reference_type: input.reference_type ?? null,
    reference_id: input.reference_id ?? null,
    date: input.date ?? iso(new Date()),
    created_by_id: input.created_by_id ?? null,
  };
  db.transactions.push(tx);
  return tx;
}

/* --------------------------------------------------------------- fundraisers */

export function progressFor(db: MockDb, fundraiser: DbFundraiser): FundraiserProgress {
  const tasks = db.tasks.filter((t) => t.fundraiser_id === fundraiser.id);
  const done = tasks.filter((t) => t.status === 'DONE').length;
  const now = Date.now();
  const overdue = tasks.filter(
    (t) => t.status !== 'DONE' && t.due_date !== null && new Date(t.due_date).getTime() < now,
  ).length;
  const pctDone = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const daysToEvent = (new Date(fundraiser.event_date).getTime() - now) / DAY;
  const atRisk = overdue > 0 || (daysToEvent <= 3 && daysToEvent > -2 && pctDone < 50);
  return {
    tasks_done: done,
    tasks_total: tasks.length,
    pct_done: pctDone,
    overdue_count: overdue,
    raised_pct: fundraiser.goal_amount ? Math.round((fundraiser.raised_amount / fundraiser.goal_amount) * 100) : 0,
    health: atRisk ? 'AT_RISK' : 'ON_TRACK',
  };
}

export function taskView(db: MockDb, t: DbTask): FundraiserTask {
  const fundraiser = db.fundraisers.find((f) => f.id === t.fundraiser_id);
  return {
    ...t,
    fundraiser_title: fundraiser?.title,
    assignee_name: findUser(db, t.assignee_id)?.name ?? null,
    is_overdue: t.status !== 'DONE' && t.due_date !== null && new Date(t.due_date).getTime() < Date.now(),
  };
}

export function fundraiserDetail(db: MockDb, f: DbFundraiser): FundraiserDetail {
  return {
    ...f,
    progress: progressFor(db, f),
    tasks: db.tasks
      .filter((t) => t.fundraiser_id === f.id)
      .sort((a, b) => a.position - b.position || a.id - b.id)
      .map((t) => taskView(db, t)),
  };
}

/* ------------------------------------------------------------------- reports */

export function eventReport(db: MockDb, event: DbEvent): EventReport {
  const tickets = db.tickets.filter((t) => t.event_id === event.id && t.status !== 'CANCELLED');
  const checkedIn = tickets.filter((t) => t.status === 'CHECKED_IN').length;
  const revenue = money(tickets.reduce((s, t) => s + t.price_paid, 0));
  const linkedExpenses = money(
    db.expenses
      .filter((e) => e.event_id === event.id && e.status !== 'REJECTED')
      .reduce((s, e) => s + e.amount, 0),
  );
  const byDay = new Map<string, number>();
  tickets.forEach((t) => {
    const key = t.created_at.slice(0, 10);
    byDay.set(key, money((byDay.get(key) ?? 0) + t.price_paid));
  });
  const memberTickets = tickets.filter((t) => t.is_member_price).length;
  return {
    event,
    tickets_sold: tickets.length,
    member_tickets: memberTickets,
    non_member_tickets: tickets.length - memberTickets,
    checked_in: checkedIn,
    attendance_pct: tickets.length ? Math.round((checkedIn / tickets.length) * 100) : 0,
    no_shows: tickets.length - checkedIn,
    revenue,
    linked_expenses: linkedExpenses,
    net_profit: money(revenue - linkedExpenses),
    revenue_by_day: [...byDay.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, value]) => ({ date, revenue: value })),
    status_breakdown: [
      { name: 'Checked in', value: checkedIn },
      { name: 'Not yet arrived', value: tickets.length - checkedIn },
    ],
  };
}

/* ------------------------------------------------------------------- finance */

export function financeSummary(db: MockDb, from: string | null, to: string | null): FinanceSummary {
  expireLapsed(db);
  const inRange = (dateIso: string): boolean => {
    const t = new Date(dateIso).getTime();
    if (from && t < new Date(from).getTime()) return false;
    if (to && t > new Date(to).getTime() + DAY) return false;
    return true;
  };
  const txns = db.transactions.filter((t) => inRange(t.date));
  const income = money(txns.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0));
  const expenses = money(txns.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0));

  const sourceTotals = new Map<TransactionSource, number>();
  txns
    .filter((t) => t.type === 'INCOME')
    .forEach((t) => sourceTotals.set(t.source, money((sourceTotals.get(t.source) ?? 0) + t.amount)));

  const monthKeys = new Map<string, { income: number; expenses: number }>();
  txns.forEach((t) => {
    const key = t.date.slice(0, 7);
    const entry = monthKeys.get(key) ?? { income: 0, expenses: 0 };
    if (t.type === 'INCOME') entry.income = money(entry.income + t.amount);
    else entry.expenses = money(entry.expenses + t.amount);
    monthKeys.set(key, entry);
  });

  const pending = db.expenses.filter((e) => e.status === 'SUBMITTED');

  const sumSource = (s: TransactionSource): number => sourceTotals.get(s) ?? 0;

  return {
    total_income: income,
    total_expenses: expenses,
    balance: money(income - expenses),
    pending_reimbursements: money(pending.reduce((s, e) => s + e.amount, 0)),
    pending_count: pending.length,
    income_by_source: [...sourceTotals.entries()]
      .map(([source, amount]) => ({ source, amount }))
      .sort((a, b) => b.amount - a.amount),
    monthly: [...monthKeys.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, v]) => ({ month, ...v })),
    member_dues_collected: sumSource('DUES'),
    tickets_revenue: sumSource('TICKET'),
    merch_revenue: sumSource('MERCH'),
    fundraiser_revenue: sumSource('FUNDRAISER'),
  };
}

export function pnl(db: MockDb): FinancePnl {
  const build = (kind: 'event' | 'fundraiser'): PnlRow[] => {
    if (kind === 'event') {
      return db.events.map((event) => {
        const revenue = money(
          db.tickets.filter((t) => t.event_id === event.id && t.status !== 'CANCELLED').reduce((s, t) => s + t.price_paid, 0),
        );
        const expenses = money(
          db.expenses.filter((e) => e.event_id === event.id && e.status !== 'REJECTED').reduce((s, e) => s + e.amount, 0),
        );
        const profit = money(revenue - expenses);
        return {
          id: event.id,
          name: event.title,
          revenue,
          expenses,
          profit,
          margin_pct: revenue ? Math.round((profit / revenue) * 100) : 0,
        };
      });
    }
    return db.fundraisers.map((f) => {
      const revenue = money(
        db.transactions
          .filter((t) => t.source === 'FUNDRAISER' && t.reference_id === f.id)
          .reduce((s, t) => s + t.amount, 0) || f.raised_amount,
      );
      const expenses = money(
        db.expenses.filter((e) => e.fundraiser_id === f.id && e.status !== 'REJECTED').reduce((s, e) => s + e.amount, 0),
      );
      const profit = money(revenue - expenses);
      return { id: f.id, name: f.title, revenue, expenses, profit, margin_pct: revenue ? Math.round((profit / revenue) * 100) : 0 };
    });
  };

  const events = build('event');
  const fundraisers = build('fundraiser');
  const revenue = money([...events, ...fundraisers].reduce((s, r) => s + r.revenue, 0));
  const expenses = money([...events, ...fundraisers].reduce((s, r) => s + r.expenses, 0));
  const profit = money(revenue - expenses);
  return { events, fundraisers, totals: { revenue, expenses, profit, margin_pct: revenue ? Math.round((profit / revenue) * 100) : 0 } };
}

/* ---------------------------------------------------------------- dashboards */

export function adminDashboard(db: MockDb): AdminDashboard {
  expireLapsed(db);
  const active = db.memberships.filter((m) => m.status === 'ACTIVE');
  const weekAgo = Date.now() - 7 * DAY;
  const summary = financeSummary(db, null, null);
  const activity: AdminDashboard['recent_activity'] = [];

  db.tickets.slice(-25).forEach((t) => {
    const event = db.events.find((e) => e.id === t.event_id);
    activity.push({
      id: `ticket-${t.id}`,
      type: 'TICKET',
      title: `Ticket sold — ${event?.title ?? 'Event'}`,
      description: `${t.buyer_name} · ${t.is_member_price ? 'member price' : 'guest price'}`,
      amount: t.price_paid,
      actor_name: t.buyer_name,
      created_at: t.created_at,
    });
  });
  db.transactions.slice(-20).forEach((t) => {
    activity.push({
      id: `tx-${t.id}`,
      type: 'TRANSACTION',
      title: t.type === 'INCOME' ? `Income recorded — ${t.source}` : `Expense recorded — ${t.source}`,
      description: t.description,
      amount: t.type === 'INCOME' ? t.amount : -t.amount,
      actor_name: findUser(db, t.created_by_id)?.name ?? 'System',
      created_at: t.date,
    });
  });
  db.expenses.slice(-10).forEach((e) => {
    activity.push({
      id: `expense-${e.id}`,
      type: 'EXPENSE',
      title: `Expense claim ${e.status.toLowerCase()}`,
      description: e.description,
      amount: -e.amount,
      actor_name: findUser(db, e.submitted_by_id)?.name ?? 'Member',
      created_at: e.reviewed_at ?? e.created_at,
    });
  });
  db.announcements.slice(-5).forEach((a) => {
    activity.push({
      id: `announcement-${a.id}`,
      type: 'ANNOUNCEMENT',
      title: `Announcement posted — ${a.category.replace(/_/g, ' ').toLowerCase()}`,
      description: a.title,
      actor_name: findUser(db, a.author_id)?.name ?? 'Admin',
      created_at: a.published_at,
    });
  });

  activity.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return {
    cards: {
      active_members: active.length,
      expiring_soon: db.memberships.filter((m) => {
        if (m.status !== 'ACTIVE' || !m.end_date) return false;
        const ms = new Date(m.end_date).getTime() - Date.now();
        return ms > 0 && ms <= 30 * DAY;
      }).length,
      upcoming_events: db.events.filter((e) => e.status === 'PUBLISHED' && new Date(e.start_date).getTime() > Date.now()).length,
      tickets_sold_this_week: db.tickets.filter((t) => new Date(t.created_at).getTime() >= weekAgo && t.status !== 'CANCELLED').length,
      open_orders: db.orders.filter((o) => o.status === 'PENDING' || o.status === 'PAID').length,
      open_tasks: db.tasks.filter((t) => t.status !== 'DONE').length,
      pending_claims: db.expenses.filter((e) => e.status === 'SUBMITTED').length,
      balance: summary.balance,
    },
    recent_activity: activity.slice(0, 12),
    latest_announcement: db.announcements.slice().sort((a, b) => b.published_at.localeCompare(a.published_at))[0] ?? null,
  };
}

export function myDashboard(db: MockDb, user: DbUser): MyDashboard {
  const membership = membershipOf(db, user.id);
  return {
    membership: membership ? memberView(db, membership) : null,
    plan: planOf(db, membership?.plan_id) ?? null,
    upcoming_events: db.events
      .filter((e) => e.status === 'PUBLISHED' && new Date(e.start_date).getTime() > Date.now())
      .sort((a, b) => a.start_date.localeCompare(b.start_date))
      .slice(0, 4)
      .map((e) => eventCard(db, e)),
    my_tickets: db.tickets
      .filter((t) => t.user_id === user.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((t) => ticketView(db, t)),
    my_orders: db.orders
      .filter((o) => o.user_id === user.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((o) => orderView(db, o)),
    my_claims: db.expenses
      .filter((e) => e.submitted_by_id === user.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((e) => expenseView(db, e)),
    my_tasks: db.tasks
      .filter((t) => t.assignee_id === user.id && t.status !== 'DONE')
      .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
      .map((t) => taskView(db, t)),
    announcements: db.announcements
      .slice()
      .sort((a, b) => b.published_at.localeCompare(a.published_at))
      .slice(0, 3),
  };
}

/* -------------------------------------------------------------------- store */

export function sizeSummary(db: MockDb): { rows: SizeSummaryRow[]; low_stock: SizeSummaryRow[] } {
  const ordered = new Map<number, number>();
  db.order_items
    .filter((i) => {
      const order = db.orders.find((o) => o.id === i.order_id);
      return order?.status === 'PAID' || order?.status === 'FULFILLED';
    })
    .forEach((i) => ordered.set(i.variant_id, (ordered.get(i.variant_id) ?? 0) + i.quantity));

  const rows: SizeSummaryRow[] = db.variants.map((v) => {
    const product = db.products.find((p) => p.id === v.product_id);
    return {
      product_name: product?.name ?? '—',
      size: v.size,
      ordered: ordered.get(v.id) ?? 0,
      remaining_stock: v.stock,
      is_low_stock: v.stock < 5,
    };
  });
  return { rows, low_stock: rows.filter((r) => r.is_low_stock) };
}

/* -------------------------------------------------------------- membership */

export function memberCard(db: MockDb, user: DbUser): CardInfo {
  const m = membershipOf(db, user.id);
  const plan = planOf(db, m?.plan_id);
  return {
    member_code: m?.member_code ?? 'NOT-A-MEMBER',
    member_name: user.name,
    plan_name: plan?.name ?? 'No active plan',
    status: m?.status ?? 'EXPIRED',
    end_date: m?.end_date ?? null,
    qr_png_base64: null,
  };
}

export function verify(db: MockDb, code: string | null, query: string | null): VerifyResponse {
  expireLapsed(db);
  if (code) {
    const trimmed = code.trim();
    const membership = db.memberships.find((m) => m.member_code?.toLowerCase() === trimmed.toLowerCase());
    if (membership) {
      const user = findUser(db, membership.user_id);
      const plan = planOf(db, membership.plan_id);
      const status = membership.status;
      return {
        status: status === 'ACTIVE' ? 'ACTIVE' : status === 'PENDING_PAYMENT' ? 'PENDING' : 'EXPIRED',
        member_name: user?.name,
        plan_name: plan?.name,
        end_date: membership.end_date ?? undefined,
        member_code: membership.member_code ?? undefined,
        message:
          status === 'ACTIVE'
            ? 'ACTIVE MEMBER — valid for member pricing'
            : status === 'PENDING_PAYMENT'
              ? 'PENDING PAYMENT — dues not yet paid'
              : 'EXPIRED — membership lapsed',
      };
    }
    const byStudentId = db.users.find((u) => u.student_id?.toLowerCase() === trimmed.toLowerCase());
    if (byStudentId) {
      const m = membershipOf(db, byStudentId.id);
      return verify(db, m?.member_code ?? null, null);
    }
    const ticket = db.tickets.find((t) => t.ticket_code.toLowerCase() === trimmed.toLowerCase());
    if (ticket) {
      const owner = findUser(db, ticket.user_id);
      const m = membershipOf(db, owner?.id ?? null);
      return verify(db, m?.member_code ?? null, null);
    }
    return { status: 'NOT_FOUND', message: 'NOT A MEMBER — no matching code' };
  }

  if (query) {
    const q = query.trim().toLowerCase();
    const user = db.users.find((u) => u.name.toLowerCase().includes(q));
    if (user) {
      const m = membershipOf(db, user.id);
      if (m?.member_code) return verify(db, m.member_code, null);
      return { status: 'PENDING', member_name: user.name, message: 'PENDING PAYMENT — dues not yet paid' };
    }
  }
  return { status: 'NOT_FOUND', message: 'NOT A MEMBER — no matching record' };
}

export function checkout(db: MockDb, code: string, actor: DbUser | null): CheckInResponse {
  const ticket = db.tickets.find((t) => t.ticket_code.toLowerCase() === code.trim().toLowerCase());
  if (!ticket) {
    return { result: 'INVALID', message: 'Invalid ticket — code not found' };
  }
  const event = db.events.find((e) => e.id === ticket.event_id);
  const base = {
    buyer_name: ticket.buyer_name,
    ticket_code: ticket.ticket_code,
    event_title: event?.title ?? 'Event',
    price_paid: ticket.price_paid,
    is_member_price: ticket.is_member_price,
    checked_in_at: ticket.checked_in_at,
  };
  if (ticket.status === 'CHECKED_IN') {
    return {
      result: 'ALREADY_CHECKED_IN',
      ticket: base,
      message: `Already checked in at ${ticket.checked_in_at ?? 'an earlier time'}`,
    };
  }
  if (ticket.status === 'CANCELLED') {
    return { result: 'INVALID', ticket: base, message: 'This ticket was cancelled' };
  }
  ticket.status = 'CHECKED_IN';
  ticket.checked_in_at = iso(new Date());
  ticket.checked_in_by_id = actor?.id ?? null;
  return { result: 'WELCOME', ticket: { ...base, checked_in_at: ticket.checked_in_at }, message: `Welcome, ${ticket.buyer_name}!` };
}

/* ------------------------------------------------------------------ paging */

export function paginate<T>(items: T[], page = 1, pageSize = 20): Paginated<T> {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), pages);
  const start = (safePage - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total,
    page: safePage,
    page_size: pageSize,
    pages,
  };
}

/* ------------------------------------------------------------- email helper */

/** Active members + mailing-list subscribers, deduplicated by lowercased email. */
export function announcementRecipients(db: MockDb): { email: string; name: string }[] {
  const seen = new Map<string, string>();
  db.memberships
    .filter((m) => m.status === 'ACTIVE')
    .forEach((m) => {
      const user = findUser(db, m.user_id);
      if (user) seen.set(user.email.toLowerCase(), user.name);
    });
  db.subscribers
    .filter((s) => s.subscribed)
    .forEach((s) => {
      if (!seen.has(s.email.toLowerCase())) seen.set(s.email.toLowerCase(), s.name ?? s.email);
    });
  return [...seen.entries()].map(([email, name]) => ({ email, name }));
}

export function newVariantId(db: MockDb): number {
  return nextId(db, 'variants');
}

export function ensureVariants(db: MockDb, productId: number): DbVariant[] {
  return db.variants.filter((v) => v.product_id === productId);
}

export function stockFor(db: MockDb, variantId: number): number {
  return db.variants.find((v) => v.id === variantId)?.stock ?? 0;
}

export function sizeOrder(size: Size): number {
  return ['XS', 'S', 'M', 'L', 'XL', 'XXL'].indexOf(size);
}

export function orderStatusLabel(status: OrderStatus): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export function tonight(): string {
  return addDays(0, 23, 59).slice(0, 10);
}
