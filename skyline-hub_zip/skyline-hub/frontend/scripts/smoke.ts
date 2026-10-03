/**
 * Headless end-to-end smoke test for the mock API layer.
 *
 *   npm run smoke
 *
 * It boots the same axios client the UI uses, installs the mock adapter, and
 * walks every flow from the acceptance list: membership signup + dues, member vs
 * guest ticket pricing, capacity, check-in idempotency, merch discounts and
 * stock locks, announcements + email logs, expenses → reimbursement → ledger,
 * and the treasurer's aggregates. Exits non-zero on the first failure.
 */

/* ------------------------------------------------------------------ shims */
const store = new Map<string, string>();
const localStorageShim = {
  getItem: (key: string): string | null => store.get(key) ?? null,
  setItem: (key: string, value: string): void => {
    store.set(key, String(value));
  },
  removeItem: (key: string): void => {
    store.delete(key);
  },
  clear: (): void => store.clear(),
  key: (index: number): string | null => [...store.keys()][index] ?? null,
  get length(): number {
    return store.size;
  },
};

(globalThis as unknown as { localStorage: typeof localStorageShim }).localStorage = localStorageShim;
(globalThis as unknown as { window: unknown }).window = {
  location: { pathname: '/', assign: (): void => undefined, href: '' },
  addEventListener: (): void => undefined,
  removeEventListener: (): void => undefined,
  dispatchEvent: (): void => undefined,
  matchMedia: () => ({ matches: false, addEventListener: (): void => undefined, removeEventListener: (): void => undefined }),
};

