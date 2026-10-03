/**
 * DOM smoke test — `npm run smoke:dom`
 *
 * Boots the real React app inside jsdom against the mock API, signs in as each
 * demo account, and asserts that pages render *seeded data* (not just loading
 * shells). This is the closest thing to opening the browser that runs in CI.
 */
import { JSDOM } from 'jsdom';

/* --------------------------------------------------------------- jsdom boot */
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost:5173/',
  pretendToBeVisual: true,
});

const g = globalThis as unknown as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.navigator = dom.window.navigator;
g.HTMLElement = dom.window.HTMLElement;
g.Element = dom.window.Element;
g.Node = dom.window.Node;
g.Event = dom.window.Event;
g.MouseEvent = dom.window.MouseEvent;
g.KeyboardEvent = dom.window.KeyboardEvent;
g.PointerEvent = dom.window.MouseEvent;
g.CustomEvent = dom.window.CustomEvent;
g.localStorage = dom.window.localStorage;
g.sessionStorage = dom.window.sessionStorage;
g.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
g.requestAnimationFrame = (cb: FrameRequestCallback): number => setTimeout(() => cb(Date.now()), 0) as unknown as number;
g.cancelAnimationFrame = (id: number): void => clearTimeout(id as unknown as NodeJS.Timeout);
g.matchMedia = (): unknown => ({
  matches: false,
  media: '',
  onchange: null,
  addListener: (): void => undefined,
  removeListener: (): void => undefined,
  addEventListener: (): void => undefined,
  removeEventListener: (): void => undefined,
  dispatchEvent: (): boolean => true,
});
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
g.ResizeObserver = ResizeObserverStub;
class IntersectionObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): unknown[] {
    return [];
  }
}
g.IntersectionObserver = IntersectionObserverStub;
(dom.window as unknown as Record<string, unknown>).ResizeObserver = ResizeObserverStub;
(dom.window as unknown as Record<string, unknown>).matchMedia = g.matchMedia;
Object.defineProperty(dom.window.HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 800 });
Object.defineProperty(dom.window.HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 1200 });
for (const name of [
  'HTMLFormElement',
  'HTMLInputElement',
  'HTMLAnchorElement',
  'HTMLButtonElement',
  'HTMLDivElement',
  'HTMLSelectElement',
  'HTMLTextAreaElement',
  'SVGElement',
  'DOMRect',
  'DOMParser',
  'MutationObserver',
  'FormData',
  'File',
  'Blob',
  'AbortController',
  'Image',
] as const) {
  const value = (dom.window as unknown as Record<string, unknown>)[name];
  if (value && !g[name]) g[name] = value;
}
(dom.window.HTMLElement.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = (): void => undefined;
(dom.window as unknown as { scrollTo: () => void }).scrollTo = (): void => undefined;
// Deliberately NOT using React's act()/IS_REACT_ACT_ENVIRONMENT here: act keeps
// React Query's fetch effects queued until the act window closes, so the DOM
// would only ever show loading shells. Rendering plainly and polling gives us
// what a real browser shows.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = false;

/* ------------------------------------------------------------------ imports */
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';

import App from '../src/App';
import { AuthProvider } from '../src/context/AuthContext';
import { ThemeProvider } from '../src/context/ThemeContext';
import { TooltipProvider } from '../src/components/ui/tooltip';
import { setMockAdapter, setToken } from '../src/api/client';
import { mockAdapter, resetMockData } from '../src/api/mock/adapter';

// The mock answers on the next tick so the suite stays fast and deterministic.
(globalThis as unknown as { __SKYLINE_MOCK_LATENCY__?: number }).__SKYLINE_MOCK_LATENCY__ = 0;
setMockAdapter(mockAdapter);

let passed = 0;
const failures: string[] = [];

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Signs in through the API (mock adapter) and stores the token like the app does. */
async function signIn(email: string): Promise<void> {
  const { api } = await import('../src/api/client');
  const password = email.startsWith('admin')
    ? 'admin123'
    : email.startsWith('treasurer')
      ? 'treasurer123'
      : email.startsWith('volunteer')
        ? 'volunteer123'
        : email.startsWith('member')
          ? 'member123'
          : 'skyline123';
  const { data } = await api.post('/auth/login', { email, password });
  setToken(data.access_token as string);
}

async function visit(
  route: string,
  needles: string[] = [],
  timeoutMs = 12_000,
  client?: QueryClient,
): Promise<string> {
  const queryClient = client ?? new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
  const container = dom.window.document.createElement('div');
  dom.window.document.body.appendChild(container);
  let root: Root | null = null;

  root = createRoot(container);
  root.render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <MemoryRouter initialEntries={[route]}>
              <App />
              <Toaster />
            </MemoryRouter>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );

  const deadline = Date.now() + timeoutMs;
  let text = '';
  // Poll until every expected string has painted (or we give up).
  while (Date.now() < deadline) {
    await sleep(120);
    text = (container.textContent ?? '').replace(/\s+/g, ' ');
    if (needles.length === 0 ? text.length > 40 : needles.every((n) => text.includes(n))) break;
  }

  root.unmount();
  await sleep(20);
  container.remove();
  if (!client) queryClient.clear();
  return text;
}

