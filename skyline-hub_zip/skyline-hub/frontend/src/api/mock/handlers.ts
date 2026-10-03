/**
 * Route table for the mock API. Path/method/shape match the FastAPI backend
 * contract 1:1 so switching VITE_USE_MOCKS=false requires no UI changes.
 *
 * Order matters: more specific paths are declared before parameterised ones.
 */
import type { Role, Size } from '../types';
import {
  DAY,
  academicYearEnd,
  iso,
  money,
  nextId,
  type DbEvent,
  type DbExpense,
  type DbProduct,
  type DbTask,
  type DbUser,
  type MockDb,
} from './db';
import { MockError, badRequest, conflict, forbidden, gone, notFound, unauthorized } from './errors';
import * as ops from './ops';
import { toCsv } from '../../lib/utils';

export interface Ctx {
  db: MockDb;
  method: string;
  path: string;
  params: Record<string, string>;
  query: Record<string, string>;
  body: Record<string, unknown>;
  files: Record<string, File>;
  user: DbUser | null;
}

export type Handler = (ctx: Ctx) => unknown | Promise<unknown>;

export interface Route {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  auth?: boolean;
  roles?: Role[];
  handler: Handler;
}

/* ------------------------------------------------------------------ helpers */

const str = (v: unknown, field: string): string => {
  if (typeof v !== 'string' || !v.trim()) badRequest(`${field} is required`);
  return v.trim();
};
const optStr = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v.trim() : null;
const num = (v: unknown, field: string): number => {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) badRequest(`${field} must be a number`);
  return n;
};
const int = (v: unknown, field: string): number => {
  const n = num(v, field);
  if (!Number.isInteger(n)) badRequest(`${field} must be a whole number`);
  return n;
};
const pageNum = (q: Record<string, string>, key = 'page'): number => Math.max(1, Number(q[key] ?? '1') || 1);
const pageSize = (q: Record<string, string>, def = 20): number => Math.min(200, Math.max(1, Number(q.page_size ?? def) || def));

function uniqueMemberCode(db: MockDb): string {
  let code = '';
  do {
    code = `SKY-${nextId(db, 'member_codes') + 1000}`;
  } while (db.memberships.some((m) => m.member_code === code));
  return code;
}

function uniqueTicketCode(db: MockDb): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  do {
    let suffix = '';
    for (let i = 0; i < 4; i++) suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
    code = `TKT-${String(nextId(db, 'ticket_codes') + 1).padStart(4, '0')}-${suffix}`;
  } while (db.tickets.some((t) => t.ticket_code === code));
  return code;
}

