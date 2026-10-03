import { Link, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, CheckCircle2, Mail, MapPin, Ticket as TicketIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { QRCodeView } from '@/components/shared/QRCodeView';
import { ticketsApi } from '@/api/tickets';
import { formatCurrency, formatDateTime } from '@/lib/utils';

export default function TicketSuccess(): JSX.Element {
  const { code } = useParams<{ code: string }>();
  const location = useLocation();
  const state = location.state as { emailedTo?: string; multiple?: number } | null;

  const query = useQuery({ queryKey: ['ticket', code], queryFn: () => ticketsApi.byCode(code ?? ''), enabled: Boolean(code) });

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <Card>
          <CardContent className="space-y-4 p-6">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="mx-auto h-52 w-52 rounded-2xl" />
            <Skeleton className="h-4 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <EmptyState icon={TicketIcon} title="Ticket not found" description="Check the code or look in My Tickets." action={<Button asChild><Link to="/login">Sign in to view my tickets</Link></Button>} />
      </div>
    );
  }

  const ticket = query.data;
  const emailedTo = state?.emailedTo ?? ticket.buyer_email;

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <div className="mb-5 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
        <CheckCircle2 className="size-4 shrink-0" />
        <p>
          Payment received. {state?.multiple && state.multiple > 1 ? `This is 1 of ${state.multiple} tickets — all of them are in My Tickets.` : 'Your ticket is below and saved to your account.'}
        </p>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-br from-primary to-primary-hover text-white">
          <CardTitle className="flex items-center gap-2 text-white">
            <TicketIcon className="size-4" /> {ticket.event_title}
          </CardTitle>
          <p className="text-sm text-white/80">{formatDateTime(ticket.event_start_date)} · {ticket.event_location}</p>
        </CardHeader>
        <CardContent className="space-y-5 p-6">
          <QRCodeView value={ticket.ticket_code} label={`QR code for ticket ${ticket.ticket_code}`} size={220} className="mx-auto" />

          <div className="space-y-2 rounded-xl border border-border p-4 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Attendee</span><span className="font-medium">{ticket.buyer_name}</span></div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Price paid</span>
              <span className="font-medium">
                {formatCurrency(ticket.price_paid)} {ticket.is_member_price ? <Badge variant="success" className="ml-1">member</Badge> : <Badge variant="secondary" className="ml-1">guest</Badge>}
              </span>
            </div>
            <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className="font-medium">{ticket.status === 'CHECKED_IN' ? 'Checked in' : 'Valid'}</span></div>
            {ticket.checked_in_at ? (
              <div className="flex justify-between"><span className="text-muted-foreground">Checked in at</span><span className="font-medium">{formatDateTime(ticket.checked_in_at)}</span></div>
            ) : null}
            <Separator />
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <Mail className="mt-0.5 size-3.5 shrink-0" /> Emailed to <span className="font-medium text-foreground">{emailedTo}</span> (logged, no SMTP in the demo).
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            {ticket.status === 'VALID' ? (
              <Badge variant="default" className="justify-center py-2">
                <CalendarDays className="size-3" /> Show this QR at the door
              </Badge>
            ) : null}
            <Button variant="outline" className="flex-1" asChild>
              <Link to="/app/my-tickets"><MapPin /> All my tickets</Link>
            </Button>
            <Button className="flex-1" asChild>
              <Link to="/events">Browse more events</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
