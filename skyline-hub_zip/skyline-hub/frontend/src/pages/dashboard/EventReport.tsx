import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Banknote, CalendarDays, CheckCircle2, Receipt, TrendingUp, UserCheck, Users, UserX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { RevenueArea } from '@/components/charts/RevenueArea';
import { IncomeDonut } from '@/components/charts/IncomeDonut';
import { eventsApi } from '@/api/events';
import { formatCurrency, formatDateTime } from '@/lib/utils';

export default function EventReport(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const eventId = Number(id);
  const query = useQuery({ queryKey: ['event', eventId, 'report'], queryFn: () => eventsApi.report(eventId), enabled: Number.isFinite(eventId) });

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (query.isError || !query.data) {
    return <EmptyState icon={CalendarDays} title="Report unavailable" action={<Button asChild><Link to="/app/events">Back to events</Link></Button>} />;
  }

  const report = query.data;
  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-3">
        <Link to="/app/events">
          <ArrowLeft /> All events
        </Link>
      </Button>

      <PageHeader
        title={`${report.event.title} — report`}
        description={`${formatDateTime(report.event.start_date)} · ${report.event.location}`}
        actions={
          <>
            <Badge variant={report.event.status === 'COMPLETED' ? 'secondary' : 'success'}>{report.event.status.toLowerCase()}</Badge>
            <Button variant="outline" asChild>
              <Link to={`/app/events/${report.event.id}/edit`}>Edit event</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tickets sold" value={`${report.tickets_sold} / ${report.event.capacity}`} icon={Users} tone="default" />
        <StatCard label="Checked in" value={`${report.checked_in} (${report.attendance_pct}%)`} icon={UserCheck} tone="positive" />
        <StatCard label="No-shows" value={report.no_shows} icon={UserX} tone="warn" />
        <StatCard label="Revenue" value={formatCurrency(report.revenue)} icon={Banknote} tone="positive" />
        <StatCard label="Member tickets" value={report.member_tickets} icon={CheckCircle2} hint="Discounted at member price" />
        <StatCard label="Guest tickets" value={report.non_member_tickets} icon={Users} hint="Full price" />
        <StatCard label="Linked expenses" value={formatCurrency(report.linked_expenses)} icon={Receipt} tone="danger" hint="Claims approved for this event" />
        <StatCard label="Net profit" value={formatCurrency(report.net_profit)} icon={TrendingUp} tone={report.net_profit >= 0 ? 'positive' : 'danger'} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Ticket revenue by day</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueArea data={report.revenue_by_day} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Member vs guest split</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <IncomeDonut
              data={[
                { source: 'DUES', amount: report.member_tickets },
                { source: 'MERCH', amount: report.non_member_tickets },
              ]}
              height={220}
            />
            <p className="text-center text-xs text-muted-foreground">
              Purple = {report.member_tickets} member tickets · amber = {report.non_member_tickets} guest tickets
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Attendance breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Segment</TableHead>
                <TableHead className="text-right">Tickets</TableHead>
                <TableHead className="text-right">Share</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Checked in at the door</TableCell>
                <TableCell className="text-right">{report.checked_in}</TableCell>
                <TableCell className="text-right">{report.attendance_pct}%</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>No-shows</TableCell>
                <TableCell className="text-right">{report.no_shows}</TableCell>
                <TableCell className="text-right">{report.tickets_sold ? 100 - report.attendance_pct : 0}%</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Paid as members</TableCell>
                <TableCell className="text-right">{report.member_tickets}</TableCell>
                <TableCell className="text-right">
                  {report.tickets_sold ? Math.round((report.member_tickets / report.tickets_sold) * 100) : 0}%
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Paid as guests</TableCell>
                <TableCell className="text-right">{report.non_member_tickets}</TableCell>
                <TableCell className="text-right">
                  {report.tickets_sold ? Math.round((report.non_member_tickets / report.tickets_sold) * 100) : 0}%
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <p className="mt-4 text-xs text-muted-foreground">
            Revenue {formatCurrency(report.revenue)} − linked expenses {formatCurrency(report.linked_expenses)} = net{' '}
            <span className="font-semibold text-foreground">{formatCurrency(report.net_profit)}</span>.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