async function fileToDataUrl(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:${file.type || 'application/octet-stream'};base64,${btoa(binary)}`;
}

const ALLOWED_RECEIPT = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

async function requireReceipt(ctx: Ctx): Promise<{ url: string; name: string }> {
  const file = ctx.files.receipt;
  if (!file) badRequest('A receipt file is required (jpg, png or pdf, max 5MB)');
  if (!ALLOWED_RECEIPT.includes(file.type)) badRequest(`Unsupported file type "${file.type}". Allowed: jpg, png, pdf`);
  if (file.size > MAX_UPLOAD_BYTES) badRequest('Receipt must be 5MB or smaller');
  return { url: await fileToDataUrl(file), name: file.name };
}

function assignMemberCode(db: MockDb, membershipId: number): void {
  const membership = db.memberships.find((m) => m.id === membershipId);
  if (!membership) notFound('Membership not found');
  if (!membership.member_code) membership.member_code = uniqueMemberCode(db);
}

function emailLog(
  db: MockDb,
  to: string,
  subject: string,
  body: string,
  relatedType: string,
  relatedId: number | null,
): void {
  db.email_logs.push({
    id: nextId(db, 'email_logs'),
    to_email: to,
    subject,
    body,
    sent_at: iso(new Date()),
    related_type: relatedType,
    related_id: relatedId,
    status: 'LOGGED',
  });
}

/* -------------------------------------------------------------------- routes */

export const routes: Route[] = [
  /* ------------------------------------------------------------------- auth */
  {
    method: 'POST',
    path: '/auth/signup',
    handler: (ctx) => {
      const name = str(ctx.body.name, 'Name');
      const email = str(ctx.body.email, 'Email');
      const password = str(ctx.body.password, 'Password');
      const planId = int(ctx.body.plan_id, 'Plan');
      if (password.length < 6) badRequest('Password must be at least 6 characters');
      if (ops.findUserByEmail(ctx.db, email)) conflict('An account with this email already exists');
      const plan = ctx.db.plans.find((p) => p.id === planId);
      if (!plan) badRequest('Unknown membership plan');

      const user: DbUser = {
        id: nextId(ctx.db, 'users'),
        name,
        email,
        password,
        phone: optStr(ctx.body.phone),
        student_id: optStr(ctx.body.student_id),
        role: 'MEMBER',
        created_at: iso(new Date()),
      };
      ctx.db.users.push(user);
      ctx.db.memberships.push({
        id: nextId(ctx.db, 'memberships'),
        user_id: user.id,
        plan_id: plan.id,
        status: 'PENDING_PAYMENT',
        start_date: null,
        end_date: null,
        dues_paid: false,
        amount_paid: 0,
        member_code: null,
        renewal_reminder_sent: false,
      });
      return { user: ops.toUser(user), membership_plan: plan };
    },
  },
  {
    method: 'POST',
    path: '/auth/login',
    handler: (ctx) => {
      const email = str(ctx.body.email, 'Email');
      const password = str(ctx.body.password, 'Password');
      const user = ops.findUserByEmail(ctx.db, email);
      if (!user || user.password !== password) unauthorized('Incorrect email or password');
      return { user: ops.toUser(user) };
    },
  },
  { method: 'GET', path: '/auth/me', auth: true, handler: (ctx) => ops.toUser(ctx.user as DbUser) },
  {
    method: 'PATCH',
    path: '/auth/me',
    auth: true,
    handler: (ctx) => {
      const user = ctx.user as DbUser;
      if (typeof ctx.body.name === 'string' && ctx.body.name.trim()) user.name = ctx.body.name.trim();
      if (typeof ctx.body.phone === 'string') user.phone = optStr(ctx.body.phone);
      if (typeof ctx.body.student_id === 'string') user.student_id = optStr(ctx.body.student_id);
      return ops.toUser(user);
    },
  },

  /* ------------------------------------------------------------------ plans */
  { method: 'GET', path: '/membership-plans', handler: (ctx) => ctx.db.plans },

  /* ------------------------------------------------------------ memberships */
  {
    method: 'GET',
    path: '/memberships/me',
    auth: true,
    handler: (ctx) => {
      const m = ops.membershipOf(ctx.db, (ctx.user as DbUser).id);
      return m ? ops.memberView(ctx.db, m) : null;
    },
  },
  {
    method: 'GET',
    path: '/memberships/me/card',
    auth: true,
    handler: (ctx) => ops.memberCard(ctx.db, ctx.user as DbUser),
  },
  {
    method: 'POST',
    path: '/memberships/checkout',
    auth: true,
    handler: (ctx) => {
      const user = ctx.user as DbUser;
      const planId = int(ctx.body.plan_id, 'Plan');
      const plan = ctx.db.plans.find((p) => p.id === planId);
      if (!plan) badRequest('Unknown membership plan');
      let membership = ops.membershipOf(ctx.db, user.id);
      if (membership && membership.status === 'ACTIVE') conflict('You already have an active membership');
      if (!membership) {
        ctx.db.memberships.push({
          id: nextId(ctx.db, 'memberships'),
          user_id: user.id,
          plan_id: plan.id,
          status: 'PENDING_PAYMENT',
          start_date: null,
          end_date: null,
          dues_paid: false,
          amount_paid: 0,
          member_code: null,
          renewal_reminder_sent: false,
        });
        membership = ctx.db.memberships[ctx.db.memberships.length - 1];
      } else {
        membership.plan_id = plan.id;
        membership.status = 'PENDING_PAYMENT';
      }
      return { membership_id: membership.id, amount_due: plan.price, plan_name: plan.name };
    },
  },
  {
    method: 'POST',
    path: '/memberships/send-reminders',
    roles: ['ADMIN'],
    handler: (ctx) => {
      const expired = ops.expireLapsed(ctx.db);
      let reminded = 0;
      for (const m of ctx.db.memberships) {
        if (ops.isExpiringSoon(ctx.db, ops.findUser(ctx.db, m.user_id) as DbUser, 30) && !m.renewal_reminder_sent) {
          const user = ops.findUser(ctx.db, m.user_id);
          if (!user) continue;
          m.renewal_reminder_sent = true;
          reminded++;
          emailLog(
            ctx.db,
            user.email,
            'Your Skyline membership expires soon',
            `Hi ${user.name},\n\nYour Skyline Student Association membership expires on ${ops.memberCard(ctx.db, user).end_date?.slice(0, 10)}.\nRenew now to keep your ticket and merch discounts.\n\n— Skyline Student Association`,
            'membership',
            m.id,
          );
        }
      }
      return { reminded, expired };
    },
  },
  {
    method: 'POST',
    path: '/memberships/:id/pay',
    auth: true,
    handler: (ctx) => {
      const user = ctx.user as DbUser;
      const membership = ctx.db.memberships.find((m) => m.id === Number(ctx.params.id));
      if (!membership) notFound('Membership not found');
      if (membership.user_id !== user.id && user.role !== 'ADMIN' && user.role !== 'TREASURER') {
        forbidden('You can only pay for your own membership');
      }
      if (membership.status === 'ACTIVE') conflict('Membership is already active');
      const plan = ctx.db.plans.find((p) => p.id === membership.plan_id);
      if (!plan) badRequest('Unknown membership plan');

      membership.status = 'ACTIVE';
      membership.start_date = iso(new Date());
      membership.end_date = academicYearEnd();
      membership.dues_paid = true;
      membership.amount_paid = plan.price;
      membership.renewal_reminder_sent = false;
      assignMemberCode(ctx.db, membership.id);

      const transaction = ops.recordTransaction(ctx.db, {
        type: 'INCOME',
        source: 'DUES',
        amount: plan.price,
        description: `Membership dues — ${user.name} (${plan.name})`,
        reference_type: 'membership',
        reference_id: membership.id,
        created_by_id: user.id,
      });
      emailLog(
        ctx.db,
        user.email,
        'Membership confirmed — welcome to Skyline',
        `Hi ${user.name},\n\nYour ${plan.name} membership is active until ${membership.end_date?.slice(0, 10)}.\nMember code: ${membership.member_code}\n\nShow your digital membership card at the door.\n\n— Skyline Student Association`,
        'membership',
        membership.id,
      );
      return { membership: ops.memberView(ctx.db, membership), transaction: ops.transactionView(ctx.db, transaction) };
    },
  },
  {
    method: 'POST',
    path: '/memberships/:id/mark-paid',
    roles: ['ADMIN', 'TREASURER'],
    handler: (ctx) => {
      const membership = ctx.db.memberships.find((m) => m.id === Number(ctx.params.id));
      if (!membership) notFound('Membership not found');
      const plan = ctx.db.plans.find((p) => p.id === membership.plan_id);
      if (!plan) badRequest('Unknown membership plan');
      membership.status = 'ACTIVE';
      membership.start_date = membership.start_date ?? iso(new Date());
      membership.end_date = academicYearEnd();
      membership.dues_paid = true;
      membership.amount_paid = plan.price;
      assignMemberCode(ctx.db, membership.id);
      ops.recordTransaction(ctx.db, {
        type: 'INCOME',
        source: 'DUES',
        amount: plan.price,
        description: `Membership dues (cash) — ${ops.findUser(ctx.db, membership.user_id)?.name ?? 'Member'}`,
        reference_type: 'membership',
        reference_id: membership.id,
        created_by_id: (ctx.user as DbUser).id,
      });
      return { membership: ops.memberView(ctx.db, membership) };
    },
  },

  /* ----------------------------------------------------------------- members */
  {
    method: 'GET',
    path: '/members/export.csv',
    roles: ['ADMIN', 'TREASURER'],
    handler: (ctx) => {
      ops.expireLapsed(ctx.db);
      const rows = ctx.db.users
        .filter((u) => {
          if (ctx.query.status && ctx.query.status !== 'ALL') {
            if (ctx.query.status === 'EXPIRING_30' && !ops.isExpiringSoon(ctx.db, u)) return false;
            if (ctx.query.status === 'ACTIVE' && ops.membershipOf(ctx.db, u.id)?.status !== 'ACTIVE') return false;
            if (ctx.query.status === 'EXPIRED' && ops.membershipOf(ctx.db, u.id)?.status !== 'EXPIRED') return false;
            if (ctx.query.status === 'PENDING' && ops.membershipOf(ctx.db, u.id)?.status !== 'PENDING_PAYMENT') return false;
          }
          return true;
        })
        .map((u) => ops.memberRow(ctx.db, u));
      const csv = toCsv(
        ['Name', 'Email', 'Student ID', 'Phone', 'Role', 'Plan', 'Status', 'Dues paid', 'Expires', 'Member code'],
        rows.map((r) => [r.name, r.email, r.student_id, r.phone, r.role, r.plan_name, r.membership_status, r.dues_paid ? 'yes' : 'no', r.end_date?.slice(0, 10) ?? '', r.member_code]),
      );
      return { csv, filename: 'skyline-members.csv' };
    },
  },
  {
    method: 'GET',
    path: '/members/verify',
    handler: (ctx) => ops.verify(ctx.db, ctx.query.code ?? null, ctx.query.q ?? null),
  },
  {
    method: 'GET',
    path: '/members',
    roles: ['ADMIN', 'TREASURER'],
    handler: (ctx) => {
      ops.expireLapsed(ctx.db);
      const search = (ctx.query.search ?? '').trim().toLowerCase();
      const status = ctx.query.status ?? 'ALL';
      let entries = ctx.db.users.map((user) => ({ user, row: ops.memberRow(ctx.db, user) }));
      if (search) {
        entries = entries.filter(({ row }) =>
          [row.name, row.email, row.student_id ?? '', row.member_code ?? ''].some((v) => v.toLowerCase().includes(search)),
        );
      }
      if (status === 'EXPIRING_30') entries = entries.filter(({ user }) => ops.isExpiringSoon(ctx.db, user));
      else if (status === 'PENDING') entries = entries.filter(({ row }) => row.membership_status === 'PENDING_PAYMENT');
      else if (status !== 'ALL') entries = entries.filter(({ row }) => row.membership_status === status);
      const rows = entries.map(({ row }) => row).sort((a, b) => a.name.localeCompare(b.name));
      return ops.paginate(rows, pageNum(ctx.query), pageSize(ctx.query));
    },
  },
  {
    method: 'POST',
    path: '/members/quick-add',
    roles: ['ADMIN', 'TREASURER'],
    handler: (ctx) => {
      const name = str(ctx.body.name, 'Name');
      const email = str(ctx.body.email, 'Email');
      const planId = int(ctx.body.plan_id, 'Plan');
      const markPaid = ctx.body.mark_dues_paid === true || ctx.body.mark_dues_paid === 'true';
      if (ops.findUserByEmail(ctx.db, email)) conflict('A member with this email already exists');
      const plan = ctx.db.plans.find((p) => p.id === planId);
      if (!plan) badRequest('Unknown membership plan');

      const user: DbUser = {
        id: nextId(ctx.db, 'users'),
        name,
        email,
        password: 'skyline123',
        phone: optStr(ctx.body.phone),
        student_id: optStr(ctx.body.student_id),
        role: 'MEMBER',
        created_at: iso(new Date()),
      };
      ctx.db.users.push(user);
      const membership = {
        id: nextId(ctx.db, 'memberships'),
        user_id: user.id,
        plan_id: plan.id,
        status: markPaid ? ('ACTIVE' as const) : ('PENDING_PAYMENT' as const),
        start_date: markPaid ? iso(new Date()) : null,
        end_date: markPaid ? academicYearEnd() : null,
        dues_paid: markPaid,
        amount_paid: markPaid ? plan.price : 0,
        member_code: null as string | null,
        renewal_reminder_sent: false,
      };
      ctx.db.memberships.push(membership);
      if (markPaid) {
        assignMemberCode(ctx.db, membership.id);
        ops.recordTransaction(ctx.db, {
          type: 'INCOME',
          source: 'DUES',
          amount: plan.price,
          description: `Membership dues (cash) — ${user.name}`,
          reference_type: 'membership',
          reference_id: membership.id,
          created_by_id: (ctx.user as DbUser).id,
        });
      }
      emailLog(
        ctx.db,
        user.email,
        markPaid ? 'Welcome to Skyline — membership active' : 'Welcome to Skyline — complete your payment',
        markPaid
          ? `Hi ${name},\n\nYour ${plan.name} membership is active. Member code: ${membership.member_code}.`
          : `Hi ${name},\n\nYou've been added to Skyline Hub. Your ${plan.name} membership is pending payment of $${plan.price}.`,
        'membership',
        membership.id,
      );
      return {
        user: ops.toUser(user),
        membership: ops.memberView(ctx.db, membership),
        temp_password: markPaid ? 'skyline123' : null,
      };
    },
  },
  {
    method: 'GET',
    path: '/members/:id',
    roles: ['ADMIN', 'TREASURER'],
    handler: (ctx) => {
      const user = ctx.db.users.find((u) => u.id === Number(ctx.params.id));
      if (!user) notFound('Member not found');
      const membership = ops.membershipOf(ctx.db, user.id);
      const tickets = ctx.db.tickets.filter((t) => t.user_id === user.id).map((t) => ops.ticketView(ctx.db, t));
      const orders = ctx.db.orders.filter((o) => o.user_id === user.id).map((o) => ops.orderView(ctx.db, o));
      return {
        user: ops.toUser(user),
        membership: membership ? ops.memberView(ctx.db, membership) : null,
        plan: ops.planOf(ctx.db, membership?.plan_id) ?? null,
        tickets,
        orders,
        totals: {
          spent_on_tickets: money(tickets.reduce((s, t) => s + t.price_paid, 0)),
          spent_on_merch: money(orders.filter((o) => o.status !== 'CANCELLED').reduce((s, o) => s + o.total, 0)),
        },
      };
    },
  },

  /* ------------------------------------------------------------------ events */
  {
    method: 'GET',
    path: '/events',
    handler: (ctx) => {
      const upcoming = ctx.query.upcoming === 'true';
      const status = ctx.query.status;
      const search = (ctx.query.search ?? '').trim().toLowerCase();
      let events = ctx.db.events.slice();
      if (status) events = events.filter((e) => e.status === status);
      if (upcoming) events = events.filter((e) => new Date(e.start_date).getTime() >= Date.now() - DAY);
      if (search) events = events.filter((e) => e.title.toLowerCase().includes(search) || e.location.toLowerCase().includes(search));
      events.sort((a, b) => a.start_date.localeCompare(b.start_date));
      const cards = events.map((e) => ops.eventCard(ctx.db, e));
      return ops.paginate(cards, pageNum(ctx.query), pageSize(ctx.query, 50));
    },
  },
  {
    method: 'POST',
    path: '/events',
    roles: ['ADMIN', 'TREASURER'],
    handler: async (ctx) => {
      const image_url = ctx.files.image ? await fileToDataUrl(ctx.files.image) : optStr(ctx.body.image_url);
      const event: DbEvent = {
        id: nextId(ctx.db, 'events'),
        title: str(ctx.body.title, 'Title'),
        description: typeof ctx.body.description === 'string' ? ctx.body.description : '',
        location: str(ctx.body.location, 'Location'),
        start_date: str(ctx.body.start_date, 'Start date'),
        end_date: str(ctx.body.end_date, 'End date'),
        image_url,
        capacity: int(ctx.body.capacity, 'Capacity'),
        member_price: money(num(ctx.body.member_price, 'Member price')),
        non_member_price: money(num(ctx.body.non_member_price, 'Non-member price')),
        status: (optStr(ctx.body.status) as DbEvent['status']) ?? 'DRAFT',
        created_at: iso(new Date()),
      };
      if (event.capacity < 1) badRequest('Capacity must be at least 1');
      if (new Date(event.end_date) < new Date(event.start_date)) badRequest('End date must be after the start date');
      ctx.db.events.push(event);
      return ops.eventCard(ctx.db, event);
    },
  },
  {
    method: 'GET',
    path: '/events/:id/report',
    roles: ['ADMIN', 'TREASURER'],
    handler: (ctx) => {
      const event = ctx.db.events.find((e) => e.id === Number(ctx.params.id));
      if (!event) notFound('Event not found');
      return ops.eventReport(ctx.db, event);
    },
  },
  {
    method: 'GET',
    path: '/events/:id',
    handler: (ctx) => {
      const event = ctx.db.events.find((e) => e.id === Number(ctx.params.id));
      if (!event) notFound('Event not found');
      return ops.eventDetail(ctx.db, event, ctx.user?.id ?? null);
    },
  },
  {
    method: 'PATCH',
    path: '/events/:id',
    roles: ['ADMIN', 'TREASURER'],
    handler: async (ctx) => {
      const event = ctx.db.events.find((e) => e.id === Number(ctx.params.id));
      if (!event) notFound('Event not found');
      const b = ctx.body;
      if (typeof b.title === 'string') event.title = b.title.trim();
      if (typeof b.description === 'string') event.description = b.description;
      if (typeof b.location === 'string') event.location = b.location.trim();
      if (typeof b.start_date === 'string') event.start_date = b.start_date;
      if (typeof b.end_date === 'string') event.end_date = b.end_date;
      if (b.capacity !== undefined) event.capacity = int(b.capacity, 'Capacity');
      if (b.member_price !== undefined) event.member_price = money(num(b.member_price, 'Member price'));
      if (b.non_member_price !== undefined) event.non_member_price = money(num(b.non_member_price, 'Non-member price'));
      if (typeof b.status === 'string') event.status = b.status as DbEvent['status'];
      if (ctx.files.image) event.image_url = await fileToDataUrl(ctx.files.image);
      return ops.eventCard(ctx.db, event);
    },
  },
  {
    method: 'DELETE',
    path: '/events/:id',
    roles: ['ADMIN'],
    handler: (ctx) => {
      const idx = ctx.db.events.findIndex((e) => e.id === Number(ctx.params.id));
      if (idx === -1) notFound('Event not found');
      const sold = ops.soldCount(ctx.db, Number(ctx.params.id));
      if (sold > 0) {
        ctx.db.events[idx].status = 'CANCELLED';
        return { deleted: false, cancelled: true, tickets_sold: sold };
      }
      ctx.db.events.splice(idx, 1);
      return { deleted: true, cancelled: false };
    },
  },

  /* ------------------------------------------------- tickets & check-in JS  */
  {
    method: 'POST',
    path: '/events/:id/tickets/checkout',
    handler: (ctx) => {
      const event = ctx.db.events.find((e) => e.id === Number(ctx.params.id));
      if (!event) notFound('Event not found');
      if (event.status !== 'PUBLISHED') conflict('Tickets are not on sale for this event');
      const quantity = int(ctx.body.quantity ?? 1, 'Quantity');
      if (quantity < 1 || quantity > 10) badRequest('Quantity must be between 1 and 10');

      const sold = ops.soldCount(ctx.db, event.id);
      if (sold + quantity > event.capacity) {
        conflict(`Event is sold out — only ${Math.max(0, event.capacity - sold)} seats left`);
      }

      const user = ctx.user;
      const isMember = user ? ops.discountPercents(ctx.db, user.id).isMember : false;
      const unitPrice = isMember ? event.member_price : event.non_member_price;
      const buyerName = user?.name ?? str(ctx.body.buyer_name ?? '', 'Full name');
      const buyerEmail = user?.email ?? str(ctx.body.buyer_email ?? '', 'Email');
      if (!user && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(buyerEmail)) badRequest('Enter a valid email address');

      const checkout = {
        id: `co-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`,
        kind: 'TICKET' as const,
        event_id: event.id,
        user_id: user?.id ?? null,
        buyer_name: buyerName,
        buyer_email: buyerEmail,
        quantity,
        unit_price: unitPrice,
        is_member_price: isMember,
        total: money(unitPrice * quantity),
        created_at: iso(new Date()),
        expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
      };
      ctx.db.checkouts.push(checkout);
      return {
        checkout_id: checkout.id,
        event_id: event.id,
        event_title: event.title,
        quantity,
        unit_price: unitPrice,
        is_member_price: isMember,
        subtotal: checkout.total,
        total: checkout.total,
        expires_at: checkout.expires_at,
      };
    },
  },
  {
    method: 'POST',
    path: '/tickets/checkout/:checkoutId/pay',
    handler: (ctx) => {
      const index = ctx.db.checkouts.findIndex((c) => c.id === ctx.params.checkoutId);
      if (index === -1) notFound('This checkout has already been paid or has expired');
      const checkout = ctx.db.checkouts[index];
      if (new Date(checkout.expires_at).getTime() < Date.now()) {
        ctx.db.checkouts.splice(index, 1);
        gone('This checkout expired — please start again');
      }
      const event = ctx.db.events.find((e) => e.id === checkout.event_id);
      if (!event) notFound('Event not found');

      const sold = ops.soldCount(ctx.db, event.id);
      if (sold + checkout.quantity > event.capacity) {
        conflict(`Event is sold out — only ${Math.max(0, event.capacity - sold)} seats left`);
      }

      const tickets = [];
      for (let i = 0; i < checkout.quantity; i++) {
        const ticket = {
          id: nextId(ctx.db, 'tickets'),
          event_id: event.id,
          user_id: checkout.user_id,
          buyer_name: checkout.buyer_name,
          buyer_email: checkout.buyer_email,
          price_paid: checkout.unit_price,
          is_member_price: checkout.is_member_price,
          ticket_code: uniqueTicketCode(ctx.db),
          status: 'VALID' as const,
          checked_in_at: null,
          checked_in_by_id: null,
          created_at: iso(new Date()),
        };
        ctx.db.tickets.push(ticket);
        tickets.push(ticket);
      }
      ctx.db.checkouts.splice(index, 1);

      const transaction = ops.recordTransaction(ctx.db, {
        type: 'INCOME',
        source: 'TICKET',
        amount: checkout.total,
        description: `Ticket sale — ${event.title} (${checkout.quantity}×${checkout.is_member_price ? 'member' : 'guest'})`,
        reference_type: 'event',
        reference_id: event.id,
        created_by_id: checkout.user_id,
      });
      emailLog(
        ctx.db,
        checkout.buyer_email,
        `Your ticket(s) for ${event.title}`,
        `Hi ${checkout.buyer_name},\n\nYour ${checkout.quantity} ticket(s) for ${event.title} are confirmed.\nTicket codes: ${tickets.map((t) => t.ticket_code).join(', ')}\nShow the QR code at the door.\n\n— Skyline Student Association`,
        'ticket',
        event.id,
      );

      return {
        tickets: tickets.map((t) => ops.ticketView(ctx.db, t)),
        transaction: ops.transactionView(ctx.db, transaction),
        emailed_to: checkout.buyer_email,
      };
    },
  },
  {
    method: 'GET',
    path: '/tickets/mine',
    auth: true,
    handler: (ctx) =>
      ctx.db.tickets
        .filter((t) => t.user_id === (ctx.user as DbUser).id)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((t) => ops.ticketView(ctx.db, t)),
  },
  {
    method: 'GET',
    path: '/tickets/:code',
    handler: (ctx) => {
      const ticket = ctx.db.tickets.find((t) => t.ticket_code.toLowerCase() === ctx.params.code.toLowerCase());
      if (!ticket) notFound('Ticket not found');
      return ops.ticketView(ctx.db, ticket);
    },
  },
  {
    method: 'POST',
    path: '/checkin',
    roles: ['ADMIN', 'TREASURER', 'VOLUNTEER'],
    handler: (ctx) => {
      const code = str(ctx.body.ticket_code, 'Ticket code');
      return ops.checkout(ctx.db, code, ctx.user);
    },
  },
  {
    method: 'GET',
    path: '/checkin/stats',
    roles: ['ADMIN', 'TREASURER', 'VOLUNTEER'],
    handler: (ctx) => {
      const eventId = ctx.query.event_id ? Number(ctx.query.event_id) : null;
      const tickets = ctx.db.tickets.filter((t) => t.status !== 'CANCELLED' && (eventId === null || t.event_id === eventId));
      const checked = tickets.filter((t) => t.status === 'CHECKED_IN').length;
      return {
        checked_in: checked,
        total_valid: tickets.length,
        attendance_pct: tickets.length ? Math.round((checked / tickets.length) * 100) : 0,
      };
    },
  },

  /* ----------------------------------------------------------- announcements */
  {
    method: 'GET',
    path: '/announcements',
    handler: (ctx) => {
      const category = ctx.query.category;
      let items = ctx.db.announcements.slice().sort((a, b) => b.published_at.localeCompare(a.published_at));
      if (category && category !== 'ALL') items = items.filter((a) => a.category === category);
      const search = (ctx.query.search ?? '').trim().toLowerCase();
      if (search) items = items.filter((a) => a.title.toLowerCase().includes(search) || a.body.toLowerCase().includes(search));
      return ops.paginate(
        items.map((a) => ({ ...a, author_name: ops.findUser(ctx.db, a.author_id)?.name ?? 'Admin' })),
        pageNum(ctx.query),
        pageSize(ctx.query, 20),
      );
    },
  },
  {
    method: 'POST',
    path: '/announcements',
    roles: ['ADMIN', 'TREASURER'],
    handler: (ctx) => {
      const user = ctx.user as DbUser;
      const sendEmail = ctx.body.send_email === true || ctx.body.send_email === 'true';
      const announcement = {
        id: nextId(ctx.db, 'announcements'),
        title: str(ctx.body.title, 'Title'),
        body: str(ctx.body.body, 'Body'),
        category: ((optStr(ctx.body.category) ?? 'GENERAL') as 'MEETING' | 'DEADLINE' | 'CHANGE_OF_PLAN' | 'GENERAL'),
        author_id: user.id,
        published_at: iso(new Date()),
        email_sent: sendEmail,
        recipient_count: 0,
      };
      ctx.db.announcements.push(announcement);
      let recipientCount = 0;
      if (sendEmail) {
        const recipients = ops.announcementRecipients(ctx.db);
        recipients.forEach((r) => emailLog(ctx.db, r.email, announcement.title, announcement.body, 'announcement', announcement.id));
        recipientCount = recipients.length;
        announcement.recipient_count = recipientCount;
      }
      return {
        announcement: { ...announcement, author_name: user.name },
        recipient_count: recipientCount,
        emailed: sendEmail,
      };
    },
  },
  {
    method: 'PATCH',
    path: '/announcements/:id',
    roles: ['ADMIN'],
    handler: (ctx) => {
      const a = ctx.db.announcements.find((x) => x.id === Number(ctx.params.id));
      if (!a) notFound('Announcement not found');
      if (typeof ctx.body.title === 'string') a.title = ctx.body.title;
      if (typeof ctx.body.body === 'string') a.body = ctx.body.body;
      if (typeof ctx.body.category === 'string') a.category = ctx.body.category as typeof a.category;
      return { ...a, author_name: ops.findUser(ctx.db, a.author_id)?.name ?? 'Admin' };
    },
  },
  {
    method: 'DELETE',
    path: '/announcements/:id',
    roles: ['ADMIN'],
    handler: (ctx) => {
      const idx = ctx.db.announcements.findIndex((x) => x.id === Number(ctx.params.id));
      if (idx === -1) notFound('Announcement not found');
      ctx.db.announcements.splice(idx, 1);
      return { deleted: true };
    },
  },

  /* -------------------------------------------------------------- newsletter */
  {
    method: 'POST',
    path: '/newsletter/subscribe',
    handler: (ctx) => {
      const email = str(ctx.body.email, 'Email');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) badRequest('Enter a valid email address');
      const existing = ctx.db.subscribers.find((s) => s.email.toLowerCase() === email.toLowerCase());
      if (existing && existing.subscribed) conflict('This email is already on the mailing list');
      if (existing) {
        existing.subscribed = true;
        return { subscribed: true, email: existing.email };
      }
      ctx.db.subscribers.push({
        id: nextId(ctx.db, 'subscribers'),
        email,
        name: optStr(ctx.body.name),
        user_id: null,
        subscribed: true,
        unsubscribe_token: `unsub-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`,
      });
      return { subscribed: true, email };
    },
  },
  {
    method: 'GET',
    path: '/newsletter/unsubscribe/:token',
    handler: (ctx) => {
      const sub = ctx.db.subscribers.find((s) => s.unsubscribe_token === ctx.params.token);
      if (!sub) notFound('This unsubscribe link is not valid');
      sub.subscribed = false;
      return { unsubscribed: true, email: sub.email };
    },
  },

  /* ------------------------------------------------------------------ emails */
  {
    method: 'GET',
    path: '/emails',
    roles: ['ADMIN', 'TREASURER'],
    handler: (ctx) => {
      const search = (ctx.query.search ?? '').trim().toLowerCase();
      let logs = ctx.db.email_logs.slice().sort((a, b) => b.sent_at.localeCompare(a.sent_at));
      if (search) {
        logs = logs.filter((l) => l.to_email.toLowerCase().includes(search) || l.subject.toLowerCase().includes(search));
      }
      return ops.paginate(logs, pageNum(ctx.query), pageSize(ctx.query, 25));
    },
  },

  /* ------------------------------------------------------------------ store */
  {
    method: 'GET',
    path: '/products',
    handler: (ctx) => {
      const activeOnly = ctx.query.active_only !== 'false';
      return ctx.db.products
        .filter((p) => !activeOnly || p.active)
        .map((p) => ops.productView(ctx.db, p));
    },
  },
  {
    method: 'POST',
    path: '/products',
    roles: ['ADMIN'],
    handler: async (ctx) => {
      // accepts either multipart (JSON string from the admin UI) or a plain JSON body
      const variantsRaw = ctx.body.variants;
      const variants: { size: Size; stock: number }[] =
        typeof variantsRaw === 'string'
          ? (JSON.parse(variantsRaw) as { size: Size; stock: number }[])
          : Array.isArray(variantsRaw)
            ? (variantsRaw as { size: Size; stock: number }[])
            : [];
      const product: DbProduct = {
        id: nextId(ctx.db, 'products'),
        name: str(ctx.body.name, 'Name'),
        description: typeof ctx.body.description === 'string' ? ctx.body.description : '',
        image_url: ctx.files.image ? await fileToDataUrl(ctx.files.image) : null,
        base_price: money(num(ctx.body.base_price, 'Price')),
        active: ctx.body.active !== 'false' && ctx.body.active !== false,
      };
      ctx.db.products.push(product);
      const sizes: Size[] = variants.length ? variants.map((v) => v.size) : (['XS', 'S', 'M', 'L', 'XL', 'XXL'] as Size[]);
      sizes.forEach((size) => {
        const found = variants.find((v) => v.size === size);
        ctx.db.variants.push({
          id: nextId(ctx.db, 'variants'),
          product_id: product.id,
          size,
          stock: found ? int(found.stock, 'Stock') : 0,
        });
      });
      return ops.productView(ctx.db, product);
    },
  },
  {
    method: 'GET',
    path: '/products/:id',
    handler: (ctx) => {
      const product = ctx.db.products.find((p) => p.id === Number(ctx.params.id));
      if (!product) notFound('Product not found');
      return ops.productView(ctx.db, product);
    },
  },
  {
    method: 'PATCH',
    path: '/products/:id',
    roles: ['ADMIN'],
    handler: async (ctx) => {
      const product = ctx.db.products.find((p) => p.id === Number(ctx.params.id));
      if (!product) notFound('Product not found');
      if (typeof ctx.body.name === 'string') product.name = ctx.body.name;
      if (typeof ctx.body.description === 'string') product.description = ctx.body.description;
      if (ctx.body.base_price !== undefined) product.base_price = money(num(ctx.body.base_price, 'Price'));
      if (ctx.body.active !== undefined) product.active = ctx.body.active !== 'false' && ctx.body.active !== false;
      if (ctx.files.image) product.image_url = await fileToDataUrl(ctx.files.image);
      const variantsBody = typeof ctx.body.variants === 'string' ? JSON.parse(ctx.body.variants) : ctx.body.variants;
      if (Array.isArray(variantsBody) || typeof ctx.body.variants === 'string') {
        const variants = (Array.isArray(variantsBody) ? variantsBody : []) as { id?: number; size: Size; stock: number }[];
        variants.forEach((v) => {
          const existing = ctx.db.variants.find(
            (x) => x.product_id === product.id && (v.id ? x.id === v.id : x.size === v.size),
          );
          if (existing) existing.stock = Math.max(0, int(v.stock, 'Stock'));
          else
            ctx.db.variants.push({
              id: nextId(ctx.db, 'variants'),
              product_id: product.id,
              size: v.size,
              stock: Math.max(0, int(v.stock, 'Stock')),
            });
        });
      }
      return ops.productView(ctx.db, product);
    },
  },
  {
    method: 'DELETE',
    path: '/products/:id',
    roles: ['ADMIN'],
    handler: (ctx) => {
      const product = ctx.db.products.find((p) => p.id === Number(ctx.params.id));
      if (!product) notFound('Product not found');
      product.active = false;
      return { deleted: true };
    },
  },
  {
    method: 'PATCH',
    path: '/variants/:id',
    roles: ['ADMIN'],
    handler: (ctx) => {
      const variant = ctx.db.variants.find((v) => v.id === Number(ctx.params.id));
      if (!variant) notFound('Variant not found');
      variant.stock = Math.max(0, int(ctx.body.stock, 'Stock'));
      return variant;
    },
  },

  /* ----------------------------------------------------------------- orders */
  {
    method: 'GET',
    path: '/orders/size-summary',
    roles: ['ADMIN', 'TREASURER'],
    handler: (ctx) => ops.sizeSummary(ctx.db),
  },
  {
    method: 'GET',
    path: '/orders/mine',
    auth: true,
    handler: (ctx) =>
      ctx.db.orders
        .filter((o) => o.user_id === (ctx.user as DbUser).id)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((o) => ops.orderView(ctx.db, o)),
  },
  {
    method: 'POST',
    path: '/orders/checkout',
    handler: (ctx) => {
      const rawItems = Array.isArray(ctx.body.items) ? (ctx.body.items as { variant_id: number; quantity: number }[]) : [];
      if (!rawItems.length) badRequest('Your cart is empty');
      const user = ctx.user;
      const buyerEmail = user?.email ?? str(ctx.body.buyer_email ?? '', 'Email');
      const buyerName = user?.name ?? str(ctx.body.buyer_name ?? '', 'Full name');

      const lines = rawItems.map((item) => {
        const variant = ctx.db.variants.find((v) => v.id === Number(item.variant_id));
        if (!variant) badRequest('One of the items in your cart no longer exists');
        const product = ctx.db.products.find((p) => p.id === variant.product_id);
        const quantity = int(item.quantity, 'Quantity');
        if (quantity < 1) badRequest('Quantity must be at least 1');
        if (variant.stock < quantity) {
          conflict(`Not enough stock for ${product?.name ?? 'item'} size ${variant.size} — only ${variant.stock} left`);
        }
        return { variant, product, quantity, unitPrice: product?.base_price ?? 0 };
      });

      const subtotal = money(lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0));
      const { merch, isMember } = ops.discountPercents(ctx.db, user?.id ?? null);
      const discount = money((subtotal * merch) / 100);
      const order = {
        id: nextId(ctx.db, 'orders'),
        user_id: user?.id ?? null,
        buyer_name: buyerName,
        buyer_email: buyerEmail,
        status: 'PENDING' as const,
        subtotal,
        discount,
        discount_percent: isMember ? merch : 0,
        total: money(subtotal - discount),
        is_member_discount: isMember && merch > 0,
        created_at: iso(new Date()),
      };
      ctx.db.orders.push(order);
      lines.forEach((l) => {
        ctx.db.order_items.push({
          id: nextId(ctx.db, 'order_items'),
          order_id: order.id,
          variant_id: l.variant.id,
          quantity: l.quantity,
          unit_price: l.unitPrice,
        });
      });
      return ops.orderView(ctx.db, order);
    },
  },
  {
    method: 'GET',
    path: '/orders',
    roles: ['ADMIN', 'TREASURER'],
    handler: (ctx) => {
      const status = ctx.query.status;
      let orders = ctx.db.orders.slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
      if (status && status !== 'ALL') orders = orders.filter((o) => o.status === status);
      return ops.paginate(orders.map((o) => ops.orderView(ctx.db, o)), pageNum(ctx.query), pageSize(ctx.query));
    },
  },
  {
    method: 'POST',
    path: '/orders/:id/pay',
    auth: true,
    handler: (ctx) => {
      const order = ctx.db.orders.find((o) => o.id === Number(ctx.params.id));
      if (!order) notFound('Order not found');
      const user = ctx.user as DbUser;
      if (order.user_id !== user.id && user.role !== 'ADMIN' && user.role !== 'TREASURER') {
        forbidden('You can only pay for your own orders');
      }
      if (order.status === 'PAID' || order.status === 'FULFILLED') conflict('This order is already paid');
      if (order.status === 'CANCELLED') conflict('This order was cancelled');

      const items = ctx.db.order_items.filter((i) => i.order_id === order.id);
      const locked: { variantId: number; stock: number; name: string }[] = [];
      for (const item of items) {
        const variant = ctx.db.variants.find((v) => v.id === item.variant_id);
        if (!variant) notFound('A product in this order no longer exists');
        const product = ctx.db.products.find((p) => p.id === variant.product_id);
        if (variant.stock < item.quantity) {
          throw new MockError(
            409,
            `Not enough stock for ${product?.name ?? 'item'} size ${variant.size} — only ${variant.stock} left`,
          );
        }
        locked.push({ variantId: variant.id, stock: variant.stock, name: `${product?.name ?? 'Item'} ${variant.size}` });
      }
      // Stock decrement happens only after every line is verified — no partial writes.
      locked.forEach((l) => {
        const variant = ctx.db.variants.find((v) => v.id === l.variantId);
        if (variant) variant.stock -= items.find((i) => i.variant_id === l.variantId)!.quantity;
      });

      order.status = 'PAID';
      const transaction = ops.recordTransaction(ctx.db, {
        type: 'INCOME',
        source: 'MERCH',
        amount: order.total,
        description: `Merch order #${order.id} — ${items.length} line${items.length === 1 ? '' : 's'}`,
        reference_type: 'order',
        reference_id: order.id,
        created_by_id: user.id,
      });
      emailLog(
        ctx.db,
        order.buyer_email,
        `Order #${order.id} confirmed`,
        `Hi ${order.buyer_name},\n\nYour merch order #${order.id} is confirmed.\nTotal paid: $${order.total.toFixed(2)}${order.is_member_discount ? ` (${order.discount_percent}% member discount applied)` : ''}\n\nPick up at the union office on Tuesdays 2–4pm.\n\n— Skyline Student Association`,
        'order',
        order.id,
      );
      return { order: ops.orderView(ctx.db, order), transaction: ops.transactionView(ctx.db, transaction) };
    },
  },
  {
    method: 'PATCH',
    path: '/orders/:id/status',
    roles: ['ADMIN', 'TREASURER'],
    handler: (ctx) => {
      const order = ctx.db.orders.find((o) => o.id === Number(ctx.params.id));
      if (!order) notFound('Order not found');
      const status = str(ctx.body.status, 'Status') as typeof order.status;
      if (!['PENDING', 'PAID', 'FULFILLED', 'CANCELLED'].includes(status)) badRequest('Unknown order status');
      if (status === 'CANCELLED' && order.status === 'CANCELLED') conflict('Order is already cancelled');
      if (status === 'CANCELLED' && (order.status === 'PAID' || order.status === 'FULFILLED')) {
        // restore stock for anything that had been decremented
        ctx.db.order_items
          .filter((i) => i.order_id === order.id)
          .forEach((i) => {
            const variant = ctx.db.variants.find((v) => v.id === i.variant_id);
            if (variant) variant.stock += i.quantity;
          });
      }
      order.status = status;
      return ops.orderView(ctx.db, order);
    },
  },

  /* ------------------------------------------------------------ fundraisers */
  {
    method: 'GET',
    path: '/fundraisers',
    auth: true,
    handler: (ctx) =>
      ctx.db.fundraisers.map((f) => ({ ...f, progress: ops.progressFor(ctx.db, f) })),
  },
  {
    method: 'POST',
    path: '/fundraisers',
    roles: ['ADMIN', 'TREASURER'],
    handler: (ctx) => {
      const fundraiser = {
        id: nextId(ctx.db, 'fundraisers'),
        title: str(ctx.body.title, 'Title'),
        description: typeof ctx.body.description === 'string' ? ctx.body.description : '',
        goal_amount: money(num(ctx.body.goal_amount, 'Goal amount')),
        raised_amount: 0,
        event_date: str(ctx.body.event_date, 'Event date'),
        status: (optStr(ctx.body.status) as 'PLANNING' | 'ACTIVE' | 'COMPLETED') ?? 'PLANNING',
      };
      if (fundraiser.goal_amount <= 0) badRequest('Goal amount must be greater than zero');
      ctx.db.fundraisers.push(fundraiser);
      return { ...fundraiser, progress: ops.progressFor(ctx.db, fundraiser) };
    },
  },
  {
    method: 'GET',
    path: '/fundraisers/:id',
    auth: true,
    handler: (ctx) => {
      const fundraiser = ctx.db.fundraisers.find((f) => f.id === Number(ctx.params.id));
      if (!fundraiser) notFound('Fundraiser not found');
      return ops.fundraiserDetail(ctx.db, fundraiser);
    },
  },
  {
    method: 'PATCH',
    path: '/fundraisers/:id',
    roles: ['ADMIN', 'TREASURER'],
    handler: (ctx) => {
      const f = ctx.db.fundraisers.find((x) => x.id === Number(ctx.params.id));
      if (!f) notFound('Fundraiser not found');
      if (typeof ctx.body.title === 'string') f.title = ctx.body.title;
      if (typeof ctx.body.description === 'string') f.description = ctx.body.description;
      if (ctx.body.goal_amount !== undefined) f.goal_amount = money(num(ctx.body.goal_amount, 'Goal amount'));
      if (typeof ctx.body.event_date === 'string') f.event_date = ctx.body.event_date;
      if (typeof ctx.body.status === 'string') f.status = ctx.body.status as typeof f.status;
      return { ...f, progress: ops.progressFor(ctx.db, f) };
    },
  },
  {
    method: 'POST',
    path: '/fundraisers/:id/income',
    roles: ['ADMIN', 'TREASURER'],
    handler: (ctx) => {
      const f = ctx.db.fundraisers.find((x) => x.id === Number(ctx.params.id));
      if (!f) notFound('Fundraiser not found');
      const amount = money(num(ctx.body.amount, 'Amount'));
      if (amount <= 0) badRequest('Amount must be greater than zero');
      f.raised_amount = money(f.raised_amount + amount);
      const transaction = ops.recordTransaction(ctx.db, {
        type: 'INCOME',
        source: 'FUNDRAISER',
        amount,
        description: optStr(ctx.body.description) ?? `Fundraiser income — ${f.title}`,
        reference_type: 'fundraiser',
        reference_id: f.id,
        created_by_id: (ctx.user as DbUser).id,
        date: optStr(ctx.body.date) ?? undefined,
      });
      return { fundraiser: { ...f, progress: ops.progressFor(ctx.db, f) }, transaction: ops.transactionView(ctx.db, transaction) };
    },
  },
  {
    method: 'POST',
    path: '/fundraisers/:id/tasks',
    roles: ['ADMIN', 'TREASURER', 'VOLUNTEER'],
    handler: (ctx) => {
      const f = ctx.db.fundraisers.find((x) => x.id === Number(ctx.params.id));
      if (!f) notFound('Fundraiser not found');
      const status = (optStr(ctx.body.status) as DbTask['status']) ?? 'TODO';
      const position = ctx.db.tasks.filter((t) => t.fundraiser_id === f.id && t.status === status).length;
      const task: DbTask = {
        id: nextId(ctx.db, 'tasks'),
        fundraiser_id: f.id,
        title: str(ctx.body.title, 'Title'),
        description: typeof ctx.body.description === 'string' ? ctx.body.description : '',
        assignee_id: ctx.body.assignee_id ? int(ctx.body.assignee_id, 'Assignee') : null,
        due_date: optStr(ctx.body.due_date),
        status,
        priority: (optStr(ctx.body.priority) as DbTask['priority']) ?? 'MEDIUM',
        position,
      };
      ctx.db.tasks.push(task);
      return ops.taskView(ctx.db, task);
    },
  },

  /* ------------------------------------------------------------------ tasks */
  {
    method: 'GET',
    path: '/tasks/mine',
    auth: true,
    handler: (ctx) =>
      ctx.db.tasks
        .filter((t) => t.assignee_id === (ctx.user as DbUser).id)
        .sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'))
        .map((t) => ops.taskView(ctx.db, t)),
  },
  {
    method: 'PATCH',
    path: '/tasks/:id',
    roles: ['ADMIN', 'TREASURER', 'VOLUNTEER'],
    handler: (ctx) => {
      const task = ctx.db.tasks.find((t) => t.id === Number(ctx.params.id));
      if (!task) notFound('Task not found');
      const previousStatus = task.status;

      if (typeof ctx.body.title === 'string' && ctx.body.title.trim()) task.title = ctx.body.title.trim();
      if (typeof ctx.body.description === 'string') task.description = ctx.body.description;
      if (typeof ctx.body.priority === 'string') task.priority = ctx.body.priority as DbTask['priority'];
      if (ctx.body.assignee_id !== undefined) task.assignee_id = ctx.body.assignee_id ? int(ctx.body.assignee_id, 'Assignee') : null;
      if (ctx.body.due_date !== undefined) task.due_date = optStr(ctx.body.due_date);
      if (typeof ctx.body.status === 'string') task.status = ctx.body.status as DbTask['status'];

      const targetStatus = task.status;
      const column = ctx.db.tasks
        .filter((t) => t.fundraiser_id === task.fundraiser_id && t.status === targetStatus && t.id !== task.id)
        .sort((a, b) => a.position - b.position || a.id - b.id);

      const index = ctx.body.position !== undefined ? Math.max(0, Math.min(int(ctx.body.position, 'Position'), column.length)) : column.length;
      column.splice(index, 0, task);
      column.forEach((t, i) => {
        t.position = i;
      });

      if (previousStatus !== targetStatus) {
        const source = ctx.db.tasks
          .filter((t) => t.fundraiser_id === task.fundraiser_id && t.status === previousStatus)
          .sort((a, b) => a.position - b.position || a.id - b.id);
        source.forEach((t, i) => {
          t.position = i;
        });
      }
      return ops.taskView(ctx.db, task);
    },
  },
  {
    method: 'DELETE',
    path: '/tasks/:id',
    roles: ['ADMIN', 'TREASURER'],
    handler: (ctx) => {
      const idx = ctx.db.tasks.findIndex((t) => t.id === Number(ctx.params.id));
      if (idx === -1) notFound('Task not found');
      const [removed] = ctx.db.tasks.splice(idx, 1);
      ctx.db.tasks
        .filter((t) => t.fundraiser_id === removed.fundraiser_id && t.status === removed.status)
        .sort((a, b) => a.position - b.position)
        .forEach((t, i) => {
          t.position = i;
        });
      return { deleted: true };
    },
  },

  /* --------------------------------------------------------------- expenses */
  {
    method: 'POST',
    path: '/expenses',
    auth: true,
    handler: async (ctx) => {
      const user = ctx.user as DbUser;
      const receipt = await requireReceipt(ctx);
      const amount = money(num(ctx.body.amount, 'Amount'));
      if (amount <= 0) badRequest('Amount must be greater than zero');
      const claim: DbExpense = {
        id: nextId(ctx.db, 'expenses'),
        submitted_by_id: user.id,
        fundraiser_id: ctx.body.fundraiser_id ? int(ctx.body.fundraiser_id, 'Fundraiser') : null,
        event_id: ctx.body.event_id ? int(ctx.body.event_id, 'Event') : null,
        description: str(ctx.body.description, 'Description'),
        amount,
        category: str(ctx.body.category, 'Category'),
        receipt_url: receipt.url,
        receipt_name: receipt.name,
        status: 'SUBMITTED',
        reviewed_by_id: null,
        review_note: null,
        created_at: iso(new Date()),
        reviewed_at: null,
        reimbursed_at: null,
      };
      ctx.db.expenses.push(claim);
      return ops.expenseView(ctx.db, claim);
    },
  },
  {
    method: 'GET',
    path: '/expenses/mine',
    auth: true,
    handler: (ctx) =>
      ctx.db.expenses
        .filter((e) => e.submitted_by_id === (ctx.user as DbUser).id)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((e) => ops.expenseView(ctx.db, e)),
  },
  {
    method: 'GET',
    path: '/expenses',
    roles: ['ADMIN', 'TREASURER'],
    handler: (ctx) => {
      const status = ctx.query.status;
      let rows = ctx.db.expenses.slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
      if (status && status !== 'ALL') rows = rows.filter((e) => e.status === status);
      return ops.paginate(rows.map((e) => ops.expenseView(ctx.db, e)), pageNum(ctx.query), pageSize(ctx.query));
    },
  },
  {
    method: 'POST',
    path: '/expenses/:id/approve',
    roles: ['TREASURER', 'ADMIN'],
    handler: (ctx) => {
      const claim = ctx.db.expenses.find((e) => e.id === Number(ctx.params.id));
      if (!claim) notFound('Claim not found');
      if (claim.status === 'REIMBURSED') conflict('This claim has already been reimbursed');
      if (claim.status === 'REJECTED') conflict('This claim was rejected — ask for a new submission');
      claim.status = 'APPROVED';
      claim.reviewed_by_id = (ctx.user as DbUser).id;
      claim.reviewed_at = iso(new Date());
      claim.review_note = optStr(ctx.body?.note);
      return ops.expenseView(ctx.db, claim);
    },
  },
  {
    method: 'POST',
    path: '/expenses/:id/reject',
    roles: ['TREASURER', 'ADMIN'],
    handler: (ctx) => {
      const claim = ctx.db.expenses.find((e) => e.id === Number(ctx.params.id));
      if (!claim) notFound('Claim not found');
      const note = str(ctx.body.note, 'Rejection note');
      if (note.length < 3) badRequest('Please explain why this claim is being rejected');
      if (claim.status === 'REIMBURSED') conflict('This claim has already been reimbursed');
      claim.status = 'REJECTED';
      claim.reviewed_by_id = (ctx.user as DbUser).id;
      claim.reviewed_at = iso(new Date());
      claim.review_note = note;
      return ops.expenseView(ctx.db, claim);
    },
  },
  {
    method: 'POST',
    path: '/expenses/:id/reimburse',
    roles: ['TREASURER', 'ADMIN'],
    handler: (ctx) => {
      const claim = ctx.db.expenses.find((e) => e.id === Number(ctx.params.id));
      if (!claim) notFound('Claim not found');
      if (claim.status === 'REIMBURSED') conflict('This claim has already been reimbursed');
      if (claim.status === 'REJECTED') conflict('Rejected claims cannot be reimbursed');
      claim.status = 'REIMBURSED';
      claim.reimbursed_at = iso(new Date());
      claim.reviewed_by_id = claim.reviewed_by_id ?? (ctx.user as DbUser).id;
      claim.reviewed_at = claim.reviewed_at ?? iso(new Date());
      const transaction = ops.recordTransaction(ctx.db, {
        type: 'EXPENSE',
        source: 'REIMBURSEMENT',
        amount: claim.amount,
        description: `Reimbursement — ${claim.description}`,
        reference_type: 'expense',
        reference_id: claim.id,
        created_by_id: (ctx.user as DbUser).id,
      });
      return { claim: ops.expenseView(ctx.db, claim), transaction: ops.transactionView(ctx.db, transaction) };
    },
  },

  /* ---------------------------------------------------------------- finance */
  {
    method: 'GET',
    path: '/finance/summary',
    roles: ['ADMIN', 'TREASURER'],
    handler: (ctx) => ops.financeSummary(ctx.db, optStr(ctx.query.from), optStr(ctx.query.to)),
  },
  {
    method: 'GET',
    path: '/finance/transactions',
    roles: ['ADMIN', 'TREASURER'],
    handler: (ctx) => {
      const { from, to, type, source } = ctx.query;
      const search = (ctx.query.search ?? '').trim().toLowerCase();
      let rows = ctx.db.transactions.slice();
      if (from) rows = rows.filter((t) => t.date >= from);
      if (to) rows = rows.filter((t) => t.date <= `${to}T23:59:59.999Z`);
      if (type && type !== 'ALL') rows = rows.filter((t) => t.type === type);
      if (source && source !== 'ALL') rows = rows.filter((t) => t.source === source);
      if (search) rows = rows.filter((t) => t.description.toLowerCase().includes(search));
      rows.sort((a, b) => b.date.localeCompare(a.date));
      const totalAmount = money(rows.reduce((s, t) => s + (t.type === 'INCOME' ? t.amount : -t.amount), 0));
      const page = ops.paginate(rows.map((t) => ops.transactionView(ctx.db, t)), pageNum(ctx.query), pageSize(ctx.query, 25));
      return { ...page, net_total: totalAmount };
    },
  },
  {
    method: 'GET',
    path: '/finance/export.csv',
    roles: ['ADMIN', 'TREASURER'],
    handler: (ctx) => {
      const { from, to } = ctx.query;
      let rows = ctx.db.transactions.slice();
      if (from) rows = rows.filter((t) => t.date >= from);
      if (to) rows = rows.filter((t) => t.date <= `${to}T23:59:59.999Z`);
      rows.sort((a, b) => a.date.localeCompare(b.date));
      const csv = toCsv(
        ['Date', 'Type', 'Source', 'Amount', 'Description', 'Reference', 'Recorded by'],
        rows.map((t) => [
          t.date.slice(0, 10),
          t.type,
          t.source,
          t.amount.toFixed(2),
          t.description,
          t.reference_type ? `${t.reference_type}#${t.reference_id ?? ''}` : '',
          ops.findUser(ctx.db, t.created_by_id)?.name ?? '',
        ]),
      );
      return { csv, filename: `skyline-transactions-${from ?? 'all'}_${to ?? 'all'}.csv` };
    },
  },
  {
    method: 'GET',
    path: '/finance/pnl',
    roles: ['ADMIN', 'TREASURER'],
    handler: (ctx) => ops.pnl(ctx.db),
  },

  /* -------------------------------------------------------------- dashboard */
  {
    method: 'GET',
    path: '/dashboard/admin',
    roles: ['ADMIN', 'TREASURER'],
    handler: (ctx) => ops.adminDashboard(ctx.db),
  },
  {
    method: 'GET',
    path: '/dashboard/me',
    auth: true,
    handler: (ctx) => ops.myDashboard(ctx.db, ctx.user as DbUser),
  },

  /* ---------------------------------------------------------------- uploads */
  {
    method: 'POST',
    path: '/uploads',
    auth: true,
    handler: async (ctx) => {
      const file = ctx.files.file ?? Object.values(ctx.files)[0];
      if (!file) badRequest('No file uploaded');
      if (!ALLOWED_RECEIPT.includes(file.type)) badRequest('Allowed file types: jpg, png, pdf');
      if (file.size > MAX_UPLOAD_BYTES) badRequest('File must be 5MB or smaller');
      return { url: await fileToDataUrl(file), name: file.name, size: file.size };
    },
  },
];

export function notFoundHandler(path: string): MockError {
  return new MockError(404, `No mock handler for ${path}. Add it to src/api/mock/handlers.ts.`);
}
