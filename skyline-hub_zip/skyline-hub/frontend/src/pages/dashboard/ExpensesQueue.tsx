import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BadgeCheck, Banknote, Check, FileText, Receipt, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/shared/PageHeader';
import { TableSkeleton } from '@/components/shared/LoadingSkeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { ExpenseBadge } from '@/components/shared/StatusBadge';
import { StatCard } from '@/components/shared/StatCard';
import { DataPagination } from '@/components/shared/DataPagination';
import { expensesApi } from '@/api/expenses';
import { apiErrorMessage } from '@/api/client';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import type { ExpenseClaim, ExpenseStatus } from '@/api/types';

const TABS: { value: ExpenseStatus | 'ALL'; label: string }[] = [
  { value: 'SUBMITTED', label: 'Awaiting review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REIMBURSED', label: 'Reimbursed' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'ALL', label: 'All' },
];

function ReceiptViewer({ claim }: { claim: ExpenseClaim }): JSX.Element {
  const isPdf = claim.receipt_url.startsWith('data:application/pdf') || (claim.receipt_name ?? '').toLowerCase().endsWith('.pdf');
  return (
    <div className="rounded-xl border border-border bg-muted/40 p-3">
      <p className="mb-2 flex items-center gap-2 text-xs font-medium">
        <FileText className="size-3.5 text-primary" /> {claim.receipt_name}
      </p>
      {isPdf ? (
        <>
          <object data={claim.receipt_url} type="application/pdf" className="h-72 w-full rounded-lg">
            <p className="p-4 text-sm text-muted-foreground">Inline preview unavailable.</p>
          </object>
          <Button variant="outline" size="sm" className="mt-2" asChild>
            <a href={claim.receipt_url} target="_blank" rel="noreferrer">Open receipt</a>
          </Button>
        </>
      ) : (
        <a href={claim.receipt_url} target="_blank" rel="noreferrer" title="Open the full-size receipt">
          <img src={claim.receipt_url} alt={`Receipt for ${claim.description}`} className="max-h-72 w-full rounded-lg object-contain" />
        </a>
      )}
    </div>
  );
}

