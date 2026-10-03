import * as React from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
  Banknote,
  BarChart3,
  CalendarDays,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  HeartHandshake,
  LayoutDashboard,
  ListChecks,
  Mail,
  Megaphone,
  QrCode,
  Receipt,
  ShieldCheck,
  ShoppingBag,
  Store,
  Ticket,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { ROLE_LABEL } from '@/lib/constants';
import type { Role } from '@/api/types';
import { Logo } from './Logo';
import { Menu } from 'lucide-react';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: Role[];
  end?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const ALL: Role[] = ['ADMIN', 'TREASURER', 'VOLUNTEER', 'MEMBER'];
const STAFF: Role[] = ['ADMIN', 'TREASURER'];
const WIDE: Role[] = ['ADMIN', 'TREASURER', 'VOLUNTEER'];
const VOLUNTEER_PLUS: Role[] = ['ADMIN', 'TREASURER', 'VOLUNTEER'];

export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Overview',
    items: [{ to: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ALL, end: true }],
  },
  {
    title: 'Membership',
    items: [
      { to: '/app/members', label: 'Members', icon: Users, roles: STAFF },
      { to: '/app/card', label: 'My card', icon: ShieldCheck, roles: ALL },
      { to: '/app/verify', label: 'Verify member', icon: QrCode, roles: WIDE },
    ],
  },
  {
    title: 'Events',
    items: [
      { to: '/app/events', label: 'Events', icon: CalendarDays, roles: STAFF },
      { to: '/app/my-tickets', label: 'My tickets', icon: Ticket, roles: ALL },
      { to: '/app/checkin', label: 'Door check-in', icon: QrCode, roles: WIDE },
    ],
  },
  {
    title: 'Communications',
    items: [
      { to: '/app/announcements', label: 'Announcements', icon: Megaphone, roles: STAFF },
      { to: '/app/emails', label: 'Email log', icon: Mail, roles: STAFF },
    ],
  },
  {
    title: 'Store',
    items: [
      { to: '/app/store', label: 'Products & stock', icon: Store, roles: STAFF },
      { to: '/app/orders', label: 'Orders', icon: ShoppingBag, roles: STAFF },
      { to: '/app/my-orders', label: 'My orders', icon: ShoppingBag, roles: ALL },
    ],
  },
  {
    title: 'Fundraising',
    items: [
      { to: '/app/fundraisers', label: 'Fundraisers', icon: HeartHandshake, roles: VOLUNTEER_PLUS },
      { to: '/app/my-tasks', label: 'My tasks', icon: ListChecks, roles: WIDE },
    ],
  },
  {
    title: 'Money',
    items: [
      { to: '/app/expenses', label: 'Expense queue', icon: Receipt, roles: STAFF },
      { to: '/app/expenses/new', label: 'Submit a claim', icon: ClipboardList, roles: ALL },
      { to: '/app/my-claims', label: 'My claims', icon: Receipt, roles: ALL },
      { to: '/app/finance', label: 'Finance', icon: Banknote, roles: STAFF },
      { to: '/app/finance/transactions', label: 'Ledger', icon: BarChart3, roles: STAFF },
    ],
  },
];

function useVisibleSections(): NavSection[] {
  const { user } = useAuth();
  return React.useMemo(() => {
    if (!user) return [];
    return NAV_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter((item) => item.roles.includes(user.role)),
    })).filter((section) => section.items.length > 0);
  }, [user]);
}

function NavList({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }): JSX.Element {
  const sections = useVisibleSections();
  return (
    <nav className="flex flex-col gap-5" aria-label="Dashboard">
      {sections.map((section) => (
        <div key={section.title}>
          {!collapsed ? (
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">{section.title}</p>
          ) : (
            <div className="mx-3 mb-2 h-px bg-border" />
          )}
          <ul className="space-y-0.5">
            {section.items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                      isActive && 'bg-primary/10 text-primary',
                      collapsed && 'justify-center px-0',
                    )
                  }
                >
                  <item.icon className="size-4 shrink-0" />
                  {!collapsed ? <span className="truncate">{item.label}</span> : null}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }): JSX.Element {
  const { user } = useAuth();

  return (
    <>
      {/* Desktop rail */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border bg-card lg:flex',
          collapsed ? 'w-[4.75rem]' : 'w-[16.5rem]',
        )}
        style={{ transition: 'width .18s ease' }}
      >
        <div className={cn('flex h-16 items-center border-b border-border px-3', collapsed && 'justify-center px-0')}>
          <Logo compact={collapsed} />
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4 no-scrollbar">
          <NavList collapsed={collapsed} />
        </div>

        <div className="border-t border-border p-3">
          {!collapsed && user ? (
            <div className="mb-2 rounded-xl bg-muted/60 px-3 py-2">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{ROLE_LABEL[user.role]}</p>
            </div>
          ) : null}
          <Button
            variant="ghost"
            size={collapsed ? 'icon' : 'sm'}
            onClick={onToggle}
            className={cn('w-full', collapsed && 'w-10')}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronsRight /> : <><ChevronsLeft /> Collapse</>}
          </Button>
        </div>
      </aside>

      {/* Mobile drawer */}
      <div className="lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open navigation" className="fixed bottom-4 left-4 z-30 shadow-lg bg-card border border-border lg:hidden">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent className="w-[17rem] overflow-y-auto">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <Logo />
            <div className="mt-5">
              <NavList />
            </div>
            <div className="mt-6 border-t border-border pt-4">
              <Button variant="outline" className="w-full" asChild>
                <Link to="/">Back to public site</Link>
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
