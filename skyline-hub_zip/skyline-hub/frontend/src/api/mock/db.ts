/**
 * In-memory mock database.
 *
 * This is what makes the frontend runnable with NO backend: it holds the full
 * domain state, persists to localStorage after every mutation (so refresh-safe
 * demos work), and is re-seeded deterministically from a fixed plan.
 *
 * It is NOT part of the real application data layer — flip VITE_USE_MOCKS=false
 * and this file is never loaded (dynamic import in mock/index.ts).
 */
import type {
  AnnouncementCategory,
  EventStatus,
  ExpenseStatus,
  FundraiserStatus,
  MembershipStatus,
  OrderStatus,
  Role,
  Size,
  TaskPriority,
  TaskStatus,
  TransactionSource,
  TransactionType,
} from '../types';

/* ------------------------------------------------------------------ helpers */

export const DAY = 86_400_000;

export function iso(d: Date): string {
  return d.toISOString();
}

export function addDays(days: number, hour = 12, minute = 0, base = new Date()): string {
  const d = new Date(base.getTime() + days * DAY);
  d.setHours(hour, minute, 0, 0);
  return iso(d);
}

/** Academic year end (default May 31) — mirrors ACADEMIC_YEAR_END_MONTH/DAY in the backend .env. */
export function academicYearEnd(from = new Date()): string {
  const year = from.getMonth() < 5 ? from.getFullYear() : from.getFullYear() + 1;
  const d = new Date(year, 4, 31, 23, 59, 59);
  return iso(d);
}