export default function ExpensesQueue(): JSX.Element {
  const queryClient = useQueryClient();
  const [status, setStatus] = React.useState<ExpenseStatus | 'ALL'>('SUBMITTED');
  const [page, setPage] = React.useState(1);
  const [selected, setSelected] = React.useState<ExpenseClaim | null>(null);
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [rejectNote, setRejectNote] = React.useState('');
  const [reimburseOpen, setReimburseOpen] = React.useState(false);

  const query = useQuery({
    queryKey: ['expenses', status, page],
    queryFn: () => expensesApi.list({ status, page, page_size: 15 }),
  });

  const invalidate = (): void => {
    queryClient.invalidateQueries({ queryKey: ['expenses'] });
    queryClient.invalidateQueries({ queryKey: ['finance'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const approve = useMutation({
    mutationFn: (id: number) => expensesApi.approve(id),
    onSuccess: () => {
      invalidate();
      toast.success('Claim approved — mark it reimbursed once the money is out');
      setSelected(null);
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const reject = useMutation({
    mutationFn: ({ id, note }: { id: number; note: string }) => expensesApi.reject(id, note),
    onSuccess: () => {
      invalidate();
      toast.success('Claim rejected — the submitter can see your note');
      setRejectOpen(false);
      setRejectNote('');
      setSelected(null);
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const reimburse = useMutation({
    mutationFn: (id: number) => expensesApi.reimburse(id),
    onSuccess: (result) => {
      invalidate();
      toast.success(`Reimbursed ${formatCurrency(result.claim.amount)} — expense row added to the ledger`);
      setReimburseOpen(false);
      setSelected(null);
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const items = query.data?.items ?? [];
  const pendingTotal = items.filter((claim) => claim.status === 'SUBMITTED').reduce((sum, claim) => sum + claim.amount, 0);

  return (
    <>
      <PageHeader
        title="Expense queue"
        description="Check the receipt, then approve, reject with a reason, or mark reimbursed to post the expense to the ledger."
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Awaiting review" value={items.filter((c) => c.status === 'SUBMITTED').length} icon={Receipt} tone="warn" hint={status === 'SUBMITTED' ? formatCurrency(pendingTotal) : 'Switch to "Awaiting review"'} />
        <StatCard label="Approved, not paid" value={items.filter((c) => c.status === 'APPROVED').length} icon={Check} tone="default" />
        <StatCard label="Reimbursed (this view)" value={items.filter((c) => c.status === 'REIMBURSED').length} icon={Banknote} tone="positive" />
        <StatCard label="Rejected (this view)" value={items.filter((c) => c.status === 'REJECTED').length} icon={X} tone="danger" />
      </div>

      <Card className="mb-5">
        <CardContent className="p-4">
          <Tabs
            value={status}
            onValueChange={(value) => {
              setStatus(value as ExpenseStatus | 'ALL');
              setPage(1);
            }}
          >
            <TabsList className="flex-wrap">
              {TABS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      {query.isLoading ? (
        <TableSkeleton rows={6} columns={6} />
      ) : items.length === 0 ? (
        <EmptyState icon={Receipt} title="Nothing in this queue" description="Claims submitted by volunteers appear here for review." />
      ) : (
        <>
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Claim</TableHead>
                  <TableHead>Submitted by</TableHead>
                  <TableHead>Linked to</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Review</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((claim) => (
                  <TableRow key={claim.id}>
                    <TableCell className="max-w-xs">
                      <p className="truncate font-medium">{claim.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {claim.category} · {formatDate(claim.created_at, 'MMM d, yyyy')}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm">{claim.submitter_name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{claim.fundraiser_title ?? claim.event_title ?? '—'}</TableCell>
                    <TableCell className="text-sm font-semibold">{formatCurrency(claim.amount)}</TableCell>
                    <TableCell><ExpenseBadge status={claim.status} /></TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setSelected(claim)}>
                        <FileText /> Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          {query.data ? (
            <DataPagination page={query.data.page} pages={query.data.pages} total={query.data.total} pageSize={query.data.page_size} onPageChange={setPage} />
          ) : null}
        </>
      )}

      {/* Review dialog */}
      <Dialog open={Boolean(selected) && !rejectOpen && !reimburseOpen} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selected?.description} <ExpenseBadge status={selected?.status ?? 'SUBMITTED'} />
            </DialogTitle>
            <DialogDescription>
              {selected ? `${selected.submitter_name} · ${formatDateTime(selected.created_at)} · ${selected.category}` : ''}
            </DialogDescription>
          </DialogHeader>

          {selected ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border p-3 text-sm">
                  <p className="text-xs text-muted-foreground">Amount claimed</p>
                  <p className="text-lg font-semibold">{formatCurrency(selected.amount)}</p>
                </div>
                <div className="rounded-xl border border-border p-3 text-sm">
                  <p className="text-xs text-muted-foreground">Linked to</p>
                  <p className="font-medium">{selected.fundraiser_title ?? selected.event_title ?? 'General association funds'}</p>
                </div>
              </div>

              <ReceiptViewer claim={selected} />

              {selected.review_note ? (
                <p className="rounded-xl bg-muted/60 p-3 text-sm">
                  <span className="font-medium">Review note:</span> {selected.review_note}
                </p>
              ) : null}

              {selected.status === 'REIMBURSED' && selected.reimbursed_at ? (
                <p className="text-xs text-muted-foreground">
                  Reimbursed on {formatDateTime(selected.reimbursed_at)} — the expense is already in the ledger.
                </p>
              ) : null}
            </div>
          ) : null}

          <DialogFooter className="flex-wrap">
            {selected?.status === 'SUBMITTED' || selected?.status === 'APPROVED' ? (
              <>
                <Button variant="outline" onClick={() => setRejectOpen(true)}>
                  <X /> Reject
                </Button>
                {selected?.status === 'SUBMITTED' ? (
                  <Button variant="outline" loading={approve.isPending} onClick={() => selected && approve.mutate(selected.id)}>
                    <Check /> Approve
                  </Button>
                ) : null}
                <Button loading={reimburse.isPending} onClick={() => setReimburseOpen(true)} className="bg-emerald-600 text-white hover:bg-emerald-700">
                  <Banknote /> Mark reimbursed
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setSelected(null)}>
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject this claim</DialogTitle>
            <DialogDescription>Your note is shown to {selected?.submitter_name} so they can fix and resubmit.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="reject-note">Reason</Label>
            <Textarea
              id="reject-note"
              rows={4}
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="The receipt doesn't match the amount claimed…"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={reject.isPending}
              disabled={rejectNote.trim().length < 3}
              onClick={() => selected && reject.mutate({ id: selected.id, note: rejectNote.trim() })}
            >
              Reject claim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reimburse dialog */}
      <Dialog open={reimburseOpen} onOpenChange={setReimburseOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mark as reimbursed?</DialogTitle>
            <DialogDescription>
              This creates an <span className="font-medium text-foreground">EXPENSE / REIMBURSEMENT</span> row of{' '}
              {selected ? formatCurrency(selected.amount) : ''} in the ledger and reduces the balance.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReimburseOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-emerald-600 text-white hover:bg-emerald-700" loading={reimburse.isPending} onClick={() => selected && reimburse.mutate(selected.id)}>
              <BadgeCheck /> Confirm reimbursed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
