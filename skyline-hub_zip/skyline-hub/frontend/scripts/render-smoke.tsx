/**
 * Render smoke test — `npm run smoke:render`
 *
 * Server-renders every route and page component with react-dom/server. Data
 * fetching effects don't run in SSR, so pages appear in their loading state —
 * which is exactly what we want to verify: no crashed imports, no bad hook
 * usage, no undefined components, and every page produces real markup.
 */
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/* ------------------------------------------------------------------ shims */
const store = new Map<string, string>();
(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: (k: string): string | null => store.get(k) ?? null,
  setItem: (k: string, v: string): void => {
    store.set(k, String(v));
  },
  removeItem: (k: string): void => {
    store.delete(k);
  },
  clear: (): void => store.clear(),
  key: (i: number): string | null => [...store.keys()][i] ?? null,
  get length(): number {
    return store.size;
  },
};
(globalThis as unknown as { window: unknown }).window = {
  location: { pathname: '/', assign: (): void => undefined, href: '' },
  addEventListener: (): void => undefined,
  removeEventListener: (): void => undefined,
  dispatchEvent: (): boolean => true,
  scrollTo: (): void => undefined,
  matchMedia: () => ({ matches: false, addEventListener: (): void => undefined, removeEventListener: (): void => undefined }),
};
(globalThis as unknown as { URL: unknown }).URL = Object.assign(URL, { createObjectURL: (): string => 'blob:mock', revokeObjectURL: (): void => undefined });

import App from '../src/App';
import { AuthProvider } from '../src/context/AuthContext';
import { ThemeProvider } from '../src/context/ThemeContext';
import { TooltipProvider } from '../src/components/ui/tooltip';
import { DashboardLayout } from '../src/components/layout/DashboardLayout';
import { ApiErrorBoundary } from '../src/components/layout/ApiErrorBoundary';

import AdminDashboard from '../src/pages/dashboard/AdminDashboard';
import Members from '../src/pages/dashboard/Members';
import MemberProfile from '../src/pages/dashboard/MemberProfile';
import MyCard from '../src/pages/dashboard/MyCard';
import VerifyMember from '../src/pages/dashboard/VerifyMember';
import EventsAdmin from '../src/pages/dashboard/EventsAdmin';
import EventForm from '../src/pages/dashboard/EventForm';
import EventReport from '../src/pages/dashboard/EventReport';
import CheckIn from '../src/pages/dashboard/CheckIn';
import AnnouncementsAdmin from '../src/pages/dashboard/AnnouncementsAdmin';
import AnnouncementComposer from '../src/pages/dashboard/AnnouncementComposer';
import EmailLogPage from '../src/pages/dashboard/EmailLog';
import StoreAdmin from '../src/pages/dashboard/StoreAdmin';
import OrdersAdmin from '../src/pages/dashboard/OrdersAdmin';
import Fundraisers from '../src/pages/dashboard/Fundraisers';
import FundraiserDetail from '../src/pages/dashboard/FundraiserDetail';
import MyTasks from '../src/pages/dashboard/MyTasks';
import ExpensesQueue from '../src/pages/dashboard/ExpensesQueue';
import ExpenseNew from '../src/pages/dashboard/ExpenseNew';
import MyClaims from '../src/pages/dashboard/MyClaims';
import Finance from '../src/pages/dashboard/Finance';
import Transactions from '../src/pages/dashboard/Transactions';
import FinanceReport from '../src/pages/dashboard/FinanceReport';
import Profile from '../src/pages/dashboard/Profile';
import MyTickets from '../src/pages/dashboard/MyTickets';
import MyOrders from '../src/pages/dashboard/MyOrders';

let passed = 0;
const failures: string[] = [];

