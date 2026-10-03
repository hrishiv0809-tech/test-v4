import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }): JSX.Element {
  return (
    <Link to="/" className={cn('inline-flex items-center gap-2.5', className)} aria-label="Skyline Hub home">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl brand-grad shadow-sm">
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
          <path d="M3 20h18v-2H3v2Z" fill="white" fillOpacity="0.9" />
          <path d="M5 18V9l3 2V8l3 3V6l3 3V7l3 2v9H5Z" fill="white" />
          <circle cx="18.5" cy="5.5" r="2" fill="#F5B93A" />
        </svg>
      </span>
      {!compact ? (
        <span className="leading-tight">
          <span className="block text-[15px] font-semibold tracking-tight">Skyline Hub</span>
          <span className="block text-[11px] text-muted-foreground">Student Association</span>
        </span>
      ) : null}
    </Link>
  );
}
