import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/AuthContext';
import type { Role } from '@/api/types';

export function FullPageLoader({ label = 'Loading your account…' }: { label?: string }): JSX.Element {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-sm space-y-4 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl brand-grad">
          <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
            <path d="M3 20h18v-2H3v2Z" fill="white" fillOpacity="0.9" />
            <path d="M5 18V9l3 2V8l3 3V6l3 3V7l3 2v9H5Z" fill="white" />
          </svg>
        </span>
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3 mx-auto" />
        </div>
      </div>
    </div>
  );
}

/** Auth guard: wraps every /app route. */
export function ProtectedRoute(): JSX.Element {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

/** Role guard: renders inside the dashboard layout so the shell stays put. */
export function RequireRole({ roles }: { roles: Role[] }): JSX.Element {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) {
    return (
      <Card className="mx-auto mt-8 max-w-lg p-8 text-center">
          <span className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300">
            <ShieldAlert className="size-6" />
          </span>
          <h1 className="text-lg font-semibold">You don't have access to this area</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This page is limited to {roles.map((r) => r.toLowerCase()).join(' and ')} accounts. You're signed in as{' '}
            <span className="font-medium text-foreground">{user?.role ?? 'a guest'}</span>.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Button asChild>
              <Link to="/app/dashboard">Back to dashboard</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/">Go to the public site</Link>
            </Button>
          </div>
      </Card>
    );
  }
  return <Outlet />;
}
