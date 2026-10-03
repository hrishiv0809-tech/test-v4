import * as React from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ProtectedRoute, RequireRole } from '@/components/layout/ProtectedRoute';

import Home from '@/pages/public/Home';
import Events from '@/pages/public/Events';
import EventDetail from '@/pages/public/EventDetail';
import Announcements from '@/pages/public/Announcements';
import Store from '@/pages/public/Store';
import ProductDetail from '@/pages/public/ProductDetail';
import Membership from '@/pages/public/Membership';
import Login from '@/pages/public/Login';
import Signup from '@/pages/public/Signup';
import Checkout from '@/pages/public/Checkout';
import TicketSuccess from '@/pages/public/TicketSuccess';
import Unsubscribe from '@/pages/public/Unsubscribe';
import NotFound from '@/pages/public/NotFound';

import AdminDashboard from '@/pages/dashboard/AdminDashboard';
import Members from '@/pages/dashboard/Members';
import MemberProfile from '@/pages/dashboard/MemberProfile';
import MyCard from '@/pages/dashboard/MyCard';
import VerifyMember from '@/pages/dashboard/VerifyMember';
import EventsAdmin from '@/pages/dashboard/EventsAdmin';
import EventForm from '@/pages/dashboard/EventForm';
import EventReport from '@/pages/dashboard/EventReport';
import CheckIn from '@/pages/dashboard/CheckIn';
import AnnouncementsAdmin from '@/pages/dashboard/AnnouncementsAdmin';
import AnnouncementComposer from '@/pages/dashboard/AnnouncementComposer';
import EmailLog from '@/pages/dashboard/EmailLog';
import StoreAdmin from '@/pages/dashboard/StoreAdmin';
import OrdersAdmin from '@/pages/dashboard/OrdersAdmin';
import Fundraisers from '@/pages/dashboard/Fundraisers';
import FundraiserDetail from '@/pages/dashboard/FundraiserDetail';
import MyTasks from '@/pages/dashboard/MyTasks';
import ExpensesQueue from '@/pages/dashboard/ExpensesQueue';
import ExpenseNew from '@/pages/dashboard/ExpenseNew';
import MyClaims from '@/pages/dashboard/MyClaims';
import Finance from '@/pages/dashboard/Finance';
import Transactions from '@/pages/dashboard/Transactions';
import FinanceReport from '@/pages/dashboard/FinanceReport';
import Profile from '@/pages/dashboard/Profile';
import MyTickets from '@/pages/dashboard/MyTickets';
import MyOrders from '@/pages/dashboard/MyOrders';

import { plansApi } from '@/api/memberships';
import { API_BASE_URL, USE_MOCKS } from '@/api/client';

const STAFF: ('ADMIN' | 'TREASURER')[] = ['ADMIN', 'TREASURER'];
const WIDE: ('ADMIN' | 'TREASURER' | 'VOLUNTEER')[] = ['ADMIN', 'TREASURER', 'VOLUNTEER'];

/**
 * When mock mode is off the app talks to the FastAPI backend. If that server is
 * not running we say so plainly instead of showing a wall of failed queries.
 */
function ApiHealthGate({ children }: { children: React.ReactNode }): JSX.Element {
  const location = useLocation();
  const enabled = !USE_MOCKS && location.pathname !== '/login' && location.pathname !== '/signup';
  const probe = useQuery({
    queryKey: ['health', 'plans'],
    queryFn: () => plansApi.list(),
    enabled,
    retry: false,
    staleTime: 30_000,
  });

  if (enabled && probe.isError) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4">
        <Card className="max-w-lg">
          <CardContent className="p-8 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
              <AlertTriangle className="size-6" />
            </span>
            <h1 className="mt-4 text-lg font-semibold">Can't reach the API</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Nothing is answering at <span className="font-mono text-xs">{API_BASE_URL}</span>. Start the FastAPI backend, or switch the
              frontend to demo mode by setting <span className="font-mono text-xs">VITE_USE_MOCKS=true</span> in <span className="font-mono text-xs">.env</span>.
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <Button onClick={() => probe.refetch()}>
                <RefreshCw /> Try again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

function RouteFallback(): JSX.Element {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <p className="text-sm text-muted-foreground">Loading…</p>
    </div>
  );
}

export default function App(): JSX.Element {
  return (
    <ApiHealthGate>
      <React.Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* ---------------------------------------------------------- public */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/events" element={<Events />} />
            <Route path="/events/:id" element={<EventDetail />} />
            <Route path="/announcements" element={<Announcements />} />
            <Route path="/store" element={<Store />} />
            <Route path="/store/:id" element={<ProductDetail />} />
            <Route path="/membership" element={<Membership />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/tickets/:code" element={<TicketSuccess />} />
            <Route path="/unsubscribe/:token" element={<Unsubscribe />} />
            <Route path="*" element={<NotFound />} />
          </Route>

          {/* ------------------------------------------------------- dashboard */}
          <Route element={<ProtectedRoute />}>
            <Route path="/app" element={<Navigate to="/app/dashboard" replace />} />
            <Route element={<DashboardLayout />}>
              <Route path="/app/dashboard" element={<AdminDashboard />} />

              {/* everyone */}
              <Route path="/app/card" element={<MyCard />} />
              <Route path="/app/profile" element={<Profile />} />
              <Route path="/app/my-tickets" element={<MyTickets />} />
              <Route path="/app/my-orders" element={<MyOrders />} />
              <Route path="/app/expenses/new" element={<ExpenseNew />} />
              <Route path="/app/my-claims" element={<MyClaims />} />

              {/* volunteers and above */}
              <Route element={<RequireRole roles={WIDE} />}>
                <Route path="/app/verify" element={<VerifyMember />} />
                <Route path="/app/checkin" element={<CheckIn />} />
                <Route path="/app/fundraisers" element={<Fundraisers />} />
                <Route path="/app/fundraisers/:id" element={<FundraiserDetail />} />
                <Route path="/app/my-tasks" element={<MyTasks />} />
              </Route>

              {/* admin + treasurer */}
              <Route element={<RequireRole roles={STAFF} />}>
                <Route path="/app/members" element={<Members />} />
                <Route path="/app/members/:id" element={<MemberProfile />} />
                <Route path="/app/events" element={<EventsAdmin />} />
                <Route path="/app/events/new" element={<EventForm />} />
                <Route path="/app/events/:id/edit" element={<EventForm />} />
                <Route path="/app/events/:id/report" element={<EventReport />} />
                <Route path="/app/announcements" element={<AnnouncementsAdmin />} />
                <Route path="/app/announcements/new" element={<AnnouncementComposer />} />
                <Route path="/app/emails" element={<EmailLog />} />
                <Route path="/app/store" element={<StoreAdmin />} />
                <Route path="/app/orders" element={<OrdersAdmin />} />
                <Route path="/app/expenses" element={<ExpensesQueue />} />
                <Route path="/app/finance" element={<Finance />} />
                <Route path="/app/finance/transactions" element={<Transactions />} />
                <Route path="/app/finance/report" element={<FinanceReport />} />
              </Route>

              <Route path="/app/*" element={<NotFound />} />
            </Route>
          </Route>
        </Routes>
      </React.Suspense>
    </ApiHealthGate>
  );
}
