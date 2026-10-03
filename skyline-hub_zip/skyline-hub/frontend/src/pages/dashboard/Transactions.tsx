import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableRow, TableHeader } from '@/components/ui/table';
import { PageHeader } from '@/components/shared/PageHeader';
import { SearchInput } from '@/components/shared/SearchInput';
import { TableSkeleton } from '@/components/shared/LoadingSkeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { DataPagination } from '@/components/shared/DataPagination';
import { financeApi } from '@/api/finance';
import { apiErrorMessage } from '@/api/client';
import { useDebounce } from '@/hooks/useDebounce';
import { downloadBlob, formatCurrency, formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import type { TransactionSource, TransactionType } from '@/api/types';

const SOURCES: (TransactionSource | 'ALL')[] = ['ALL', 'DUES', 'TICKET', 'MERCH', 'FUNDRAISER', 'DONATION', 'REIMBURSEMENT', 'OTHER'];

export default function Transactions(): JSX.Element {
  const [search, setSearch] = React.useState('');
  const [type, setType] = React.useState<TransactionType | 'ALL'>('ALL');
  const [source, setSource] = React.useState<TransactionSource | 'ALL'>('ALL');
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [page, setPage] = React.useState(1);
  const debounced = useDebounce(search);

  React.useEffect(() => setPage(1), [debounced, type, source, from, to]);

  const query = useQuery({
    queryKey: ['finance', 'transactions', { debounced, type, source, from, to, page }],
    queryFn: () =>
      financeApi.transactions({
        search: debounced || undefined,
        type: type === 'ALL' ? undefined : type,
        source: source === 'ALL' ? undefined : source,
        from: from || undefined,
        to: to || undefined,
        page,
        page_size: 20,
      }),
  });

  const rows = query.data?.items ?? [];

  const exportCsv = async (): Promise<void> => {
    try {
      const result = await financeApi.exportCsv({ from: from || undefined, to: to || undefined });
      downloadBlob(result.filename, result.csv);
      toast.success('Ledger exported');
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  };

  // running balance across the filtered set (newest first), computed from the API's net total
  const runningBalances = React.useMemo(() => {
    const net = query.data?.net_total ?? 0;
    let cursor = net;
    return rows.map((row) => {
      const current = cursor;
      cursor -= row.type === 'INCOME' ? row.amount : -row.amount;
      return current;
    });
  }, [rows, query.data?.net_total]);

  return (
    <>
      <PageHeader
        title="Transactions ledger"
        description="The single source of truth for the treasurer. Every row is written by the action that caused it."
        actions={
          <Button variant="outline" onClick={() => void exportCsv()}>
            <Download /> Export CSV
          </Button>
        }
      />

      <Card className="mb-4">
        <CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="space-y-1.5 xl:col-span-2">
            <Label htmlFor="search" className="text-xs">Search description</Label>
            <SearchInput value={search} onChange={setSearch} placeholder="Bake sale, hoodie, gala…" ariaLabel="Search transactions" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="type" className="text-xs">Type</Label>
            <Select
              id="type"
              className="h-10"
              value={type}
              onChange={(e) => setType(e.target.value as TransactionType | 'ALL')}
              options={[
                { value: 'ALL', label: 'All types' },
                { value: 'INCOME', label: 'Income' },
                { value: 'EXPENSE', label: 'Expense' },
              ]}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="source" className="text-xs">Source</Label>
            <Select
              id="source"
              className="h-10"
              value={source}
              onChange={(e) => setSource(e.target.value as TransactionSource | 'ALL')}
              options={SOURCES.map((s) => ({ value: s, label: s === 'ALL' ? 'All sources' : s.charAt(0) + s.slice(1).toLowerCase() }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="t-from" className="text-xs">From</Label>
              <Input id="t-from" type="date" className="h-10" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-to" className="text-xs">To</Label>
              <Input id="t-to" type="date" className="h-10" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {query.isLoading ? (
        <TableSkeleton rows={8} columns={6} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No transactions match those filters"
          description="Try widening the date range or clearing the search."
          action={
            <Button
              variant="outline"
              onClick={() => {
                setSearch('');
                setType('ALL');
                setSource('ALL');
                setFrom('');
                setTo('');
              }}
            >
              Reset filters
            </Button>
          }
        />
      ) : (
        <>
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Recorded by</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Running balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, index) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatDate(row.date, 'MMM d, yyyy')}</TableCell>
                    <TableCell className="max-w-sm">
                      <p className="truncate text-sm">{row.description}</p>
                      {row.reference_type ? (
                        <p className="text-xs text-muted-foreground">
                          {row.reference_type}#{row.reference_id ?? ''}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.type === 'INCOME' ? 'success' : 'danger'}>{row.source.toLowerCase()}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.created_by_name ?? 'System'}</TableCell>
                    <TableCell className={`text-right text-sm font-semibold ${row.type === 'INCOME' ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-600'}`}>
                      {row.type === 'INCOME' ? '+' : '−'}
                      {formatCurrency(row.amount)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{formatCurrency(runningBalances[index] ?? 0)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/60 px-4 py-3 text-sm">
            <span className="text-muted-foreground">
              {query.data?.total} row(s) in this filter · net movement
            </span>
            <span className="font-semibold">{formatCurrency(query.data?.net_total ?? 0)}</span>
          </div>

          {query.data ? (
            <DataPagination page={query.data.page} pages={query.data.pages} total={query.data.total} pageSize={query.data.page_size} onPageChange={setPage} />
          ) : null}
        </>
      )}
    </>
  );
}
