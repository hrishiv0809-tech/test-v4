import * as React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Menu, Moon, ShoppingBag, Sun, User as UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Logo } from './Logo';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useCart } from '@/hooks/useCart';
import { cn, initials } from '@/lib/utils';
import { ROLE_LABEL } from '@/lib/constants';

const LINKS = [
  { to: '/events', label: 'Events' },
  { to: '/announcements', label: 'Announcements' },
  { to: '/store', label: 'Store' },
  { to: '/membership', label: 'Membership' },
];

export function Navbar(): JSX.Element {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { count } = useCart();
  const navigate = useNavigate();
  const [open, setOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Logo />

        <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label="Main">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cn(
                  'rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                  isActive && 'bg-muted text-foreground',
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
            {theme === 'dark' ? <Sun /> : <Moon />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="relative md:hidden"
            aria-label="Cart"
            onClick={() => navigate('/store')}
          >
            <ShoppingBag />
            {count > 0 ? (
              <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
                {count}
              </span>
            ) : null}
          </Button>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-2" aria-label="Account menu">
                  <span className="grid size-8 place-items-center rounded-full bg-primary/12 text-xs font-semibold text-primary">
                    {initials(user.name)}
                  </span>
                  <span className="hidden text-sm font-medium sm:block">{user.name.split(' ')[0]}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="normal-case">
                  <span className="block text-sm font-semibold text-foreground">{user.name}</span>
                  <span className="block text-xs font-normal text-muted-foreground">{ROLE_LABEL[user.role]}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/app/dashboard')}>Dashboard</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/app/card')}>My membership card</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/app/my-tickets')}>My tickets</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/app/profile')}>Profile</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem destructive onClick={logout}>
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
                <Link to="/login">Sign in</Link>
              </Button>
              <Button size="sm" asChild>
                <Link to="/signup">Join now</Link>
              </Button>
            </>
          )}

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <Logo />
              <nav className="mt-6 flex flex-col gap-1" aria-label="Mobile">
                {LINKS.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      cn('rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-muted', isActive && 'bg-muted')
                    }
                  >
                    {link.label}
                  </NavLink>
                ))}
                <div className="my-3 h-px bg-border" />
                {user ? (
                  <>
                    <Button asChild onClick={() => setOpen(false)}>
                      <Link to="/app/dashboard">Go to dashboard</Link>
                    </Button>
                    <Button
                      variant="outline"
                      className="mt-2"
                      onClick={() => {
                        setOpen(false);
                        logout();
                      }}
                    >
                      Sign out
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" asChild onClick={() => setOpen(false)}>
                      <Link to="/login">
                        <UserIcon /> Sign in
                      </Link>
                    </Button>
                    <Button className="mt-2" asChild onClick={() => setOpen(false)}>
                      <Link to="/signup">Join now</Link>
                    </Button>
                  </>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

export function DemoRibbon(): JSX.Element {
  const { count } = useCart();
  void count;
  return (
    <Badge variant="warn" className="hidden lg:inline-flex">
      Demo data · mock API
    </Badge>
  );
}
