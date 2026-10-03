import * as React from 'react';
import { cn } from '@/lib/utils';

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
  tone?: 'primary' | 'accent' | 'success' | 'danger';
}

const tones: Record<NonNullable<ProgressProps['tone']>, string> = {
  primary: 'bg-primary',
  accent: 'bg-accent',
  success: 'bg-emerald-500',
  danger: 'bg-red-500',
};

export function Progress({ value = 0, max = 100, tone = 'primary', className, ...props }: ProgressProps) {
  const pct = Math.max(0, Math.min(100, max === 0 ? 0 : (value / max) * 100));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(pct)}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-muted', className)}
      {...props}
    >
      <div className={cn('h-full rounded-full transition-all', tones[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}
