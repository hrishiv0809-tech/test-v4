import * as React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, type LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  hint?: string;
  to?: string;
  tone?: 'default' | 'positive' | 'warn' | 'danger';
  loading?: boolean;
}

const toneRing: Record<NonNullable<StatCardProps['tone']>, string> = {
  default: 'bg-primary/10 text-primary',
  positive: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  warn: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  danger: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
};

export function StatCard({ label, value, icon: Icon, hint, to, tone = 'default', loading }: StatCardProps): JSX.Element {
  const body = (
    <Card className={cn('h-full p-4 transition-all', to && 'hover:-translate-y-0.5 hover:border-primary/40')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          {loading ? <Skeleton className="mt-2 h-7 w-20" /> : <p className="mt-1.5 text-2xl font-semibold tabular-nums">{value}</p>}
          {hint ? <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl', toneRing[tone])}>
          <Icon className="size-4" />
        </span>
      </div>
      {to ? (
        <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
          View <ArrowRight className="size-3" />
        </span>
      ) : null}
    </Card>
  );

  return to ? (
    <Link to={to} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-2xl">
      {body}
    </Link>
  ) : (
    body
  );
}