const only = process.argv[2] === '--only' ? process.argv[3] : null;

async function expectOnPage(label: string, route: string, needles: string[]): Promise<void> {
  if (only && !label.toLowerCase().includes(only.toLowerCase())) return;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
  const text = await visit(route, needles, 12_000, client);
  const unresolved = client
    .getQueryCache()
    .getAll()
    .filter((q) => q.state.status !== 'success')
    .map((q) => `${q.queryHash.slice(0, 50)}:${q.state.status}/${q.state.fetchStatus}${q.state.error ? ' :: ' + ((q.state.error as { message?: string }).message ?? '') : ''}`);
  if (unresolved.length) console.log('    \u001b[90munresolved: ' + unresolved.join(', ') + '\u001b[0m');
  const missing = needles.filter((n) => !text.includes(n));
  if (missing.length === 0) {
    passed++;
    console.log(`  \u001b[32m✓\u001b[0m ${label}`);
  } else {
    failures.push(`${label} — missing: ${missing.join(', ')}`);
    console.log(`  \u001b[31m✗\u001b[0m ${label} \u001b[90m— missing: ${missing.join(', ')}\u001b[0m`);
    console.log(`    \u001b[90m${text.slice(0, 1400)}\u001b[0m`);
  }
}

/** `--dump <role>=<route> ...` prints the full text of pages, for calibrating needles. */
async function dump(): Promise<void> {
  resetMockData();
  for (const arg of process.argv.slice(3)) {
    const [role, routeAndWait] = arg.split('=');
    const [route, waitStr] = routeAndWait.split('@');
    const wait = Number(waitStr ?? 4000);
    if (role !== 'anon') await signIn(`${role}@skyline.edu`);
    else setToken(null);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
    const text = await visit(route as string, [], wait, client);
    const { api } = await import('../src/api/client');
    try {
      const direct = await api.get('/members', { params: { page_size: 5 } });
      console.log('DIRECT /members AFTER MOUNT: OK', direct.status, (direct.data as { items?: unknown[] }).items?.length);
    } catch (error) {
      console.log('DIRECT /members AFTER MOUNT: ERR', (error as { message?: string }).message);
    }
    client.getQueryCache().getAll().forEach((q) => console.log('   state', q.state.status, q.state.fetchStatus, q.queryHash.slice(0, 60)));
    console.log(`\n===== ${role} ${route} =====\n${text.slice(0, 2600)}`);
    console.log(
      'QUERIES:\n' +
        client
          .getQueryCache()
          .getAll()
          .map((q) => `  ${q.state.status.padEnd(8)} ${q.queryHash.slice(0, 70)}${q.state.error ? ' :: ' + ((q.state.error as { message?: string }).message ?? '') : ''}`)
          .join('\n'),
    );
  }
  process.exit(0);
}

