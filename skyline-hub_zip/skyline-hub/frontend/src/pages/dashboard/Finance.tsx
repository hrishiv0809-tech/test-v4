import * as React from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Banknote, Clock3, Download, Printer, Receipt, TrendingDown, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { CardsSkeleton, TableSkeleton } from '@/components/shared/LoadingSkeleton';
import { IncomeDonut } from '@/components/charts/IncomeDonut';
import { MonthlyBars } from '@/components/charts/MonthlyBars';
import { financeApi } from '@/api/finance';
import { apiErrorMessage } from '@/api/client';
import type { RangePreset } from '@/lib/constants';
import { downloadBlob, formatCurrency, formatDate } from '@/lib/utils';

const todayIso = (): string => new Date().toISOString().slice(0, 10);

function semesterStart(): string {
  const now = new Date();
  const year = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-07-01`;
}

function monthStart(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

export default function Finance(): JSX.Element {
  const [preset, setPreset] = React.useState<RangePreset>('THIS_SEMESTER');
  const [from, setFrom] = React.useState<string>(semesterStart());
  const [to, setTo] = React.useState<string>(todayIso());

  React.useEffect(() => {
    if (preset === 'THIS_SEMESTER') {
      setFrom(semesterStart());
      setTo(todayIso());
    } else if (preset === 'THIS_MONTH') {
      setFrom(monthStart());
      setTo(todayIso());
    }
  }, [preset]);

  const summary = useQuery({
    queryKey: ['finance', 'summary', from, to],
    queryFn: () => financeApi.summary({ from, to }),
  });

  const pnl = useQuery({ queryKey: ['finance', 'pnl'], queryFn: () => financeApi.pnl() });

  const exportCsv = useMutation({
    mutationFn: () => financeApi.exportCsv({ from, to }),
    onSuccess: (result) => {
      downloadBlob(result.filename, result.csv);
      toast.success('Semester report downloaded');
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const data = summary.data;

  return (
    <>
      <PageHeader
        title="Finance"
        description="All figures come from the transactions ledger — every dues payment, ticket, merch order and reimbursement."
        actions={
          <>
            <Button variant="outline" loading={exportCsv.isPending} onClick={() => exportCsv.mutate()}>
              <Download /> Export CSV
            </Button>
            <Button asChild>
              <Link to="/app/finance/report">
                <Printer /> Print report
              </Link>
            </Button>
          </>
        }
      />

      <Card className="mb-5">
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-end lg:justify-between">
          <Tabs value={preset} onValueChange={(value) => setPreset(value as RangePreset)}>
            <TabsList>
              <TabsTrigger value="THIS_SEMESTER">This semester</TabsTrigger>
              <TabsTrigger value="THIS_MONTH">This month</TabsTrigger>
              <TabsTrigger value="CUSTOM">Custom</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="from" className="text-xs">From</Label>
              <Input
                id="from"
                type="date"
                className="h-9"
                value={from}
                max={to}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPreset('CUSTOM');
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="to" className="text-xs">To</Label>
              <Input
                id="to"
                type="date"
                className="h-9"
                value={to}
                min={from}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPreset('CUSTOM');
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {summary.isLoading || !data ? (
        <CardsSkeleton count={4} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total income" value={formatCurrency(data.total_income)} icon={TrendingUp} tone="positive" hint={`${formatDate(from, 'MMM d')} – ${formatDate(to, 'MMM d')}`} />
          <StatCard label="Total expenses" value={formatCurrency(data.total_expenses)} icon={TrendingDown} tone="danger" />
          <StatCard label="Current balance" value={formatCurrency(data.balance)} icon={Banknote} tone={data.balance >= 0 ? 'positive' : 'danger'} />
          <StatCard
            label="Pending reimbursements"
            value={formatCurrency(data.pending_reimbursements)}
            icon={Clock3}
            tone="warn"
            hint={`${data.pending_count} claim(s) awaiting review`}
            to="/app/expenses"
          />
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Income by source</CardTitle>
          </CardHeader>
          <CardContent>
            {data ? <IncomeDonut data={data.income_by_source} /> : <TableSkeleton rows={3} columns={2} />}
            {data ? (
              <dl className="mt-2 grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl bg-muted/60 p-3">
                  <dt className="text-muted-foreground">Dues collected</dt>
                  <dd className="text-sm font-semibold">{formatCurrency(data.member_dues_collected)}</dd>
                </div>
                <div className="rounded-xl bg-muted/60 p-3">
                  <dt className="text-muted-foreground">Tickets</dt>
                  <dd className="text-sm font-semibold">{formatCurrency(data.tickets_revenue)}</dd>
                </div>
                <div className="rounded-xl bg-muted/60 p-3">
                  <dt className="text-muted-foreground">Merch</dt>
                  <dd className="text-sm font-semibold">{formatCurrency(data.merch_revenue)}</dd>
                </div>
                <div className="rounded-xl bg-muted/60 p-3">
                  <dt className="text-muted-foreground">Fundraisers</dt>
                  <dd className="text-sm font-semibold">{formatCurrency(data.fundraiser_revenue)}</dd>
                </div>
              </dl>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Monthly income vs expenses</CardTitle>
          </CardHeader>
          <CardContent>{data ? <MonthlyBars data={data.monthly} /> : <TableSkeleton rows={4} columns={2} />}</CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Receipt className="size-4 text-primary" /> Profit & loss by event and fundraiser
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {pnl.isLoading || !pnl.data ? (
            <TableSkeleton rows={4} columns={5} />
          ) : (
            <>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Events</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Expenses</TableHead>
                      <TableHead className="text-right">Profit</TableHead>
                      <TableHead className="text-right">Margin</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pnl.data.events.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="text-sm">{row.name}</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(row.revenue)}</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(row.expenses)}</TableCell>
                        <TableCell className={`text-right text-sm font-semibold ${row.profit >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-600'}`}>
                          {formatCurrency(row.profit)}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          <Badge variant={row.margin_pct >= 0 ? 'success' : 'danger'}>{row.margin_pct}%</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fundraisers</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fundraiser</TableHead>
                      <TableHead className="text-right">Raised</TableHead>
                      <TableHead className="text-right">Costs</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                      <TableHead className="text-right">Margin</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pnl.data.fundraisers.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="text-sm">{row.name}</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(row.revenue)}</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(row.expenses)}</TableCell>
                        <TableCell className={`text-right text-sm font-semibold ${row.profit >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-600'}`}>
                          {formatCurrency(row.profit)}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          <Badge variant={row.margin_pct >= 0 ? 'success' : 'danger'}>{row.margin_pct}%</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/60 p-4 text-sm">
                <span className="text-muted-foreground">
                  Combined: revenue {formatCurrency(pnl.data.totals.revenue)} · expenses {formatCurrency(pnl.data.totals.expenses)}
                </span>
                <span className="font-semibold">
                  Profit {formatCurrency(pnl.data.totals.profit)} ({pnl.data.totals.margin_pct}% margin)
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