/** Providers only — the router is supplied per render so we never nest two. */
function Providers({ children }: { children: React.ReactNode }): JSX.Element {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <ApiErrorBoundary>
          <AuthProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </AuthProvider>
        </ApiErrorBoundary>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function renderRoute(label: string, route: string, options: { marker?: string; element?: React.ReactNode } = {}): void {
  try {
    const html = renderToString(
      <Providers>
        {options.element ? (
          <MemoryRouter initialEntries={[route]}>
            <DashboardLayout>{options.element}</DashboardLayout>
          </MemoryRouter>
        ) : (
          <MemoryRouter initialEntries={[route]}>
            <App />
          </MemoryRouter>
        )}
      </Providers>,
    );
    // Data-driven pages render their loading skeleton during SSR (no data yet),
    // so a skeleton is a pass — but a page with neither marker nor skeleton is not.
    const hasMarker = Boolean(options.marker) && html.includes(options.marker as string);
    const hasSkeleton = html.includes('animate-pulse');
    const ok = html.length > 200 && (!options.marker || hasMarker || hasSkeleton);
    if (ok) {
      passed++;
      console.log(`  \u001b[32m✓\u001b[0m ${label}${!hasMarker && options.marker ? ' \u001b[90m(loading shell)\u001b[0m' : ''}`);
    } else {
      failures.push(label);
      console.log(`  \u001b[31m✗\u001b[0m ${label} — html ${html.length} bytes${options.marker ? `, marker "${options.marker}" missing` : ''}`);
    }
  } catch (error) {
    failures.push(label);
    console.log(`  \u001b[31m✗\u001b[0m ${label} — ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log('\n\u001b[1mPublic routes (full app shell)\u001b[0m');
renderRoute('Home', '/', { marker: 'One hub for everything' });
renderRoute('Events', '/events', { marker: 'Get tickets' });
renderRoute('Event detail', '/events/1', { marker: 'Spring Gala' });
renderRoute('Announcements', '/announcements', { marker: 'permanent archive' });
renderRoute('Store', '/store', { marker: 'Merch store' });
renderRoute('Product detail', '/store/1', { marker: 'Product' });
renderRoute('Membership', '/membership', { marker: 'Membership' });
renderRoute('Login (demo accounts box)', '/login', { marker: 'Demo accounts' });
renderRoute('Signup', '/signup', { marker: 'Create your account' });
renderRoute('Checkout (empty cart)', '/checkout', { marker: 'cart is empty' });
renderRoute('Unsubscribe', '/unsubscribe/unsub-1000-37', { marker: 'Unsubscrib' });
renderRoute('404 page', '/this-does-not-exist', { marker: 'Page not found' });

console.log('\n\u001b[1mDashboard pages (inside the app shell)\u001b[0m');
renderRoute('Dashboard', '/app/dashboard', { element: <AdminDashboard /> });
renderRoute('Members', '/app/members', { element: <Members />, marker: 'Export CSV' });
renderRoute('Member profile', '/app/members/5', { element: <MemberProfile /> });
renderRoute('My card', '/app/card', { element: <MyCard /> });
renderRoute('Verify member', '/app/verify', { element: <VerifyMember />, marker: 'Waiting for a scan' });
renderRoute('Events admin', '/app/events', { element: <EventsAdmin />, marker: 'New event' });
renderRoute('Event form', '/app/events/new', { element: <EventForm />, marker: 'Create event' });
renderRoute('Event report', '/app/events/1/report', { element: <EventReport /> });
renderRoute('Check-in', '/app/checkin', { element: <CheckIn />, marker: 'Manual entry' });
renderRoute('Announcements admin', '/app/announcements', { element: <AnnouncementsAdmin />, marker: 'New announcement' });
renderRoute('Announcement composer', '/app/announcements/new', { element: <AnnouncementComposer />, marker: 'Live preview' });
renderRoute('Email log', '/app/emails', { element: <EmailLogPage />, marker: 'Email log' });
renderRoute('Store admin', '/app/store', { element: <StoreAdmin />, marker: 'Products & stock' });
renderRoute('Orders admin', '/app/orders', { element: <OrdersAdmin />, marker: 'Size summary' });
renderRoute('Fundraisers', '/app/fundraisers', { element: <Fundraisers />, marker: 'Fundraisers' });
renderRoute('Fundraiser board', '/app/fundraisers/1', { element: <FundraiserDetail /> });
renderRoute('My tasks', '/app/my-tasks', { element: <MyTasks />, marker: 'My tasks' });
renderRoute('Expense queue', '/app/expenses', { element: <ExpensesQueue />, marker: 'Expense queue' });
renderRoute('New claim', '/app/expenses/new', { element: <ExpenseNew />, marker: 'Receipt (required)' });
renderRoute('My claims', '/app/my-claims', { element: <MyClaims />, marker: 'My claims' });
renderRoute('Finance', '/app/finance', { element: <Finance />, marker: 'Income by source' });
renderRoute('Ledger', '/app/finance/transactions', { element: <Transactions />, marker: 'Transactions ledger' });
renderRoute('Printable report', '/app/finance/report', { element: <FinanceReport />, marker: 'Semester financial report' });
renderRoute('Profile', '/app/profile', { element: <Profile />, marker: 'workspace preferences' });
renderRoute('My tickets', '/app/my-tickets', { element: <MyTickets />, marker: 'My tickets' });
renderRoute('My orders', '/app/my-orders', { element: <MyOrders />, marker: 'My orders' });

console.log('\n\u001b[1mGuards\u001b[0m');
try {
  const html = renderToString(
    <Providers>
      <MemoryRouter initialEntries={['/app/finance']}>
        <App />
      </MemoryRouter>
    </Providers>,
  );
  // Signed out: the auth guard renders the branded loader, never the finance page.
  const ok = !html.includes('Transactions ledger') && !html.includes('Income by source');
  if (ok) {
    passed++;
    console.log('  \u001b[32m✓\u001b[0m signed-out visitors never reach /app/finance');
  } else {
    failures.push('signed-out guard');
    console.log('  \u001b[31m✗\u001b[0m signed-out visitors reached a protected page');
  }
} catch (error) {
  failures.push('signed-out guard');
  console.log(`  \u001b[31m✗\u001b[0m signed-out guard — ${error instanceof Error ? error.message : String(error)}`);
}

console.log(`\n\u001b[1m${passed} pages rendered, ${failures.length} failed\u001b[0m`);
if (failures.length) {
  console.log('\nFailures:');
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