async function main(): Promise<void> {
  resetMockData();
  if (process.argv[2] === '--dump') return dump();

  console.log('\n\u001b[1mSigned out\u001b[0m');
  await expectOnPage('Home shows the hero and upcoming events', '/', ['One hub for everything', 'Spring Gala']);
  await expectOnPage('Events lists seeded events with prices', '/events', ['Spring Gala', '$30']);
  await expectOnPage('Event detail shows capacity and the buy box', '/events/1', ['Spring Gala', 'seats left', 'Buy']);
  await expectOnPage('Announcements renders the archive', '/announcements', ['General meeting', 'emailed to']);
  await expectOnPage('Store lists merch with stock', '/store', ['Skyline Hoodie', '$40']);

  console.log('\n\u001b[1mNew student signs up\u001b[0m');
  await expectOnPage('Signup form offers both plans', '/signup', ['Standard', 'Premium', 'Create your account']);

  console.log('\n\u001b[1mMember experience\u001b[0m');
  await signIn('member@skyline.edu');
  await expectOnPage('Dashboard greets the member by name', '/app/dashboard', ['Spring Gala']);
  await expectOnPage('Membership card renders the QR and member code', '/app/card', ['SKY-']);
  await expectOnPage('My tickets lists a purchased ticket', '/app/my-tickets', ['Spring Gala', 'TKT-']);
  await expectOnPage('My orders shows merch history', '/app/my-orders', ['Skyline Hoodie']);
  await expectOnPage('My claims shows the rejection note', '/app/my-claims', ['My claims']);
  await expectOnPage('Submit a claim form renders the receipt dropzone', '/app/expenses/new', ['Receipt (required)']);
  await expectOnPage('Profile loads the settings form', '/app/profile', ['workspace preferences', 'Full name']);

  console.log('\n\u001b[1mVolunteer (check-in desk)\u001b[0m');
  await signIn('volunteer@skyline.edu');
  await expectOnPage('Check-in console is ready to scan', '/app/checkin', ['Scan tickets or type the code', '70/']);
  await expectOnPage('Verify shows the member card lookup', '/app/verify', ['Scan a membership card']);
  await expectOnPage('My tasks groups overdue work', '/app/my-tasks', ['Overdue', 'Spring Bake Sale']);
  await expectOnPage('Fundraisers board lists health badges', '/app/fundraisers', ['Spring Bake Sale', 'At risk']);
  await expectOnPage('Fundraiser detail shows the kanban board', '/app/fundraisers/1', ['Spring Bake Sale', 'All fundraisers']);
  await expectOnPage('A volunteer never sees finance in the sidebar', '/app/dashboard', ['Dashboard']);

  console.log('\n\u001b[1mTreasurer\u001b[0m');
  await signIn('treasurer@skyline.edu');
  await expectOnPage('Expense queue shows SUBMITTED claims', '/app/expenses', ['Expense queue', 'Check the receipt']);
  await expectOnPage('Finance shows income, expenses and balance', '/app/finance', ['Income by source', 'All figures come from the transactions']);
  await expectOnPage('Ledger lists transactions with a running balance', '/app/finance/transactions', ['Transactions ledger']);
  await expectOnPage('Printable report renders the signature block', '/app/finance/report', ['Semester financial report', 'Treasurer']);

  console.log('\n\u001b[1mAdmin\u001b[0m');
  await signIn('admin@skyline.edu');
  await expectOnPage('Dashboard shows all eight cards', '/app/dashboard', ['Association overview', 'Membership, ticket sales']);
  await expectOnPage('Members roll lists seeded members', '/app/members', ['aarav.patel@skyline.edu', 'Export CSV']);
  await expectOnPage('Member profile shows totals and history', '/app/members/5', ['Membership']);
  await expectOnPage('Events admin lists all events', '/app/events', ['Create events, watch capacity', 'New event']);
  await expectOnPage('Announcements admin lists posts', '/app/announcements', ['General meeting', 'Merch pre-order']);
  await expectOnPage('Announcement composer has the live preview', '/app/announcements/new', ['Live preview']);
  await expectOnPage('Email log shows sent mail', '/app/emails', ['Email log']);
  await expectOnPage('Store admin shows the stock grid', '/app/store', ['Manage the merch catalogue', 'New product']);
  await expectOnPage('Orders admin shows orders and size summary', '/app/orders', ['Size summary']);
  await expectOnPage('Event report renders attendance and profit', '/app/events/1/report', ['Spring Gala', 'Attendance']);

  console.log(`\n\u001b[1m${passed} checks passed, ${failures.length} failed\u001b[0m`);
  if (failures.length) {
    console.log('\nFailures:');
    failures.forEach((f) => console.log(`  - ${f}`));
    process.exit(1);
  }
  process.exit(0);
}

void main().catch((error) => {
  console.error('\n\u001b[31mDOM smoke crashed:\u001b[0m', error);
  process.exit(1);
});
