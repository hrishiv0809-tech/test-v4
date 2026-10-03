import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }): JSX.Element {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border bg-muted/40 px-4 py-3">
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 px-4 py-3.5">
            {Array.from({ length: columns }).map((__, c) => (
              <Skeleton key={c} className={c === 0 ? 'h-4 w-40' : 'h-4 w-24'} />
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
}

export function CardsSkeleton({ count = 4, className = 'h-28' }: { count?: number; className?: string }): JSX.Element {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="p-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className={className.replace('h-28', 'mt-3 h-7 w-20')} />
          <Skeleton className="mt-2 h-3 w-16" />
        </Card>
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }): JSX.Element {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Card key={i} className="flex items-center gap-4 p-4">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </Card>
      ))}
    </div>
  );
}