export function money(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Deterministic PRNG so the demo data (and therefore screenshots) are stable. */
export function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export function pick<T>(arr: readonly T[], r: number): T {
  return arr[Math.floor(r * arr.length) % arr.length];
}

/* ------------------------------------------------------------- db primitives */

export interface DbUser {
  id: number;
  name: string;
  email: string;
  password: string;
  phone: string | null;
  student_id: string | null;
  role: Role;
  created_at: string;
}

export interface DbPlan {
  id: number;
  name: string;
  price: number;
  duration_months: number;
  ticket_discount_percent: number;
  merch_discount_percent: number;
  benefits: string[];
}

export interface DbMembership {
  id: number;
  user_id: number;
  plan_id: number;
  status: MembershipStatus;
  start_date: string | null;
  end_date: string | null;
  dues_paid: boolean;
  amount_paid: number;
  member_code: string | null;
  renewal_reminder_sent: boolean;
}

export interface DbEvent {
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

export interface DbTicket {
  id: number;
  event_id: number;
  user_id: number | null;
  buyer_name: string;
  buyer_email: string;
  price_paid: number;
  is_member_price: boolean;
  ticket_code: string;
  status: 'VALID' | 'CHECKED_IN' | 'CANCELLED';
  checked_in_at: string | null;
  checked_in_by_id: number | null;
  created_at: string;
}

export interface DbAnnouncement {
  id: number;
  title: string;
  body: string;
  category: AnnouncementCategory;
  author_id: number;
  published_at: string;
  email_sent: boolean;
  recipient_count: number;
}

export interface DbSubscriber {
  id: number;
  email: string;
  name: string | null;
  user_id: number | null;
  subscribed: boolean;
  unsubscribe_token: string;
}

export interface DbEmailLog {
  id: number;
  to_email: string;
  subject: string;
  body: string;
  sent_at: string;
  related_type: string | null;
  related_id: number | null;
  status: 'LOGGED' | 'SENT' | 'FAILED';
}

export interface DbProduct {
  id: number;
  name: string;
  description: string;
  image_url: string | null;
  base_price: number;
  active: boolean;
}

export interface DbVariant {
  id: number;
  product_id: number;
  size: Size;
  stock: number;
}

export interface DbOrder {
  id: number;
  user_id: number | null;
  buyer_name: string;
  buyer_email: string;
  status: OrderStatus;
  subtotal: number;
  discount: number;
  discount_percent: number;
  total: number;
  is_member_discount: boolean;
  created_at: string;
}

export interface DbOrderItem {
  id: number;
  order_id: number;
  variant_id: number;
  quantity: number;
  unit_price: number;
}

export interface DbFundraiser {
  id: number;
  title: string;
  description: string;
  goal_amount: number;
  raised_amount: number;
  event_date: string;
  status: FundraiserStatus;
}

export interface DbTask {
  id: number;
  fundraiser_id: number;
  title: string;
  description: string;
  assignee_id: number | null;
  due_date: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  position: number;
}

export interface DbExpense {
  id: number;
  submitted_by_id: number;
  fundraiser_id: number | null;
  event_id: number | null;
  description: string;
  amount: number;
  category: string;
  receipt_url: string;
  receipt_name: string;
  status: ExpenseStatus;
  reviewed_by_id: number | null;
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  reimbursed_at: string | null;
}

export interface DbTransaction {
  id: number;
  type: TransactionType;
  source: TransactionSource;
  amount: number;
  description: string;
  reference_type: string | null;
  reference_id: number | null;
  date: string;
  created_by_id: number | null;
}

export interface DbCheckout {
  id: string;
  kind: 'TICKET';
  event_id: number;
  user_id: number | null;
  buyer_name: string;
  buyer_email: string;
  quantity: number;
  unit_price: number;
  is_member_price: boolean;
  total: number;
  created_at: string;
  expires_at: string;
}

export interface MockDb {
  version: number;
  seq: Record<string, number>;
  users: DbUser[];
  plans: DbPlan[];
  memberships: DbMembership[];
  events: DbEvent[];
  tickets: DbTicket[];
  announcements: DbAnnouncement[];
  subscribers: DbSubscriber[];
  email_logs: DbEmailLog[];
  products: DbProduct[];
  variants: DbVariant[];
  orders: DbOrder[];
  order_items: DbOrderItem[];
  fundraisers: DbFundraiser[];
  tasks: DbTask[];
  expenses: DbExpense[];
  transactions: DbTransaction[];
  checkouts: DbCheckout[];
}

export const DB_KEY = 'skyline_mock_db_v2';
const DB_VERSION = 2;

export function nextId(db: MockDb, table: string): number {
  db.seq[table] = (db.seq[table] ?? 0) + 1;
  return db.seq[table];
}

/* -------------------------------------------------------------------- seeding */

interface SeedPerson {
  name: string;
  email: string;
  role?: Role;
  password?: string;
  phone?: string;
  student_id?: string;
  plan?: 1 | 2;
  status: MembershipStatus;
  /** days from today the membership expires (only meaningful when ACTIVE) */
  expiresInDays?: number;
  duesPaid?: boolean;
}

const DEMO_PEOPLE: SeedPerson[] = [
  { name: 'Aarav Patel', email: 'aarav.patel@skyline.edu', student_id: 'S-2026-1001', phone: '+1 415 555 0101', plan: 2, status: 'ACTIVE', expiresInDays: 210, duesPaid: true },
  { name: 'Meera Shah', email: 'meera.shah@skyline.edu', student_id: 'S-2026-1002', phone: '+1 415 555 0102', plan: 1, status: 'ACTIVE', expiresInDays: 205, duesPaid: true },
  { name: 'Rohan Desai', email: 'rohan.desai@skyline.edu', student_id: 'S-2026-1003', phone: '+1 415 555 0103', plan: 1, status: 'ACTIVE', expiresInDays: 198, duesPaid: true },
  { name: 'Ananya Iyer', email: 'ananya.iyer@skyline.edu', student_id: 'S-2026-1004', phone: '+1 415 555 0104', plan: 2, status: 'ACTIVE', expiresInDays: 191, duesPaid: true },
  { name: 'Kabir Malhotra', email: 'kabir.malhotra@skyline.edu', student_id: 'S-2026-1005', phone: '+1 415 555 0105', plan: 1, status: 'ACTIVE', expiresInDays: 186, duesPaid: true },
  { name: 'Diya Nair', email: 'diya.nair@skyline.edu', student_id: 'S-2026-1006', phone: '+1 415 555 0106', plan: 2, status: 'ACTIVE', expiresInDays: 180, duesPaid: true },
  { name: 'Arjun Reddy', email: 'arjun.reddy@skyline.edu', student_id: 'S-2026-1007', phone: '+1 415 555 0107', plan: 1, status: 'ACTIVE', expiresInDays: 176, duesPaid: true },
  { name: 'Sara Khan', email: 'sara.khan@skyline.edu', student_id: 'S-2026-1008', phone: '+1 415 555 0108', plan: 2, status: 'ACTIVE', expiresInDays: 170, duesPaid: true },
  { name: 'Nikhil Joshi', email: 'nikhil.joshi@skyline.edu', student_id: 'S-2026-1009', phone: '+1 415 555 0109', plan: 1, status: 'ACTIVE', expiresInDays: 164, duesPaid: true },
  { name: 'Ishita Bose', email: 'ishita.bose@skyline.edu', student_id: 'S-2026-1010', phone: '+1 415 555 0110', plan: 2, status: 'ACTIVE', expiresInDays: 158, duesPaid: true },
  { name: 'Vivaan Gupta', email: 'vivaan.gupta@skyline.edu', student_id: 'S-2026-1011', phone: '+1 415 555 0111', plan: 1, status: 'ACTIVE', expiresInDays: 150, duesPaid: true },
  { name: 'Priya Menon', email: 'priya.menon@skyline.edu', student_id: 'S-2026-1012', phone: '+1 415 555 0112', plan: 2, status: 'ACTIVE', expiresInDays: 144, duesPaid: true },
  { name: 'Aditya Rao', email: 'aditya.rao@skyline.edu', student_id: 'S-2026-1013', phone: '+1 415 555 0113', plan: 1, status: 'ACTIVE', expiresInDays: 132, duesPaid: true },
  { name: 'Neha Verma', email: 'neha.verma@skyline.edu', student_id: 'S-2026-1014', phone: '+1 415 555 0114', plan: 2, status: 'ACTIVE', expiresInDays: 121, duesPaid: true },
  { name: 'Karan Singh', email: 'karan.singh@skyline.edu', student_id: 'S-2026-1015', phone: '+1 415 555 0115', plan: 1, status: 'ACTIVE', expiresInDays: 96, duesPaid: true },
  // expiring within 30 days — these drive the "Expiring soon" card + reminder job
  { name: 'Tanvi Kulkarni', email: 'tanvi.kulkarni@skyline.edu', student_id: 'S-2025-1016', phone: '+1 415 555 0116', plan: 2, status: 'ACTIVE', expiresInDays: 6, duesPaid: true },
  { name: 'Harsh Mehta', email: 'harsh.mehta@skyline.edu', student_id: 'S-2025-1017', phone: '+1 415 555 0117', plan: 1, status: 'ACTIVE', expiresInDays: 13, duesPaid: true },
  { name: 'Riya Chawla', email: 'riya.chawla@skyline.edu', student_id: 'S-2025-1018', phone: '+1 415 555 0118', plan: 2, status: 'ACTIVE', expiresInDays: 21, duesPaid: true },
  { name: 'Devansh Trivedi', email: 'devansh.trivedi@skyline.edu', student_id: 'S-2025-1019', phone: '+1 415 555 0119', plan: 1, status: 'ACTIVE', expiresInDays: 28, duesPaid: true },
  // expired
  { name: 'Sneha Pillai', email: 'sneha.pillai@skyline.edu', student_id: 'S-2024-1020', phone: '+1 415 555 0120', plan: 1, status: 'EXPIRED', expiresInDays: -24, duesPaid: true },
  { name: 'Manav Bhatt', email: 'manav.bhatt@skyline.edu', student_id: 'S-2024-1021', phone: '+1 415 555 0121', plan: 2, status: 'EXPIRED', expiresInDays: -63, duesPaid: true },
  { name: 'Pooja Shetty', email: 'pooja.shetty@skyline.edu', student_id: 'S-2024-1022', phone: '+1 415 555 0122', plan: 1, status: 'EXPIRED', expiresInDays: -102, duesPaid: true },
  // pending payment
  { name: 'Yash Thakkar', email: 'yash.thakkar@skyline.edu', student_id: 'S-2026-1023', phone: '+1 415 555 0123', plan: 2, status: 'PENDING_PAYMENT', duesPaid: false },
  { name: 'Aisha Sheikh', email: 'aisha.sheikh@skyline.edu', student_id: 'S-2026-1024', phone: '+1 415 555 0124', plan: 1, status: 'PENDING_PAYMENT', duesPaid: false },
  { name: 'Om Prakash', email: 'om.prakash@skyline.edu', student_id: 'S-2026-1025', phone: '+1 415 555 0125', plan: 1, status: 'PENDING_PAYMENT', duesPaid: false },
];

const DEMO_STAFF: SeedPerson[] = [
  { name: 'Ava Sinclair', email: 'admin@skyline.edu', password: 'admin123', role: 'ADMIN', student_id: 'S-2023-0001', phone: '+1 415 555 0001', plan: 2, status: 'ACTIVE', expiresInDays: 240, duesPaid: true },
  { name: 'Marcus Bell', email: 'treasurer@skyline.edu', password: 'treasurer123', role: 'TREASURER', student_id: 'S-2023-0002', phone: '+1 415 555 0002', plan: 2, status: 'ACTIVE', expiresInDays: 240, duesPaid: true },
  { name: 'Jordan Reid', email: 'volunteer@skyline.edu', password: 'volunteer123', role: 'VOLUNTEER', student_id: 'S-2024-0003', phone: '+1 415 555 0003', plan: 1, status: 'ACTIVE', expiresInDays: 225, duesPaid: true },
  { name: 'Noor Hassan', email: 'member@skyline.edu', password: 'member123', role: 'MEMBER', student_id: 'S-2024-0004', phone: '+1 415 555 0004', plan: 2, status: 'ACTIVE', expiresInDays: 232, duesPaid: true },
];

export function buildSeedDb(): MockDb {
  const db: MockDb = {
    version: DB_VERSION,
    seq: {},
    users: [],
    plans: [],
    memberships: [],
    events: [],
    tickets: [],
    announcements: [],
    subscribers: [],
    email_logs: [],
    products: [],
    variants: [],
    orders: [],
    order_items: [],
    fundraisers: [],
    tasks: [],
    expenses: [],
    transactions: [],
    checkouts: [],
  };

  const rng = makeRng(20260101);
  const now = new Date();

  /* plans */
  db.plans = [
    {
      id: nextId(db, 'plans'),
      name: 'Standard Annual',
      price: 20,
      duration_months: 12,
      ticket_discount_percent: 20,
      merch_discount_percent: 10,
      benefits: [
        '20% off all event tickets',
        '10% off merch in the Skyline store',
        'Voting rights at general meetings',
        'Members-only newsletter',
      ],
    },
    {
      id: nextId(db, 'plans'),
      name: 'Premium Annual',
      price: 35,
      duration_months: 12,
      ticket_discount_percent: 40,
      merch_discount_percent: 20,
      benefits: [
        '40% off all event tickets',
        '20% off merch in the Skyline store',
        'Priority seating at the Spring Gala',
        'Free entry to workshops & hack nights',
        'Voting rights at general meetings',
      ],
    },
  ];

  /* staff + members */
  let memberCode = 1000;
  const seedPerson = (p: SeedPerson, i: number): DbUser => {
    const user: DbUser = {
      id: nextId(db, 'users'),
      name: p.name,
      email: p.email,
      password: p.password ?? 'skyline123',
      phone: p.phone ?? null,
      student_id: p.student_id ?? null,
      role: p.role ?? 'MEMBER',
      created_at: addDays(-(180 + i * 3), 10, 30, now),
    };
    db.users.push(user);

    const plan = db.plans.find((pl) => pl.id === (p.plan ?? 1)) ?? db.plans[0];
    const isPending = p.status === 'PENDING_PAYMENT';
    const startDate = p.status === 'EXPIRED'
      ? addDays(-400, 12, 0, now)
      : addDays(-(p.expiresInDays && p.expiresInDays > 0 ? 300 - Math.min(p.expiresInDays, 300) : 30), 12, 0, now);
    const endDate = p.expiresInDays !== undefined
      ? addDays(p.expiresInDays, 23, 59, now)
      : academicYearEnd(now);

    db.memberships.push({
      id: nextId(db, 'memberships'),
      user_id: user.id,
      plan_id: plan.id,
      status: p.status,
      start_date: isPending ? null : startDate,
      end_date: isPending ? null : endDate,
      dues_paid: p.duesPaid ?? !isPending,
      amount_paid: isPending ? 0 : plan.price,
      member_code: isPending ? null : `SKY-${++memberCode}`,
      renewal_reminder_sent: false,
    });
    return user;
  };

  const staff = DEMO_STAFF.map((p, i) => seedPerson(p, i));
  const members = DEMO_PEOPLE.map((p, i) => seedPerson(p, i + 10));
  const [admin, treasurer, volunteer, demoMember] = staff;
  const activeMembers = members.filter((m) => {
    const mem = db.memberships.find((x) => x.user_id === m.id);
    return mem?.status === 'ACTIVE';
  });

  /* events */
  db.events = [
    {
      id: nextId(db, 'events'),
      title: 'Spring Gala 2025',
      description:
        'Our flagship black-tie evening: live band, three-course dinner, awards, and dancing until late. Ticket price includes one drink token. Members save 50% — bring a friend at the guest rate.',
      location: 'Grand Ballroom, Student Union',
      start_date: addDays(9, 19, 0, now),
      end_date: addDays(9, 23, 30, now),
      image_url: null,
      capacity: 200,
      member_price: 15,
      non_member_price: 30,
      status: 'PUBLISHED',
      created_at: addDays(-70, 9, 0, now),
    },
    {
      id: nextId(db, 'events'),
      title: "Founders' Night Mixer",
      description:
        'An informal networking evening with alumni and faculty. Light appetisers, a short keynote, and plenty of time to mingle. Completed event — see the report for attendance and revenue.',
      location: 'Skyline Rooftop Lounge',
      start_date: addDays(-52, 18, 30, now),
      end_date: addDays(-52, 21, 30, now),
      image_url: null,
      capacity: 120,
      member_price: 10,
      non_member_price: 20,
      status: 'COMPLETED',
      created_at: addDays(-110, 9, 0, now),
    },
    {
      id: nextId(db, 'events'),
      title: 'Skyline Hack Night',
      description:
        'A 6-hour build sprint with mentors from the CS department. Teams of four, free pizza, and prizes for the top three projects. Free for Premium members.',
      location: 'Innovation Lab, Building C',
      start_date: addDays(21, 17, 0, now),
      end_date: addDays(21, 23, 0, now),
      image_url: null,
      capacity: 60,
      member_price: 5,
      non_member_price: 10,
      status: 'PUBLISHED',
      created_at: addDays(-30, 11, 0, now),
    },
    {
      id: nextId(db, 'events'),
      title: 'Career Connect Workshop',
      description:
        'Resume clinics, mock interviews, and a recruiter panel from five partner companies. Bring a printed resume.',
      location: 'Lecture Theatre 2',
      start_date: addDays(38, 15, 0, now),
      end_date: addDays(38, 18, 0, now),
      image_url: null,
      capacity: 80,
      member_price: 8,
      non_member_price: 16,
      status: 'PUBLISHED',
      created_at: addDays(-14, 10, 0, now),
    },
    {
      id: nextId(db, 'events'),
      title: 'Winter Formal',
      description: 'Draft — venue not confirmed yet. Talks with the Riverside Hall are in progress.',
      location: 'TBC',
      start_date: addDays(76, 19, 0, now),
      end_date: addDays(76, 23, 0, now),
      image_url: null,
      capacity: 150,
      member_price: 18,
      non_member_price: 36,
      status: 'DRAFT',
      created_at: addDays(-4, 16, 0, now),
    },
  ];

  /* tickets — Spring Gala 120 sold (70 checked in), Founders' Night 88 sold (79 checked in) */
  const gala = db.events[0];
  const founders = db.events[1];
  const hack = db.events[2];
  const workshop = db.events[3];
  const buyers = [...activeMembers, ...members];
  const makeTicket = (
    event: DbEvent,
    index: number,
    isMember: boolean,
    status: 'VALID' | 'CHECKED_IN',
    boughtDaysAgo: number,
  ): DbTicket => {
    const person = buyers[(index * 7) % buyers.length];
    const checkedInAt = status === 'CHECKED_IN' ? addDays(-boughtDaysAgo + 1, 19, 12, now) : null;
    return {
      id: nextId(db, 'tickets'),
      event_id: event.id,
      user_id: person.id,
      buyer_name: person.name,
      buyer_email: person.email,
      price_paid: isMember ? event.member_price : event.non_member_price,
      is_member_price: isMember,
      ticket_code: `TKT-${event.id}${String(index + 1).padStart(3, '0')}-${String(1000 + index)}`,
      status,
      checked_in_at: checkedInAt,
      checked_in_by_id: checkedInAt ? volunteer.id : null,
      created_at: addDays(-boughtDaysAgo, 10 + (index % 9), 15, now),
    };
  };
  for (let i = 0; i < 120; i++) {
    const isMember = i % 3 !== 0;
    db.tickets.push(makeTicket(gala, i, isMember, i < 70 ? 'CHECKED_IN' : 'VALID', 30 - (i % 20)));
  }
  for (let i = 0; i < 88; i++) {
    const isMember = i % 2 === 0;
    db.tickets.push(makeTicket(founders, i, isMember, i < 79 ? 'CHECKED_IN' : 'VALID', 60 - (i % 25)));
  }
  for (let i = 0; i < 34; i++) {
    db.tickets.push(makeTicket(hack, i, i % 4 !== 0, 'VALID', 12 - (i % 8)));
  }
  for (let i = 0; i < 12; i++) {
    db.tickets.push(makeTicket(workshop, i, i % 3 === 0, 'VALID', 6 - (i % 5)));
  }

  /* The demo member gets one upcoming ticket and one used ticket so "My tickets"
     is never empty on a fresh install. Two seeded tickets are replaced rather
     than added, which keeps the sold/checked-in counts above exact. */
  const cardHolder = db.users.find((u) => u.email === 'member@skyline.edu');
  if (cardHolder) {
    const swapIn = (event: DbEvent, status: 'VALID' | 'CHECKED_IN', boughtDaysAgo: number, seed: number): void => {
      const lastIndexOfEvent = db.tickets.map((t) => t.event_id).lastIndexOf(event.id);
      if (lastIndexOfEvent >= 0) db.tickets.splice(lastIndexOfEvent, 1);
      db.tickets.push({
        id: nextId(db, 'tickets'),
        event_id: event.id,
        user_id: cardHolder.id,
        buyer_name: cardHolder.name,
        buyer_email: cardHolder.email,
        price_paid: event.member_price,
        is_member_price: true,
        ticket_code: `TKT-${event.id}${String(seed).padStart(3, '0')}-${String(2000 + seed)}`,
        status,
        checked_in_at: status === 'CHECKED_IN' ? addDays(-boughtDaysAgo + 1, 19, 12, now) : null,
        checked_in_by_id: status === 'CHECKED_IN' ? volunteer.id : null,
        created_at: addDays(-boughtDaysAgo, 10 + (seed % 9), 15, now),
      });
    };
    swapIn(gala, 'VALID', 6, 900);
    swapIn(founders, 'CHECKED_IN', 55, 901);
  }

  /* products + variants */
  const productSeeds: { name: string; description: string; price: number; stock: Record<Size, number>; active?: boolean }[] = [
    {
      name: 'Skyline Hoodie',
      description:
        'Heavyweight 380gsm fleece hoodie with the embroidered Skyline crest, kangaroo pocket and a double-lined hood. Runs true to size.',
      price: 40,
      stock: { XS: 6, S: 12, M: 4, L: 18, XL: 2, XXL: 0 },
    },
    {
      name: 'Skyline T-Shirt',
      description: '100% combed cotton, screen-printed on the front and back. Pre-shrunk and unisex fit.',
      price: 18,
      stock: { XS: 9, S: 0, M: 22, L: 25, XL: 11, XXL: 7 },
    },
    {
      name: 'Skyline Tote Bag',
      description: 'Reinforced canvas tote with the Skyline skyline print. Holds a laptop, a hoodie and too many snacks.',
      price: 15,
      stock: { XS: 0, S: 15, M: 9, L: 3, XL: 0, XXL: 0 },
    },
  ];
  for (const p of productSeeds) {
    const product: DbProduct = {
      id: nextId(db, 'products'),
      name: p.name,
      description: p.description,
      image_url: null,
      base_price: p.price,
      active: p.active ?? true,
    };
    db.products.push(product);
    (Object.keys(p.stock) as Size[]).forEach((size) => {
      db.variants.push({
        id: nextId(db, 'variants'),
        product_id: product.id,
        size,
        stock: p.stock[size],
      });
    });
  }
  const variantId = (productName: string, size: Size): DbVariant => {
    const product = db.products.find((p) => p.name === productName);
    return db.variants.find((v) => v.product_id === product?.id && v.size === size)!;
  };

  const makeOrder = (
    buyer: DbUser,
    lines: { productName: string; size: Size; qty: number }[],
    status: OrderStatus,
    daysAgo: number,
    memberDiscount: boolean,
  ): void => {
    const membership = db.memberships.find((m) => m.user_id === buyer.id);
    const plan = db.plans.find((pl) => pl.id === membership?.plan_id);
    const pct = memberDiscount && membership?.status === 'ACTIVE' ? plan?.merch_discount_percent ?? 0 : 0;
    const items: DbOrderItem[] = [];
    let subtotal = 0;
    for (const line of lines) {
      const variant = variantId(line.productName, line.size);
      const price = db.products.find((p) => p.id === variant.product_id)?.base_price ?? 0;
      subtotal += price * line.qty;
      items.push({
        id: nextId(db, 'order_items'),
        order_id: 0,
        variant_id: variant.id,
        quantity: line.qty,
        unit_price: price,
      });
    }
    const discount = money((subtotal * pct) / 100);
    const order: DbOrder = {
      id: nextId(db, 'orders'),
      user_id: buyer.id,
      buyer_name: buyer.name,
      buyer_email: buyer.email,
      status,
      subtotal: money(subtotal),
      discount,
      discount_percent: pct,
      total: money(subtotal - discount),
      is_member_discount: pct > 0,
      created_at: addDays(-daysAgo, 13, 5, now),
    };
    db.orders.push(order);
    items.forEach((it) => {
      db.order_items.push({ ...it, order_id: order.id });
    });
  };

  makeOrder(demoMember, [{ productName: 'Skyline Hoodie', size: 'M', qty: 1 }, { productName: 'Skyline T-Shirt', size: 'L', qty: 1 }], 'PAID', 6, true);
  makeOrder(activeMembers[1] ?? demoMember, [{ productName: 'Skyline Hoodie', size: 'L', qty: 2 }], 'FULFILLED', 21, true);
  makeOrder(activeMembers[2] ?? demoMember, [{ productName: 'Skyline T-Shirt', size: 'M', qty: 1 }], 'PENDING', 1, true);
  makeOrder(activeMembers[3] ?? demoMember, [{ productName: 'Skyline Hoodie', size: 'XL', qty: 1 }], 'CANCELLED', 33, false);
  makeOrder(activeMembers[4] ?? demoMember, [{ productName: 'Skyline Tote Bag', size: 'M', qty: 2 }], 'PAID', 12, true);
  makeOrder(activeMembers[5] ?? demoMember, [{ productName: 'Skyline T-Shirt', size: 'XL', qty: 3 }], 'FULFILLED', 44, true);
  makeOrder(activeMembers[6] ?? demoMember, [{ productName: 'Skyline Hoodie', size: 'S', qty: 1 }, { productName: 'Skyline Tote Bag', size: 'S', qty: 1 }], 'PAID', 4, true);

  /* fundraisers + tasks */
  const bakeSale: DbFundraiser = {
    id: nextId(db, 'fundraisers'),
    title: 'Spring Bake Sale',
    description:
      'A three-day bake sale outside the library to fund the end-of-year volunteering trip. We need bakers, sellers and a cash float.',
    goal_amount: 1200,
    raised_amount: 780,
    event_date: addDays(5, 9, 0, now),
    status: 'ACTIVE',
  };
  const run5k: DbFundraiser = {
    id: nextId(db, 'fundraisers'),
    title: 'Charity 5K Run',
    description: 'Campus-wide 5K with a $10 entry fee. Planning phase — route and permits not yet confirmed.',
    goal_amount: 2500,
    raised_amount: 0,
    event_date: addDays(46, 8, 0, now),
    status: 'PLANNING',
  };
  db.fundraisers = [bakeSale, run5k];

  const taskSeeds: {
    fundraiser_id: number;
    title: string;
    description: string;
    assignee_id: number | null;
    due_date: string | null;
    status: TaskStatus;
    priority: TaskPriority;
    position: number;
  }[] = [
    { fundraiser_id: bakeSale.id, title: 'Book the community hall', description: 'Reserve the hall for setup on the Friday evening.', assignee_id: volunteer.id, due_date: addDays(-9, 17, 0, now), status: 'DONE', priority: 'HIGH', position: 0 },
    { fundraiser_id: bakeSale.id, title: 'Design flyers', description: 'A5 flyer with QR to the store page.', assignee_id: activeMembers[7]?.id ?? null, due_date: addDays(-6, 17, 0, now), status: 'DONE', priority: 'MEDIUM', position: 1 },
    { fundraiser_id: bakeSale.id, title: 'Print and post flyers', description: '150 copies, post across all five notice boards.', assignee_id: volunteer.id, due_date: addDays(-3, 17, 0, now), status: 'DONE', priority: 'LOW', position: 2 },
    { fundraiser_id: bakeSale.id, title: 'Confirm food handling permits', description: 'Student affairs office — needs the signed form.', assignee_id: treasurer.id, due_date: addDays(-2, 12, 0, now), status: 'TODO', priority: 'HIGH', position: 0 },
    { fundraiser_id: bakeSale.id, title: 'Buy baking supplies', description: 'Flour, butter, sugar, chocolate chips. Keep every receipt for reimbursement.', assignee_id: volunteer.id, due_date: addDays(2, 12, 0, now), status: 'IN_PROGRESS', priority: 'HIGH', position: 0 },
    { fundraiser_id: bakeSale.id, title: 'Recruit 6 volunteers for shifts', description: 'Two per shift across three days — signup sheet in the group chat.', assignee_id: activeMembers[3]?.id ?? null, due_date: addDays(3, 12, 0, now), status: 'IN_PROGRESS', priority: 'MEDIUM', position: 1 },
    { fundraiser_id: bakeSale.id, title: 'Arrange tables and signage', description: 'Two trestle tables, banner and the price board.', assignee_id: volunteer.id, due_date: addDays(-1, 12, 0, now), status: 'TODO', priority: 'MEDIUM', position: 1 },
    { fundraiser_id: bakeSale.id, title: 'Set up payment QR and cash float', description: '$80 float from the treasurer plus the payment QR poster.', assignee_id: treasurer.id, due_date: addDays(1, 12, 0, now), status: 'DONE', priority: 'MEDIUM', position: 3 },
    { fundraiser_id: bakeSale.id, title: 'Social media countdown', description: 'One post per day for the three days before.', assignee_id: activeMembers[8]?.id ?? null, due_date: addDays(4, 12, 0, now), status: 'IN_PROGRESS', priority: 'LOW', position: 2 },
    { fundraiser_id: bakeSale.id, title: 'Post-event cleanup crew', description: 'Six people, 45 minutes, bins and a trolley.', assignee_id: null, due_date: addDays(6, 12, 0, now), status: 'TODO', priority: 'LOW', position: 2 },
    { fundraiser_id: run5k.id, title: 'Scout the 5K route', description: 'Start and finish at the main gate; avoid the construction zone.', assignee_id: volunteer.id, due_date: addDays(12, 12, 0, now), status: 'IN_PROGRESS', priority: 'HIGH', position: 0 },
    { fundraiser_id: run5k.id, title: 'Submit permit application', description: 'Campus safety office, 3-week lead time.', assignee_id: treasurer.id, due_date: addDays(18, 12, 0, now), status: 'TODO', priority: 'HIGH', position: 0 },
    { fundraiser_id: run5k.id, title: 'Order finisher medals', description: 'Get three quotes first.', assignee_id: null, due_date: addDays(30, 12, 0, now), status: 'TODO', priority: 'LOW', position: 1 },
  ];
  taskSeeds.forEach((t) => db.tasks.push({ id: nextId(db, 'tasks'), ...t }));

  /* announcements */
  const announcementSeeds: { title: string; body: string; category: AnnouncementCategory; daysAgo: number; email_sent: boolean; recipients: number }[] = [
    {
      title: 'General meeting — Thursday 6pm, Room 214',
      body: '## Agenda\n\n1. Spring Gala ticket numbers\n2. Bake sale shift rota\n3. Treasurer report\n4. Open floor\n\nPlease arrive five minutes early so we can start on time. Minutes will be posted here afterwards.',
      category: 'MEETING',
      daysAgo: 3,
      email_sent: true,
      recipients: 29,
    },
    {
      title: 'Merch pre-order window closes Friday',
      body: 'The hoodie pre-order closes **this Friday at 5pm**. After that we place the order with the printer and there will be no extras in size M or XL.\n\nOrder from the store page — members get their discount automatically at checkout.',
      category: 'DEADLINE',
      daysAgo: 9,
      email_sent: true,
      recipients: 31,
    },
    {
      title: 'Hack Night moved to the Innovation Lab',
      body: 'Skyline Hack Night has moved from the Library Annex to the **Innovation Lab, Building C** — the annex double-booked us.\n\nSame date, same time, better wifi. Sorry for the shuffle.',
      category: 'CHANGE_OF_PLAN',
      daysAgo: 16,
      email_sent: true,
      recipients: 27,
    },
    {
      title: 'Membership renewal reminders are going out',
      body: 'If your membership expires in the next 30 days you will receive a reminder email with a one-click renewal link.\n\nRenewing keeps your ticket discount active for the Spring Gala.',
      category: 'GENERAL',
      daysAgo: 22,
      email_sent: false,
      recipients: 0,
    },
    {
      title: 'Bake sale volunteers needed',
      body: 'We need **6 volunteers** across three shifts for the Spring Bake Sale. Sign up on the fundraiser board or reply to this announcement.\n\nBakers get first pick of the leftovers. That is the entire pitch.',
      category: 'GENERAL',
      daysAgo: 30,
      email_sent: true,
      recipients: 33,
    },
    {
      title: 'Treasurer office hours move to Tuesdays',
      body: 'Reimbursement drop-in hours are now **Tuesdays 2–4pm** in the union office. Bring your receipt and the claim reference number.',
      category: 'CHANGE_OF_PLAN',
      daysAgo: 41,
      email_sent: false,
      recipients: 0,
    },
  ];
  announcementSeeds.forEach((a) =>
    db.announcements.push({
      id: nextId(db, 'announcements'),
      title: a.title,
      body: a.body,
      category: a.category,
      author_id: admin.id,
      published_at: addDays(-a.daysAgo, 9, 30, now),
      email_sent: a.email_sent,
      recipient_count: a.recipients,
    }),
  );

  /* mailing list */
  const subscriberEmails = [
    'campus.radio@skyline.edu',
    'alumni.office@skyline.edu',
    'dean.students@skyline.edu',
    'skyline.alumni.nina@gmail.com',
    'parent.commmittee@gmail.com',
    'james.okafor@gmail.com',
  ];
  subscriberEmails.forEach((email, i) =>
    db.subscribers.push({
      id: nextId(db, 'subscribers'),
      email,
      name: i < 3 ? null : email.split('@')[0].replace(/\./g, ' '),
      user_id: null,
      subscribed: true,
      unsubscribe_token: `unsub-${1000 + i}-${email.length}${i}`,
    }),
  );

  /* email logs for the announcements that were emailed */
  db.announcements
    .filter((a) => a.email_sent)
    .forEach((a) => {
      const recipients = db.users
        .filter((u) => {
          const m = db.memberships.find((mm) => mm.user_id === u.id);
          return m?.status === 'ACTIVE';
        })
        .slice(0, 12);
      recipients.forEach((u) => {
        db.email_logs.push({
          id: nextId(db, 'email_logs'),
          to_email: u.email,
          subject: a.title,
          body: a.body,
          sent_at: a.published_at,
          related_type: 'announcement',
          related_id: a.id,
          status: 'LOGGED',
        });
      });
      db.subscribers.slice(0, 3).forEach((s) => {
        db.email_logs.push({
          id: nextId(db, 'email_logs'),
          to_email: s.email,
          subject: a.title,
          body: a.body,
          sent_at: a.published_at,
          related_type: 'announcement',
          related_id: a.id,
          status: 'LOGGED',
        });
      });
    });

  /* expense claims — one in every state */
  const receiptData = (label: string, color: string): { url: string; name: string } => ({
    url: `data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="600" height="800" fill="#fbfbfd"/><rect x="0" y="0" width="600" height="90" fill="${color}"/><text x="30" y="58" font-family="Helvetica" font-size="30" fill="#fff">RECEIPT</text><text x="30" y="150" font-family="Helvetica" font-size="24" fill="#333">${label}</text><line x1="30" y1="190" x2="570" y2="190" stroke="#ddd" stroke-width="2"/><text x="30" y="240" font-family="Helvetica" font-size="20" fill="#666">Skyline Student Association</text><text x="30" y="280" font-family="Helvetica" font-size="20" fill="#666">Thank you for your purchase</text><text x="30" y="700" font-family="Helvetica" font-size="18" fill="#999">sample receipt — demo data</text></svg>`,
    )}`,
    name: `${label.toLowerCase().replace(/\s+/g, '-')}.svg`,
  });

  db.expenses = [
    {
      id: nextId(db, 'expenses'),
      submitted_by_id: volunteer.id,
      fundraiser_id: bakeSale.id,
      event_id: null,
      description: 'Baking supplies — 4kg flour, butter, chocolate chips',
      amount: 42.5,
      category: 'Supplies',
      receipt_url: receiptData('Bake sale supplies', '#714B67').url,
      receipt_name: 'bake-sale-supplies.svg',
      status: 'SUBMITTED',
      reviewed_by_id: null,
      review_note: null,
      created_at: addDays(-2, 14, 20, now),
      reviewed_at: null,
      reimbursed_at: null,
    },
    {
      id: nextId(db, 'expenses'),
      submitted_by_id: activeMembers[5]?.id ?? volunteer.id,
      fundraiser_id: null,
      event_id: founders.id,
      description: 'Rooftop lounge deposit for Founders’ Night',
      amount: 120,
      category: 'Venue',
      receipt_url: receiptData('Venue deposit', '#8d5f80').url,
      receipt_name: 'venue-deposit.svg',
      status: 'APPROVED',
      reviewed_by_id: treasurer.id,
      review_note: null,
      created_at: addDays(-40, 11, 10, now),
      reviewed_at: addDays(-38, 9, 0, now),
      reimbursed_at: null,
    },
    {
      id: nextId(db, 'expenses'),
      submitted_by_id: volunteer.id,
      fundraiser_id: null,
      event_id: null,
      description: 'Taxi to pick up the banner (not pre-approved)',
      amount: 300,
      category: 'Transport',
      receipt_url: receiptData('Taxi fare', '#b45309').url,
      receipt_name: 'taxi-fare.svg',
      status: 'REJECTED',
      reviewed_by_id: treasurer.id,
      review_note: 'Amount looks like a typo — please resubmit with the actual fare and a photo of the meter receipt.',
      created_at: addDays(-18, 16, 45, now),
      reviewed_at: addDays(-17, 10, 5, now),
      reimbursed_at: null,
    },
    {
      id: nextId(db, 'expenses'),
      submitted_by_id: activeMembers[9]?.id ?? volunteer.id,
      fundraiser_id: bakeSale.id,
      event_id: null,
      description: 'Printing 150 A5 flyers at the campus print shop',
      amount: 65.75,
      category: 'Marketing',
      receipt_url: receiptData('Flyer printing', '#0f766e').url,
      receipt_name: 'flyer-printing.svg',
      status: 'REIMBURSED',
      reviewed_by_id: treasurer.id,
      review_note: null,
      created_at: addDays(-24, 10, 0, now),
      reviewed_at: addDays(-23, 9, 30, now),
      reimbursed_at: addDays(-21, 15, 0, now),
    },
  ];

  /* transactions — last ~4 months, so the charts have shape */
  const tx = (
    type: TransactionType,
    source: TransactionSource,
    amount: number,
    description: string,
    daysAgo: number,
    createdBy: number | null = treasurer.id,
    reference_type: string | null = null,
    reference_id: number | null = null,
  ): void => {
    db.transactions.push({
      id: nextId(db, 'transactions'),
      type,
      source,
      amount: money(amount),
      description,
      reference_type,
      reference_id,
      date: addDays(-daysAgo, 12, 0, now),
      created_by_id: createdBy,
    });
  };

  tx('EXPENSE', 'REIMBURSEMENT', 65.75, 'Reimbursement — flyer printing (Spring Bake Sale)', 21, treasurer.id, 'expense', db.expenses[3].id);
  tx('EXPENSE', 'REIMBURSEMENT', 28.4, 'Reimbursement — gala table decorations', 47);
  tx('EXPENSE', 'REIMBURSEMENT', 54.0, 'Reimbursement — gala table decorations (final)', 39);
  tx('EXPENSE', 'REIMBURSEMENT', 115.0, 'Reimbursement — mixer catering deposit', 58);
  tx('EXPENSE', 'OTHER', 180.0, 'Venue AV hire — Founders’ Night', 49);
  tx('EXPENSE', 'REIMBURSEMENT', 62.3, 'Reimbursement — hack night snacks', 26);
  tx('EXPENSE', 'OTHER', 240.0, 'Spring Gala band deposit', 34);

  const monthlyDues: { daysAgo: number; amount: number; who: string }[] = [];
  for (let m = 0; m < 4; m++) {
    const count = 4 + (m % 3);
    for (let i = 0; i < count; i++) {
      const person = members[(m * 5 + i * 3) % members.length];
      const planPrice = db.plans.find((p) => p.id === db.memberships.find((mm) => mm.user_id === person.id)?.plan_id)?.price ?? 20;
      monthlyDues.push({
        daysAgo: m * 30 + i * 4 + 2,
        amount: planPrice,
        who: person.name,
      });
    }
  }
  monthlyDues.forEach((d, i) => {
    const src: TransactionSource = 'DUES';
    tx('INCOME', src, d.amount, `Membership dues — ${d.who}`, d.daysAgo, staff[i % 2].id, 'membership', null);
  });

  for (let m = 0; m < 4; m++) {
    const ticketsThisMonth = 3 + Math.floor(rng() * 4);
    for (let i = 0; i < ticketsThisMonth; i++) {
      const isMember = rng() > 0.4;
      tx('INCOME', 'TICKET', isMember ? 15 : 30, `Ticket sale — ${pick(['Spring Gala 2025', "Founders' Night Mixer", 'Skyline Hack Night'], rng())}`, m * 30 + i * 6 + 1, treasurer.id, 'event');
    }
    const merchThisMonth = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < merchThisMonth; i++) {
      const amount = pick([18, 40, 15, 58, 36], rng());
      tx('INCOME', 'MERCH', amount, `Merch order — ${pick(['Skyline Hoodie', 'Skyline T-Shirt', 'Skyline Tote Bag'], rng())}`, m * 30 + i * 7 + 3, treasurer.id, 'order');
    }
    if (rng() > 0.35) {
      tx('INCOME', 'FUNDRAISER', money(40 + rng() * 160), 'Fundraiser income — Spring Bake Sale', m * 30 + 9, volunteer.id, 'fundraiser', bakeSale.id);
    }
    if (m % 2 === 0) {
      tx('INCOME', 'DONATION', money(25 + rng() * 75), 'Alumni donation', m * 30 + 12, treasurer.id);
    }
    tx('EXPENSE', 'OTHER', money(20 + rng() * 90), pick(['Printing and stationery', 'Room booking fee', 'Campus radio sponsorship', 'Storage unit rental'], rng()), m * 30 + 15, treasurer.id);
  }

  return db;
}

/* ------------------------------------------------------- persistence helpers */

export function loadDb(): MockDb {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as MockDb;
      if (parsed.version === DB_VERSION && Array.isArray(parsed.users) && parsed.users.length > 0) {
        return parsed;
      }
    }
  } catch {
    /* corrupted storage — rebuild */
  }
  const seeded = buildSeedDb();
  saveDb(seeded);
  return seeded;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function saveDb(db: MockDb): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(db));
    } catch {
      /* quota — the demo keeps working in memory */
    }
  }, 60);
}

export function resetDb(): MockDb {
  const seeded = buildSeedDb();
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(seeded));
  } catch {
    /* noop */
  }
  return seeded;
}