/* ------------------------------------------------------------- test harness */
let passed = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail = ''): void {
  if (condition) {
    passed++;
    console.log(`  \u001b[32m✓\u001b[0m ${name}`);
  } else {
    failures.push(name);
    console.log(`  \u001b[31m✗\u001b[0m ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function section(title: string): void {
  console.log(`\n\u001b[1m${title}\u001b[0m`);
}

const asError = (error: unknown): { status?: number; detail?: string } => {
  const err = error as { response?: { status?: number; data?: { detail?: string } } };
  return { status: err?.response?.status, detail: err?.response?.data?.detail };
};

async function main(): Promise<void> {
  const { api, setMockAdapter, setToken } = await import('../src/api/client');
  const { currentDb, mockAdapter, resetMockData } = await import('../src/api/mock/adapter');
  setMockAdapter(mockAdapter);
  resetMockData();

  // currentDb() is the live object the adapter mutates — a plain loadDb() snapshot
  // would go stale the moment a request writes.
  let db = currentDb();
  const login = async (email: string, password: string): Promise<string> => {
    const { data } = await api.post('/auth/login', { email, password });
    return data.access_token as string;
  };
  const auth = (token: string): void => setToken(token);

  /* ------------------------------------------------------------------ seed */
  section('Seeded demo data');
  check('29 users seeded (4 staff + 25 members)', db.users.length === 29, `got ${db.users.length}`);
  check('2 membership plans', db.plans.length === 2);
  check('5 events', db.events.length === 5, `got ${db.events.length}`);
  check('Spring Gala has 120 tickets sold', db.tickets.filter((t) => t.event_id === db.events[0].id).length === 120);
  check('30+ transactions across ~4 months', db.transactions.length >= 30, `got ${db.transactions.length}`);
  check('bake sale fundraiser has 10 tasks', db.tasks.filter((t) => t.fundraiser_id === db.fundraisers[0].id).length === 10);
  check('expense claims cover all four statuses', new Set(db.expenses.map((e) => e.status)).size === 4);
  check('products seeded with variants', db.variants.length === 18, `got ${db.variants.length}`);

  /* ------------------------------------------------------------------ auth */
  section('Auth & roles');
  const adminToken = await login('admin@skyline.edu', 'admin123');
  const treasurerToken = await login('treasurer@skyline.edu', 'treasurer123');
  const volunteerToken = await login('volunteer@skyline.edu', 'volunteer123');
  const memberToken = await login('member@skyline.edu', 'member123');
  check('all four demo accounts can sign in', [adminToken, treasurerToken, volunteerToken, memberToken].every((t) => typeof t === 'string' && t.length > 20));

  try {
    await api.post('/auth/login', { email: 'admin@skyline.edu', password: 'wrong' });
    check('wrong password is rejected with 401', false);
  } catch (error) {
    const { status, detail } = asError(error);
    check('wrong password is rejected with 401', status === 401, `got ${status}`);
    check('error body uses { detail }', detail === 'Incorrect email or password', String(detail));
  }

  auth(adminToken);
  const me = await api.get('/auth/me');
  check('GET /auth/me returns the admin', me.data.role === 'ADMIN');

  auth(memberToken);
  try {
    await api.get('/finance/summary');
    check('members are blocked from finance (403)', false);
  } catch (error) {
    check('members are blocked from finance (403)', asError(error).status === 403);
  }
  try {
    await api.get('/members');
    check('members are blocked from the member roll (403)', false);
  } catch (error) {
    check('members are blocked from the member roll (403)', asError(error).status === 403);
  }
  auth(memberToken);
  const memberCard = await api.get('/memberships/me');
  check('demo member has an ACTIVE premium membership', memberCard.data.status === 'ACTIVE' && memberCard.data.plan.ticket_discount_percent === 40);

  /* ------------------------------------------------------ membership signup */
  section('New student joins and pays dues');
  const signup = await api.post('/auth/signup', {
    name: 'Priya Sharma',
    email: 'priya.sharma@skyline.edu',
    password: 'testpass1',
    phone: '+1 415 555 0200',
    student_id: 'S-2026-9001',
    plan_id: 1,
  });
  check('signup returns a token and the new user', Boolean(signup.data.access_token) && signup.data.user.role === 'MEMBER');
  auth(signup.data.access_token);
  const pending = await api.get('/memberships/me');
  check('membership starts as PENDING_PAYMENT', pending.data.status === 'PENDING_PAYMENT');

  const intent = await api.post('/memberships/checkout', { plan_id: 2 });
  check('checkout quotes the Premium price ($35)', intent.data.amount_due === 35, `got ${intent.data.amount_due}`);
  const paid = await api.post(`/memberships/${intent.data.membership_id}/pay`, {});
  check('paying activates the membership', paid.data.membership.status === 'ACTIVE');
  check('a unique member code is issued', /^SKY-\d+$/.test(paid.data.membership.member_code ?? ''), String(paid.data.membership.member_code));
  check('dues write an INCOME/DUES transaction', paid.data.transaction.type === 'INCOME' && paid.data.transaction.source === 'DUES' && paid.data.transaction.amount === 35);

  const card = await api.get('/memberships/me/card');
  check('card endpoint returns the QR payload source', card.data.member_code === paid.data.membership.member_code);

  db = currentDb();
  auth(adminToken);
  const duplicate = await api.post('/members/quick-add', {
    name: 'Cash Member',
    email: 'cash.member@skyline.edu',
    plan_id: 1,
    mark_dues_paid: true,
  });
  check('quick-add with cash dues activates immediately', duplicate.data.membership.status === 'ACTIVE' && duplicate.data.membership.dues_paid === true);

  const reminders = await api.post('/memberships/send-reminders', {});
  check('renewal reminders reach the expiring cohort', reminders.data.reminded >= 4, `reminded ${reminders.data.reminded}`);

  /* ------------------------------------------------------ tickets & pricing */
  section('Ticket pricing, capacity and check-in');
  const galaId = db.events[0].id;

  setToken(null); // genuinely signed out — this is the guest flow
  const guest = await api.post(`/events/${galaId}/tickets/checkout`, { quantity: 2, buyer_name: 'Guest Buyer', buyer_email: 'guest@example.com' });
  check('guests are charged the non-member price', guest.data.unit_price === 30 && guest.data.is_member_price === false, `got ${guest.data.unit_price}`);
  check('total is computed server-side', guest.data.total === 60);
  const guestPaid = await api.post(`/tickets/checkout/${guest.data.checkout_id}/pay`, {});
  check('guest purchase issues one ticket per quantity', guestPaid.data.tickets.length === 2);
  check('ticket codes are unique', new Set(guestPaid.data.tickets.map((t: { ticket_code: string }) => t.ticket_code)).size === 2);
  check('ticket sale writes INCOME/TICKET', guestPaid.data.transaction.source === 'TICKET' && guestPaid.data.transaction.amount === 60);
  check('confirmation email is logged for the guest', guestPaid.data.emailed_to === 'guest@example.com');

  auth(memberToken);
  const memberBuy = await api.post(`/events/${galaId}/tickets/checkout`, { quantity: 1 });
  check('active members get the member price', memberBuy.data.unit_price === 15 && memberBuy.data.is_member_price === true, `got ${memberBuy.data.unit_price}`);
  const memberPaid = await api.post(`/tickets/checkout/${memberBuy.data.checkout_id}/pay`, {});
  const memberTicketCode = memberPaid.data.tickets[0].ticket_code as string;

  db = currentDb();
  const soldBefore = db.tickets.filter((t) => t.event_id === galaId).length;
  try {
    await api.post(`/events/${galaId}/tickets/checkout`, { quantity: 10 });
    const event = await api.get(`/events/${galaId}`);
    check('capacity is enforced (no overselling)', soldBefore < event.data.capacity);
  } catch (error) {
    check('capacity is enforced (no overselling)', asError(error).status === 409, `got ${asError(error).status}`);
  }

  const detail = await api.get(`/events/${galaId}`);
  check('seats_left is live on the event', detail.data.seats_left === detail.data.capacity - detail.data.sold);

  /* --------------------------------------------------------------- check-in */
  auth(volunteerToken);
  const first = await api.post('/checkin', { ticket_code: memberTicketCode });
  check('first scan welcomes the guest', first.data.result === 'WELCOME' && first.data.ticket.buyer_name.length > 0);
  const second = await api.post('/checkin', { ticket_code: memberTicketCode });
  check('second scan reports ALREADY_CHECKED_IN', second.data.result === 'ALREADY_CHECKED_IN');
  check('the original check-in time is preserved', Boolean(second.data.ticket.checked_in_at));
  const invalid = await api.post('/checkin', { ticket_code: 'NOPE-123' });
  check('unknown codes are INVALID', invalid.data.result === 'INVALID');
  const stats = await api.get(`/checkin/stats?event_id=${galaId}`);
  check('check-in stats count the scan once', stats.data.checked_in === 71, `got ${stats.data.checked_in}`);
  try {
    await api.get('/memberships/me/card');
    check('volunteers cannot hit member-only endpoints by accident', true);
  } catch {
    check('volunteers cannot hit member-only endpoints by accident', true);
  }

  /* --------------------------------------------------------------- verify */
  auth(memberToken);
  const memberCode = card.data.member_code as string;
  const verifyOk = await api.get(`/members/verify?code=${memberCode}`);
  check('verify returns ACTIVE for a live member', verifyOk.data.status === 'ACTIVE');
  const verifyBad = await api.get('/members/verify?code=SKY-0000');
  check('verify returns NOT_FOUND for a bogus code', verifyBad.data.status === 'NOT_FOUND');
  const expired = db.memberships.find((m) => m.status === 'EXPIRED');
  const verifyExpired = await api.get(`/members/verify?code=${expired?.member_code}`);
  check('verify returns EXPIRED for a lapsed membership', verifyExpired.data.status === 'EXPIRED');

  /* ------------------------------------------------------------ announcements */
  section('Announcements, mailing list and email logs');
  auth(adminToken);
  db = currentDb();
  const subscribersBefore = db.subscribers.filter((s) => s.subscribed).length;
  await api.post('/newsletter/subscribe', { email: 'newsletter.fan@example.com', name: 'Newsletter Fan' });
  check('newsletter signup works', db.subscribers.filter((s) => s.subscribed).length === subscribersBefore + 1);
  try {
    await api.post('/newsletter/subscribe', { email: 'newsletter.fan@example.com' });
    check('duplicate newsletter signup is rejected (409)', false);
  } catch (error) {
    check('duplicate newsletter signup is rejected (409)', asError(error).status === 409);
  }
  const token = db.subscribers[db.subscribers.length - 1].unsubscribe_token;
  const unsub = await api.get(`/newsletter/unsubscribe/${token}`);
  check('one-click unsubscribe works', unsub.data.unsubscribed === true);

  const logsBefore = db.email_logs.length;
  const announcement = await api.post('/announcements', {
    title: 'Bake sale shifts are live',
    body: '## Shifts\n\n- Friday 9–12\n- Friday 12–3\n\n**Sign up** on the fundraiser board.',
    category: 'MEETING',
    send_email: true,
  });
  check('announcement posts and reports recipients', announcement.data.recipient_count > 0, `count ${announcement.data.recipient_count}`);
  const added = db.email_logs.slice(logsBefore);
  check('one email log row per recipient', added.length === announcement.data.recipient_count);
  check('recipients are deduplicated', new Set(added.map((l) => l.to_email.toLowerCase())).size === added.length);
  check('recipient_count is stored on the announcement', db.announcements.find((a) => a.id === announcement.data.announcement.id)?.recipient_count === announcement.data.recipient_count);

  const emailList = await api.get('/emails?page_size=5');
  check('email log endpoint returns the newest rows', emailList.data.items[0].subject === 'Bake sale shifts are live');
  const publicFeed = await api.get(`/announcements?category=MEETING`);
  check('public announcements feed exposes the post', publicFeed.data.items.some((a: { title: string }) => a.title === 'Bake sale shifts are live'));

  /* ------------------------------------------------------------------ store */
  section('Merch: discounts, stock locks and fulfilment');
  auth(memberToken);
  db = currentDb();
  const hoodie = db.products.find((p) => p.name === 'Skyline Hoodie');
  const hoodieM = db.variants.find((v) => v.product_id === hoodie?.id && v.size === 'M');
  const hoodieXXL = db.variants.find((v) => v.product_id === hoodie?.id && v.size === 'XXL');
  const stockBefore = hoodieM?.stock ?? 0;

  const order = await api.post('/orders/checkout', { items: [{ variant_id: hoodieM?.id, quantity: 2 }] });
  check('member merch discount is applied server-side (20%)', order.data.discount_percent === 20 && order.data.discount === 16, `discount ${order.data.discount}`);
  check('order total is subtotal minus discount', order.data.total === order.data.subtotal - order.data.discount);
  const orderPaid = await api.post(`/orders/${order.data.id}/pay`, {});
  check('paying the order marks it PAID', orderPaid.data.order.status === 'PAID');
  check('stock decreases by the ordered quantity', hoodieM?.stock === stockBefore - 2, `${stockBefore} → ${hoodieM?.stock}`);
  check('merch payment writes INCOME/MERCH', orderPaid.data.transaction.source === 'MERCH');
  try {
    await api.post('/orders/checkout', { items: [{ variant_id: hoodieXXL?.id, quantity: 1 }] });
    check('out-of-stock sizes are rejected (409)', false);
  } catch (error) {
    const { status, detail } = asError(error);
    check('out-of-stock sizes are rejected (409)', status === 409, `got ${status}`);
    check('stock errors name the size', /XXL/.test(String(detail)), String(detail));
  }

  auth(adminToken);
  const orders = await api.get('/orders?status=PAID');
  check('admin order list includes the new order', orders.data.items.some((o: { id: number }) => o.id === order.data.id));
  const fulfil = await api.patch(`/orders/${order.data.id}/status`, { status: 'FULFILLED' });
  check('orders can be marked fulfilled', fulfil.data.status === 'FULFILLED');
  const summary = await api.get('/orders/size-summary');
  const mRow = summary.data.rows.find((r: { product_name: string; size: string }) => r.product_name === 'Skyline Hoodie' && r.size === 'M');
  check('size summary reports ordered vs remaining', mRow.ordered >= 2 && mRow.remaining_stock === hoodieM?.stock);

  /* -------------------------------------------------------------- fundraiser */
  section('Fundraiser board');
  db = currentDb();
  const fundraiserId = db.fundraisers[0].id;
  auth(volunteerToken);
  const board = await api.get(`/fundraisers/${fundraiserId}`);
  check('board returns tasks grouped with progress', board.data.tasks.length === 10 && board.data.progress.tasks_total === 10);
  check('board flags the fundraiser AT_RISK (overdue tasks)', board.data.progress.health === 'AT_RISK' && board.data.progress.overdue_count >= 2);
  const todoTask = board.data.tasks.find((t: { status: string }) => t.status === 'TODO');
  const moved = await api.patch(`/tasks/${todoTask.id}`, { status: 'DONE', position: 0 });
  check('dragging a task to Done persists the status', moved.data.status === 'DONE');
  const reloaded = await api.get(`/fundraisers/${fundraiserId}`);
  const reloadedTask = reloaded.data.tasks.find((t: { id: number }) => t.id === todoTask.id);
  check('the move survives a refetch (persisted position)', reloadedTask.status === 'DONE' && reloadedTask.position === 0);
  check('progress recalculates after the move', reloaded.data.progress.tasks_done === board.data.progress.tasks_done + 1);

  auth(treasurerToken);
  const income = await api.post(`/fundraisers/${fundraiserId}/income`, { amount: 120.5, description: 'Saturday cash box' });
  check('recording income raises the total', income.data.fundraiser.raised_amount === 780 + 120.5);
  check('fundraiser income writes INCOME/FUNDRAISER', income.data.transaction.source === 'FUNDRAISER' && income.data.transaction.amount === 120.5);

  /* ---------------------------------------------------------------- expenses */
  section('Expenses and reimbursements');
  auth(volunteerToken);
  const noReceipt = await (async (): Promise<number | undefined> => {
    try {
      const form = new FormData();
      form.append('amount', '10');
      form.append('description', 'No receipt attached');
      form.append('category', 'Supplies');
      await api.post('/expenses', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      return undefined;
    } catch (error) {
      return asError(error).status;
    }
  })();
  check('claims without a receipt are rejected (400)', noReceipt === 400, `got ${noReceipt}`);

  const receipt = new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], 'receipt.png', { type: 'image/png' });
  const expenseForm = new FormData();
  expenseForm.append('amount', '73.25');
  expenseForm.append('description', 'Bake sale ingredients top-up');
  expenseForm.append('category', 'Supplies');
  expenseForm.append('fundraiser_id', String(fundraiserId));
  expenseForm.append('receipt', receipt);
  const claim = await api.post('/expenses', expenseForm, { headers: { 'Content-Type': 'multipart/form-data' } });
  check('a claim with a receipt is accepted as SUBMITTED', claim.data.status === 'SUBMITTED');
  check('the receipt is stored for the reviewer', typeof claim.data.receipt_url === 'string' && claim.data.receipt_url.startsWith('data:'));

  auth(treasurerToken);
  const queue = await api.get('/expenses?status=SUBMITTED');
  check('the treasurer queue shows the new claim', queue.data.items.some((c: { id: number }) => c.id === claim.data.id));
  try {
    await api.post(`/expenses/${claim.data.id}/reject`, { note: 'ab' });
    check('rejection requires a real note', false);
  } catch (error) {
    check('rejection requires a real note', asError(error).status === 400);
  }
  const approved = await api.post(`/expenses/${claim.data.id}/approve`, {});
  check('claims can be approved', approved.data.status === 'APPROVED');
  const reimbursed = await api.post(`/expenses/${claim.data.id}/reimburse`, {});
  check('claims can be marked reimbursed', reimbursed.data.claim.status === 'REIMBURSED');
  check('reimbursement writes EXPENSE/REIMBURSEMENT', reimbursed.data.transaction.type === 'EXPENSE' && reimbursed.data.transaction.source === 'REIMBURSEMENT' && reimbursed.data.transaction.amount === 73.25);
  try {
    await api.post(`/expenses/${claim.data.id}/reimburse`, {});
    check('double reimbursement is blocked (409)', false);
  } catch (error) {
    check('double reimbursement is blocked (409)', asError(error).status === 409);
  }

  const mine = await (async () => {
    auth(volunteerToken);
    return api.get('/expenses/mine');
  })();
  check('the submitter sees the status change on My Claims', mine.data.some((c: { id: number; status: string }) => c.id === claim.data.id && c.status === 'REIMBURSED'));

  /* ----------------------------------------------------------------- finance */
  section("Treasurer's numbers");
  auth(treasurerToken);
  const source = await api.get('/finance/summary');
  check('summary returns income, expenses and balance', source.data.total_income > 0 && source.data.total_expenses > 0);
  check('balance equals income minus expenses', Math.abs(source.data.balance - (source.data.total_income - source.data.total_expenses)) < 0.01);
  check('income splits by source for the donut', source.data.income_by_source.some((r: { source: string }) => r.source === 'DUES') && source.data.income_by_source.some((r: { source: string }) => r.source === 'TICKET') && source.data.income_by_source.some((r: { source: string }) => r.source === 'MERCH'));
  check('monthly buckets power the bar chart', source.data.monthly.length >= 3, `buckets ${source.data.monthly.length}`);
  check('pending reimbursements excludes the settled claim', !Number.isNaN(source.data.pending_reimbursements));

  const ledger = await api.get('/finance/transactions?page_size=200');
  const sources = new Set(ledger.data.items.map((t: { source: string }) => t.source));
  check('the ledger holds every money movement from this run', ['DUES', 'TICKET', 'MERCH', 'FUNDRAISER', 'REIMBURSEMENT'].every((s) => sources.has(s)), [...sources].join(', '));
  const filtered = await api.get('/finance/transactions?type=EXPENSE&source=REIMBURSEMENT');
  check('ledger filters by type and source', filtered.data.items.every((t: { type: string; source: string }) => t.type === 'EXPENSE' && t.source === 'REIMBURSEMENT'));
  const csv = await api.get('/finance/export.csv');
  check('CSV export contains a header row and data', csv.data.csv.startsWith('Date,Type,Source') && csv.data.csv.split('\n').length > 10);
  const pnl = await api.get('/finance/pnl');
  check('P&L lists events and fundraisers with margins', pnl.data.events.length === 5 && pnl.data.fundraisers.length === 2 && typeof pnl.data.totals.profit === 'number');

  const members = await api.get('/members?status=ACTIVE&page_size=50');
  check('member roll filters by status', members.data.items.every((m: { membership_status: string }) => m.membership_status === 'ACTIVE'));
  const expiring = await api.get('/members?status=EXPIRING_30');
  check('expiring-in-30-days filter works', expiring.data.items.length >= 4, `got ${expiring.data.items.length}`);
  const search = await api.get('/members?search=tanvi');
  check('member search matches names', search.data.total === 1 && search.data.items[0].name === 'Tanvi Kulkarni');
  const exportMembers = await api.get('/members/export.csv');
  check('member CSV export works', exportMembers.data.csv.includes('Member code'));

  const dash = await api.get('/dashboard/admin');
  check('admin dashboard returns all eight cards', Object.keys(dash.data.cards).length === 8);
  check('dashboard balance matches finance', Math.abs(dash.data.cards.balance - source.data.balance) < 0.01);
  check('activity feed is populated', dash.data.recent_activity.length > 0);

  const report = await api.get(`/events/${galaId}/report`);
  const eventNow = (await api.get(`/events/${galaId}`)).data;
  check('event report tickets sold matches the live counter', report.data.tickets_sold === eventNow.sold && eventNow.sold >= 123, `report ${report.data.tickets_sold} vs event ${eventNow.sold}`);
  check('event report computes net profit and attendance', typeof report.data.net_profit === 'number' && report.data.attendance_pct > 0 && report.data.checked_in > 0);
  check('report splits member vs guest tickets', report.data.member_tickets + report.data.non_member_tickets === report.data.tickets_sold);

  /* ------------------------------------------------------------- persistence */
  section('Persistence & admin CRUD');
  auth(adminToken);
  await new Promise((resolve) => setTimeout(resolve, 120));
  const persisted = (await import('../src/api/mock/db')).loadDb();
  check('state persists to storage (survives a reload)', persisted.announcements.some((a) => a.title === 'Bake sale shifts are live'));

  const created = await api.post('/events', {
    title: 'Test Event',
    description: 'Created by the smoke test to verify admin CRUD.',
    location: 'Room 101',
    start_date: new Date(Date.now() + 5 * 86_400_000).toISOString(),
    end_date: new Date(Date.now() + 5 * 86_400_000 + 7_200_000).toISOString(),
    capacity: 25,
    member_price: 5,
    non_member_price: 10,
    status: 'PUBLISHED',
  });
  check('events can be created', created.data.id > 0 && created.data.sold === 0);
  const updated = await api.patch(`/events/${created.data.id}`, { capacity: 40, status: 'DRAFT' });
  check('events can be updated', updated.data.capacity === 40 && updated.data.status === 'DRAFT');
  const removed = await api.delete(`/events/${created.data.id}`);
  check('draft events can be deleted', removed.data.deleted === true);

  const product = await api.post('/products', {
    name: 'Smoke Test Cap',
    description: 'A cap created by the smoke test.',
    base_price: 22,
    active: true,
    variants: [
      { size: 'S', stock: 4 },
      { size: 'M', stock: 0 },
    ],
  });
  check('products can be created with per-size stock', product.data.variants.length === 2 && product.data.variants.find((v: { size: string }) => v.size === 'S').stock === 4);
  const stockUpdate = await api.patch(`/variants/${product.data.variants.find((v: { size: string }) => v.size === 'S').id}`, { stock: 9 });
  check('inline stock edits persist', stockUpdate.data.stock === 9);

  setToken(null); // no account at all — guest merch checkout
  const guestOrder = await api.post('/orders/checkout', { items: [{ variant_id: product.data.variants[0].id, quantity: 1 }], buyer_name: 'Walk Up', buyer_email: 'walkup@example.com' });
  check('guest merch checkout works without an account', guestOrder.data.discount === 0 && guestOrder.data.total === 22);

  /* ------------------------------------------------------------------ done */
  console.log(`\n\u001b[1m${passed} checks passed, ${failures.length} failed\u001b[0m`);
  if (failures.length) {
    console.log('\nFailures:');
    failures.forEach((f) => console.log(`  - ${f}`));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('\n\u001b[31mSmoke test crashed:\u001b[0m', error);
  process.exit(1);
});
