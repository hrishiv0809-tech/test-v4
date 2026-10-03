import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Circle, Clock, Receipt, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { ListSkeleton } from '@/components/shared/LoadingSkeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { ExpenseBadge } from '@/components/shared/StatusBadge';
import { expensesApi } from '@/api/expenses';
import { cn, formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import type { ExpenseClaim } from '@/api/types';

function Timeline({ claim }: { claim: ExpenseClaim }): JSX.Element {
  const steps = [
    { label: 'Submitted', at: claim.created_at, done: true },
    {
      label: claim.status === 'REJECTED' ? 'Rejected' : 'Approved',
      at: claim.reviewed_at,
      done: claim.status !== 'SUBMITTED',
      failed: claim.status === 'REJECTED',
    },
    { label: 'Reimbursed', at: claim.reimbursed_at, done: claim.status === 'REIMBURSED' },
  ];

  return (
    <ol className="mt-4 space-y-3" aria-label="Claim status timeline">
      {steps.map((step) => (
        <li key={step.label} className="flex items-start gap-3">
          {step.failed ? (
            <XCircle className="mt-0.5 size-4 shrink-0 text-red-600" />
          ) : step.done ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
          ) : (
            <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          )}
          <div>
            <p className={cn('text-sm font-medium', !step.done && 'text-muted-foreground')}>{step.label}</p>
            {step.at ? <p className="text-xs text-muted-foreground">{formatDateTime(step.at)}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function MyClaims(): JSX.Element {
  const query = useQuery({ queryKey: ['expenses', 'mine'], queryFn: () => expensesApi.mine() });

  return (
    <>
      <PageHeader
        title="My claims"
        description="Everything you've claimed, with the treasurer's decision and reimbursement status."
        actions={
          <Button asChild>
            <Link to="/app/expenses/new">
              <Receipt /> Submit a claim
            </Link>
          </Button>
        }
      />

      {query.isLoading ? (
        <ListSkeleton rows={3} />
      ) : (query.data ?? []).length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No claims yet"
          description="Bought something for the association? Submit it with a photo of the receipt."
          action={
            <Button asChild>
              <Link to="/app/expenses/new">Submit your first claim</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {(query.data ?? []).map((claim) => (
            <Card key={claim.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{claim.description}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {claim.category} · {formatDate(claim.created_at, 'MMM d, yyyy')}
                      {claim.fundraiser_title ? ` · ${claim.fundraiser_title}` : claim.event_title ? ` · ${claim.event_title}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(claim.amount)}</p>
                    <div className="mt-1"><ExpenseBadge status={claim.status} /></div>
                  </div>
                </div>

                <Timeline claim={claim} />

                {claim.status === 'REJECTED' && claim.review_note ? (
                  <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm dark:border-red-500/30 dark:bg-red-500/10">
                    <span className="font-medium">Treasurer's note:</span> {claim.review_note}
                    <span className="mt-1 block text-xs text-muted-foreground">Fix the issue and submit a new claim.</span>
                  </p>
                ) : null}

                {claim.status === 'APPROVED' ? (
                  <p className="mt-4 flex items-center gap-2 rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
                    <Clock className="size-3.5" /> Approved — waiting for the treasurer to pay it out.
                  </p>
                ) : null}

                <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                  <Badge variant="outline">{claim.receipt_name}</Badge>
                  <a href={claim.receipt_url} target="_blank" rel="noreferrer" className="text-xs font-medium text-primary hover:underline">
                    View receipt
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
