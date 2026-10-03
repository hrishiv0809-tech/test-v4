import * as React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight, Moon, QrCode, RefreshCw, Sun } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { USE_MOCKS } from '@/api/client';
import { initials } from '@/lib/utils';
import { ROLE_LABEL } from '@/lib/constants';

const TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  members: 'Members',
  card: 'Membership card',
  verify: 'Verify member',
  events: 'Events',
  checkin: 'Door check-in',
  announcements: 'Announcements',
  emails: 'Email log',
  store: 'Products & stock',
  orders: 'Orders',
  fundraisers: 'Fundraisers',
  'my-tasks': 'My tasks',
  expenses: 'Expense queue',
  'my-claims': 'My claims',
  finance: 'Finance',
  transactions: 'Ledger',
  report: 'Report',
  profile: 'Profile',
  'my-tickets': 'My tickets',
  'my-orders': 'My orders',
  new: 'New',
  edit: 'Edit',
};

export function Topbar(): JSX.Element {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [resetting, setResetting] = React.useState(false);

  const segments = location.pathname.split('/').filter(Boolean).slice(1);
  const crumbs = segments.map((segment, index) => ({
    label: /^\d+$/.test(segment) ? `#${segment}` : TITLES[segment] ?? segment,
    to: `/app/${segments.slice(0, index + 1).join('/')}`,
  }));

  const canCheckIn = user?.role === 'ADMIN' || user?.role === 'TREASURER' || user?.role === 'VOLUNTEER';

  const resetDemo = async (): Promise<void> => {
    setResetting(true);
    try {
      const { resetMockData } = await import('@/api/mock');
      await resetMockData();
      toast.success('Demo data reset — reloading');
      window.location.reload();
    } catch {
      toast.error('Only available in mock mode');
    } finally {
      setResetting(false);
    }
  };

  return (
    <header className="app-topbar sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <div className="min-w-0 flex-1">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-muted-foreground">
            <Link to="/app/dashboard" className="hover:text-foreground">App</Link>
            {crumbs.slice(0, 3).map((crumb) => (
              <React.Fragment key={crumb.to}>
                <ChevronRight className="size-3" />
                <Link to={crumb.to} className="truncate hover:text-foreground">{crumb.label}</Link>
              </React.Fragment>
            ))}
          </nav>
          <h1 className="truncate text-base font-semibold">
            {crumbs.length ? crumbs[crumbs.length - 1].label : 'Dashboard'}
          </h1>
        </div>

        {USE_MOCKS ? (
          <Badge variant="warn" className="hidden md:inline-flex" title="Requests are served by the in-browser mock API">
            Demo data · mock API
          </Badge>
        ) : null}

        {canCheckIn ? (
          <Button size="sm" variant="accent" asChild className="hidden sm:inline-flex">
            <Link to="/app/checkin">
              <QrCode /> Check-in mode
            </Link>
          </Button>
        ) : null}

        <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
          {theme === 'dark' ? <Sun /> : <Moon />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 px-2" aria-label="Account menu">
              <span className="grid size-8 place-items-center rounded-full bg-primary/12 text-xs font-semibold text-primary">
                {initials(user?.name ?? 'Guest')}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="normal-case">
              <span className="block text-sm font-semibold text-foreground">{user?.name}</span>
              <span className="block text-xs font-normal text-muted-foreground">{user ? ROLE_LABEL[user.role] : ''}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/app/profile')}>Profile & settings</DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/app/card')}>Membership card</DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/app/my-tickets')}>My tickets</DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/app/my-orders')}>My orders</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/')}>View public site</DropdownMenuItem>
            {USE_MOCKS ? (
              <DropdownMenuItem onClick={() => void resetDemo()} disabled={resetting}>
                <RefreshCw className={resetting ? 'animate-spin' : ''} /> Reset demo data
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onClick={logout}>Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
