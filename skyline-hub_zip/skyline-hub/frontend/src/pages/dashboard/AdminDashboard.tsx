import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Banknote,
  CalendarDays,
  ClipboardList,
  HeartHandshake,
  Mail,
  Megaphone,
  QrCode,
  Receipt,
  ShoppingBag,
  Ticket,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/shared/StatCard';
import { PageHeader } from '@/components/shared/PageHeader';
import { CardsSkeleton, ListSkeleton } from '@/components/shared/LoadingSkeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { dashboardApi } from '@/api/dashboard';
import { useAuth } from '@/context/AuthContext';
import { daysUntil, formatCurrency, formatDate, fromNow } from '@/lib/utils';

function QuickActions(): JSX.Element {
  const actions = [
    { to: '/app/members', label: 'Add member', icon: UserPlus },
    { to: '/app/events/new', label: 'Create event', icon: CalendarDays },
    { to: '/app/announcements/new', label: 'Post announcement', icon: Megaphone },
    { to: '/app/checkin', label: 'Check-in mode', icon: QrCode },
  ];
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Quick actions</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2">
        {actions.map((action) => (
          <Button key={action.to} variant="outline" className="h-auto flex-col items-start gap-2 py-3 text-left" asChild>
            <Link to={action.to}>
              <action.icon className="size-4 text-primary" />
              <span className="text-xs font-medium">{action.label}</span>
            </Link>
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}

function AdminHome(): JSX.Element {
  const dashboard = useQuery({ queryKey: ['dashboard', 'admin'], queryFn: () => dashboardApi.admin() });

  if (dashboard.isLoading) {
    return (
      <>
        <CardsSkeleton count={8} />
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <ListSkeleton rows={5} />
          <CardsSkeleton count={1} className="h-40" />
        </div>
      </>
    );
  }

  if (dashboard.isError || !dashboard.data) {
    return <EmptyState icon={Activity} title="Dashboard unavailable" description="We couldn't load the overview. Try again in a moment." action={<Button onClick={() => dashboard.refetch()}>Retry</Button>} />;
  }

  const { cards, recent_activity, latest_announcement } = dashboard.data;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active members" value={cards.active_members} icon={Users} to="/app/members" hint="Paid-up this academic year" />
        <StatCard label="Expiring in 30 days" value={cards.expiring_soon} icon={ClipboardList} tone="warn" to="/app/members" hint="Reminders ready to send" />
        <StatCard label="Upcoming events" value={cards.upcoming_events} icon={CalendarDays} to="/app/events" hint="Published & future-dated" />
        <StatCard label="Tickets sold this week" value={cards.tickets_sold_this_week} icon={Ticket} tone="positive" to="/app/events" />
        <StatCard label="Open orders" value={cards.open_orders} icon={ShoppingBag} to="/app/orders" hint="Pending or paid, not fulfilled" />
        <StatCard label="Open tasks" value={cards.open_tasks} icon={HeartHandshake} to="/app/fundraisers" hint="Across all fundraisers" />
        <StatCard label="Pending claims" value={cards.pending_claims} icon={Receipt} tone="warn" to="/app/expenses" hint="Awaiting treasurer review" />
        <StatCard label="Current balance" value={formatCurrency(cards.balance)} icon={Banknote} tone={cards.balance >= 0 ? 'positive' : 'danger'} to="/app/finance" hint="Income minus expenses" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Activity className="size-4 text-primary" /> Recent activity
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/app/finance/transactions">View ledger</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-1">
            {recent_activity.length === 0 ? (
              <EmptyState icon={Activity} title="No activity yet" description="Ticket sales, dues payments and expenses will show up here." />
            ) : (
              recent_activity.map((item) => (
                <div key={item.id} className="flex items-start gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-muted/60">
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                    {item.type === 'TICKET' ? <Ticket className="size-4" /> : item.type === 'EXPENSE' ? <Receipt className="size-4" /> : item.type === 'ANNOUNCEMENT' ? <Megaphone className="size-4" /> : item.amount && item.amount > 0 ? <TrendingUp className="size-4 text-emerald-600" /> : <TrendingDown className="size-4 text-red-600" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.description} · {item.actor_name} · {fromNow(item.created_at)}
                    </p>
                  </div>
                  {typeof item.amount === 'number' ? (
                    <span className={item.amount >= 0 ? 'text-sm font-semibold text-emerald-700 dark:text-emerald-300' : 'text-sm font-semibold text-red-600'}>
                      {item.amount >= 0 ? '+' : '−'}
                      {formatCurrency(Math.abs(item.amount))}
                    </span>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <QuickActions />
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Megaphone className="size-4 text-primary" /> Latest announcement
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {latest_announcement ? (
                <>
                  <p className="text-sm font-medium">{latest_announcement.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(latest_announcement.published_at, 'MMM d, yyyy · h:mm a')}
                    {latest_announcement.email_sent ? ` · emailed to ${latest_announcement.recipient_count}` : ' · not emailed'}
                  </p>
                  <Separator />
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <Link to="/app/announcements">History</Link>
                    </Button>
                    <Button size="sm" asChild>
                      <Link to="/app/announcements/new">New post</Link>
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Nothing posted yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function MemberHome(): JSX.Element {
  const { user } = useAuth();
  const dashboard = useQuery({ queryKey: ['dashboard', 'me'], queryFn: () => dashboardApi.me() });

  if (dashboard.isLoading) {
    return (
      <>
        <CardsSkeleton count={4} />
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <ListSkeleton rows={3} />
          <ListSkeleton rows={3} />
        </div>
      </>
    );
  }

  if (dashboard.isError || !dashboard.data) {
    return <EmptyState icon={Activity} title="Couldn't load your dashboard" action={<Button onClick={() => dashboard.refetch()}>Retry</Button>} />;
  }

  const data = dashboard.data;
  const membership = data.membership;
  const daysLeft = membership?.end_date ? daysUntil(membership.end_date) : 0;

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr]">
        <StatCard
          label="Membership"
          value={membership ? (membership.status === 'ACTIVE' ? `${daysLeft} days left` : membership.status === 'PENDING_PAYMENT' ? 'Dues pending' : 'Expired') : 'No membership'}
          icon={Users}
          tone={membership?.status === 'ACTIVE' ? 'positive' : 'warn'}
          hint={membership ? `${membership.plan?.name ?? 'Plan'} · expires ${formatDate(membership.end_date)}` : 'Join to unlock member pricing'}
          to="/app/card"
        />
        <StatCard label="My tickets" value={data.my_tickets.length} icon={Ticket} to="/app/my-tickets" hint="Upcoming and past" />
        <StatCard label="My orders" value={data.my_orders.length} icon={ShoppingBag} to="/app/my-orders" hint="Merch history" />
      </div>

      {membership?.status === 'PENDING_PAYMENT' ? (
        <Card className="mt-6 border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Your dues are outstanding</p>
              <p className="text-sm text-muted-foreground">Pay now to activate your discounts and membership card.</p>
            </div>
            <Button asChild>
              <Link to="/membership">Pay {formatCurrency(membership.plan?.price ?? 0)}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-sm">
              <CalendarDays className="size-4 text-primary" /> Upcoming events
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/events">All</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.upcoming_events.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing on the calendar yet.</p>
            ) : (
              data.upcoming_events.slice(0, 3).map((event) => (
                <Link key={event.id} to={`/events/${event.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 transition-colors hover:border-primary/40">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{event.title}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(event.start_date, 'EEE, MMM d · h:mm a')} · {event.location}</p>
                  </div>
                  <Badge variant={event.is_sold_out ? 'danger' : 'secondary'}>{event.is_sold_out ? 'Sold out' : `${event.seats_left} left`}</Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Ticket className="size-4 text-primary" /> My tickets
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/app/my-tickets">All</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.my_tickets.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tickets yet — grab one for the next event.</p>
            ) : (
              data.my_tickets.slice(0, 3).map((ticket) => (
                <Link key={ticket.id} to={`/tickets/${ticket.ticket_code}`} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 transition-colors hover:border-primary/40">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{ticket.event_title}</p>
                    <p className="font-mono text-xs text-muted-foreground">{ticket.ticket_code}</p>
                  </div>
                  <Badge variant={ticket.status === 'CHECKED_IN' ? 'success' : 'default'}>{ticket.status === 'CHECKED_IN' ? 'Checked in' : 'Valid'}</Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ClipboardList className="size-4 text-primary" /> My open tasks
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/app/my-tasks">All</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.my_tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing assigned to you right now.</p>
            ) : (
              data.my_tasks.slice(0, 3).map((task) => (
                <div key={task.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{task.title}</p>
                    <p className="text-xs text-muted-foreground">{task.fundraiser_title} · due {formatDate(task.due_date, 'MMM d')}</p>
                  </div>
                  {task.is_overdue ? <Badge variant="danger">Overdue</Badge> : <Badge variant="secondary">{task.status === 'IN_PROGRESS' ? 'In progress' : 'To do'}</Badge>}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Megaphone className="size-4 text-primary" /> Announcements
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/announcements">Archive</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.announcements.map((item) => (
              <Link key={item.id} to="/announcements" className="block rounded-xl border border-border p-3 transition-colors hover:border-primary/40">
                <p className="truncate text-sm font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">{formatDate(item.published_at, 'MMM d · h:mm a')}</p>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardContent className="flex flex-col items-start justify-between gap-3 p-5 sm:flex-row sm:items-center">
          <div>
            <p className="flex items-center gap-2 font-medium">
              <Mail className="size-4 text-primary" /> {user?.name}, here's what's left this week
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {data.my_claims.filter((claim) => claim.status === 'SUBMITTED').length} claims awaiting review ·{' '}
              {data.my_orders.filter((order) => order.status === 'PENDING').length} unpaid orders
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/app/expenses/new">Submit a claim</Link>
            </Button>
            <Button asChild>
              <Link to="/app/card">Show my card</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

export default function AdminDashboard(): JSX.Element {
  const { user, loading } = useAuth();
  const isStaff = user?.role === 'ADMIN' || user?.role === 'TREASURER';

  if (loading) {
    return (
      <>
        <Skeleton className="h-7 w-56" />
        <div className="mt-5">
          <CardsSkeleton count={8} />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={isStaff ? 'Association overview' : `Welcome back, ${user?.name.split(' ')[0] ?? 'member'}`}
        description={
          isStaff
            ? 'Membership, ticket sales, stock, fundraising and the money in one place.'
            : 'Your membership, tickets, orders and tasks — with member pricing applied everywhere.'
        }
        actions={
          isStaff ? (
            <>
              <Button variant="outline" asChild>
                <Link to="/app/members">Members</Link>
              </Button>
              <Button asChild>
                <Link to="/app/events/new">New event</Link>
              </Button>
            </>
          ) : (
            <Button asChild>
              <Link to="/events">Browse events</Link>
            </Button>
          )
        }
      />
      {isStaff ? <AdminHome /> : <MemberHome />}
    </>
  );
}
