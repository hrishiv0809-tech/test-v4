import * as React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Ticket as TicketIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/PageHeader';
import { ListSkeleton } from '@/components/shared/LoadingSkeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { QRCodeView } from '@/components/shared/QRCodeView';
import { ticketsApi } from '@/api/tickets';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import type { Ticket } from '@/api/types';

export default function MyTickets(): JSX.Element {
  const [tab, setTab] = React.useState<'upcoming' | 'past'>('upcoming');
  const query = useQuery({ queryKey: ['tickets', 'mine'], queryFn: () => ticketsApi.mine() });

  const now = Date.now();
  const tickets = (query.data ?? []).filter((ticket: Ticket) => {
    const start = ticket.event_start_date ? new Date(ticket.event_start_date).getTime() : 0;
    return tab === 'upcoming' ? start >= now - 86_400_000 : start < now;
  });

  return (
    <>
      <PageHeader
        title="My tickets"
        description="Every ticket you've bought. Show the QR at the door — or open the ticket page for a bigger code."
        actions={
          <Button asChild>
            <Link to="/events">Browse events</Link>
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={(value) => setTab(value as 'upcoming' | 'past')} className="mb-5">
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="past">Past</TabsTrigger>
        </TabsList>
      </Tabs>

      {query.isLoading ? (
        <ListSkeleton rows={3} />
      ) : tickets.length === 0 ? (
        <EmptyState
          icon={TicketIcon}
          title={tab === 'upcoming' ? 'No upcoming tickets' : 'No past tickets'}
          description={tab === 'upcoming' ? 'Tickets you buy show up here with a scannable QR code.' : 'Attended events will be listed here.'}
          action={
            <Button asChild>
              <Link to="/events">See what's on</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {tickets.map((ticket) => (
            <Card key={ticket.id} className="overflow-hidden">
              <CardContent className="flex gap-4 p-5">
                <Link to={`/tickets/${ticket.ticket_code}`} className="shrink-0" aria-label={`Open ticket ${ticket.ticket_code}`}>
                  <QRCodeView value={ticket.ticket_code} size={96} label={`QR for ${ticket.ticket_code}`} />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{ticket.event_title}</p>
                      <p className="text-xs text-muted-foreground">{ticket.event_start_date ? formatDateTime(ticket.event_start_date) : ''}</p>
                      <p className="text-xs text-muted-foreground">{ticket.event_location}</p>
                    </div>
                    <Badge variant={ticket.status === 'CHECKED_IN' ? 'success' : ticket.status === 'CANCELLED' ? 'danger' : 'default'}>
                      {ticket.status === 'CHECKED_IN' ? 'Checked in' : ticket.status === 'CANCELLED' ? 'Cancelled' : 'Valid'}
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="font-mono">{ticket.ticket_code}</span>
                    <span>{formatCurrency(ticket.price_paid)}</span>
                    {ticket.is_member_price ? <Badge variant="success">member price</Badge> : <Badge variant="secondary">guest price</Badge>}
                  </div>
                  <Button size="sm" variant="outline" className="mt-3" asChild>
                    <Link to={`/tickets/${ticket.ticket_code}`}>Open ticket</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
