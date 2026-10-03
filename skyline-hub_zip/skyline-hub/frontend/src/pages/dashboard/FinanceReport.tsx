import * as React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { financeApi } from '@/api/finance';
import { ORG_NAME } from '@/lib/constants';
import { formatCurrency, formatDate } from '@/lib/utils';

const todayIso = (): string => new Date().toISOString().slice(0, 10);

function semesterStart(): string {
  const now = new Date();
  const year = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-07-01`;
}

export default function FinanceReport(): JSX.Element {
  const [from, setFrom] = React.useState(semesterStart());
  const [to, setTo] = React.useState(todayIso());

  const summary = useQuery({ queryKey: ['finance', 'summary', from, to], queryFn: () => financeApi.summary({ from, to }) });
  const pnl = useQuery({ queryKey: ['finance', 'pnl'], queryFn: () => financeApi.pnl() });
  const ledger = useQuery({
    queryKey: ['finance', 'transactions', 'report', from, to],
    queryFn: () => financeApi.transactions({ from, to, page_size: 200 }),
  });

  return (
    <div className="mx-auto max-w-4xl">
      <div className="no-print mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="r-from" className="text-xs">From</Label>
            <Input id="r-from" type="date" className="h-9" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="r-to" className="text-xs">To</Label>
            <Input id="r-to" type="date" className="h-9" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/app/finance">
              <ArrowLeft /> Back to finance
            </Link>
          </Button>
          <Button onClick={() => window.print()}>
            <Printer /> Print / Save as PDF
          </Button>
        </div>
      </div>

      <Card className="print-block">
        <CardContent className="space-y-8 p-8">
          <header className="border-b border-border pb-4">
            <h1 className="text-2xl font-semibold">Semester financial report</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {ORG_NAME} · {formatDate(from, 'MMMM d, yyyy')} – {formatDate(to, 'MMMM d, yyyy')}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">Generated {formatDate(new Date().toISOString(), 'MMMM d, yyyy · h:mm a')}</p>
          </header>

          {summary.isLoading || !summary.data ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <section>
              <h2 className="text-lg font-semibold">Summary</h2>
              <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-xl border border-border p-4">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Total income</dt>
                  <dd className="mt-1 text-xl font-semibold">{formatCurrency(summary.data.total_income)}</dd>
                </div>
                <div className="rounded-xl border border-border p-4">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Total expenses</dt>
                  <dd className="mt-1 text-xl font-semibold">{formatCurrency(summary.data.total_expenses)}</dd>
                </div>
                <div className="rounded-xl border border-border p-4">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Balance</dt>
                  <dd className="mt-1 text-xl font-semibold">{formatCurrency(summary.data.balance)}</dd>
                </div>
                <div className="rounded-xl border border-border p-4">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Pending reimbursements</dt>
                  <dd className="mt-1 text-xl font-semibold">{formatCurrency(summary.data.pending_reimbursements)}</dd>
                </div>
              </dl>

              <Table className="mt-5">
                <TableHeader>
                  <TableRow>
                    <TableHead>Income source</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.data.income_by_source.map((row) => (
                    <TableRow key={row.source}>
                      <TableCell className="text-sm capitalize">{row.source.replace(/_/g, ' ').toLowerCase()}</TableCell>
                      <TableCell className="text-right text-sm">{formatCurrency(row.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>
          )}

          {pnl.data ? (
            <section>
              <h2 className="text-lg font-semibold">Event & fundraiser performance</h2>
              <Table className="mt-3">
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Expenses</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...pnl.data.events, ...pnl.data.fundraisers].map((row, index) => (
                    <TableRow key={`${row.name}-${index}`}>
                      <TableCell className="text-sm">{row.name}</TableCell>
                      <TableCell className="text-xs uppercase text-muted-foreground">{index < pnl.data!.events.length ? 'event' : 'fundraiser'}</TableCell>
                      <TableCell className="text-right text-sm">{formatCurrency(row.revenue)}</TableCell>
                      <TableCell className="text-right text-sm">{formatCurrency(row.expenses)}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{formatCurrency(row.profit)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>
          ) : null}

          <section>
            <h2 className="text-lg font-semibold">Ledger</h2>
            {ledger.isLoading ? (
              <Skeleton className="mt-3 h-40 w-full" />
            ) : (
              <Table className="mt-3">
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(ledger.data?.items ?? []).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(row.date, 'MMM d, yyyy')}</TableCell>
                      <TableCell className="text-sm">{row.description}</TableCell>
                      <TableCell className="text-xs uppercase text-muted-foreground">{row.source.toLowerCase()}</TableCell>
                      <TableCell className="text-right text-sm">
                        {row.type === 'INCOME' ? '+' : '−'}
                        {formatCurrency(row.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <p className="mt-4 text-xs text-muted-foreground">
              {(ledger.data?.items ?? []).length} transaction(s) · net {formatCurrency(ledger.data?.net_total ?? 0)}
            </p>
          </section>

          <footer className="border-t border-border pt-4 text-xs text-muted-foreground">
            Prepared from the Skyline Hub transactions ledger. Treasurer: ______________ · President: ______________
          </footer>
        </CardContent>
      </Card>
    </div>
  );
}
