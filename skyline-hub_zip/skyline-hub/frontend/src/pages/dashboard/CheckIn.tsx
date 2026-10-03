import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, Clock3, Keyboard, QrCode, ScanLine, ShieldX, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select } from '@/components/ui/select';
import { PageHeader } from '@/components/shared/PageHeader';
import { QRScanner } from '@/components/shared/QRScanner';
import { checkinApi } from '@/api/checkin';
import { eventsApi } from '@/api/events';
import { apiErrorMessage } from '@/api/client';
import { cn, formatCurrency, formatTime } from '@/lib/utils';
import type { CheckInResponse } from '@/api/types';

interface ScanEntry extends CheckInResponse {
  at: string;
}

const RESULT_META: Record<
  CheckInResponse['result'],
  { bg: string; text: string; icon: typeof CheckCircle2; title: string }
> = {
  WELCOME: { bg: 'bg-emerald-500', text: 'text-white', icon: CheckCircle2, title: 'Welcome' },
  ALREADY_CHECKED_IN: { bg: 'bg-amber-400', text: 'text-amber-950', icon: Clock3, title: 'Already checked in' },
  INVALID: { bg: 'bg-red-600', text: 'text-white', icon: ShieldX, title: 'Invalid ticket' },
};

export default function CheckIn(): JSX.Element {
  const queryClient = useQueryClient();
  const [eventId, setEventId] = React.useState<number | undefined>(undefined);
  const [code, setCode] = React.useState('');
  const [result, setResult] = React.useState<ScanEntry | null>(null);
  const [log, setLog] = React.useState<ScanEntry[]>([]);

  const events = useQuery({ queryKey: ['events', 'checkin'], queryFn: () => eventsApi.list({ upcoming: true, page_size: 50 }) });

  React.useEffect(() => {
    if (!eventId && events.data?.items.length) setEventId(events.data.items[0].id);
  }, [events.data, eventId]);

  const stats = useQuery({
    queryKey: ['checkin', 'stats', eventId],
    queryFn: () => checkinApi.stats(eventId),
    refetchInterval: 15_000,
  });

  const scan = useMutation({
    mutationFn: (ticketCode: string) => checkinApi.scan(ticketCode),
    onSuccess: (data) => {
      const entry: ScanEntry = { ...data, at: new Date().toISOString() };
      setResult(entry);
      setLog((prev) => [entry, ...prev].slice(0, 8));
      queryClient.invalidateQueries({ queryKey: ['checkin', 'stats'] });
      if (data.result === 'WELCOME') toast.success(`${data.ticket?.buyer_name ?? 'Guest'} checked in`);
      if (data.result === 'ALREADY_CHECKED_IN') toast.warning(data.message);
      if (data.result === 'INVALID') toast.error(data.message);
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const submit = (value: string): void => {
    const trimmed = value.trim();
    if (!trimmed) {
      toast.error('Enter or scan a ticket code');
      return;
    }
    setCode('');
    scan.mutate(trimmed);
  };

  // auto-dismiss the full-screen result so volunteers can keep scanning
  React.useEffect(() => {
    if (!result) return;
    const timer = setTimeout(() => setResult(null), 3200);
    return () => clearTimeout(timer);
  }, [result]);

  const meta = result ? RESULT_META[result.result] : null;
  const total = stats.data?.total_valid ?? 0;
  const checked = stats.data?.checked_in ?? 0;

  return (
    <>
      <PageHeader
        title="Door check-in"
        description="Scan tickets or type the code. Works on a phone at the door — permission for the camera is optional."
        actions={
          <Badge variant="secondary" className="hidden sm:inline-flex">
            <Users className="size-3" /> {checked}/{total} in
          </Badge>
        }
      />

      {result && meta ? (
        <div
          className={cn('fixed inset-0 z-50 flex flex-col items-center justify-center px-6 text-center', meta.bg, meta.text)}
          role="alertdialog"
          aria-live="assertive"
          onClick={() => setResult(null)}
        >
          <meta.icon className="size-24" />
          <p className="mt-6 text-4xl font-extrabold tracking-tight sm:text-5xl">{meta.title}</p>
          {result.result !== 'INVALID' && result.ticket ? (
            <>
              <p className="mt-3 text-3xl font-bold">{result.ticket.buyer_name}</p>
              <p className="mt-2 text-base opacity-90">{result.ticket.event_title}</p>
              <p className="mt-4 font-mono text-sm opacity-90">
                {result.ticket.ticket_code} · {formatCurrency(result.ticket.price_paid)}{' '}
                {result.ticket.is_member_price ? '(member)' : '(guest)'}
              </p>
              {result.ticket.checked_in_at ? <p className="mt-2 text-sm opacity-90">Checked in at {formatTime(result.ticket.checked_in_at)}</p> : null}
            </>
          ) : (
            <>
              <p className="mt-4 text-xl font-semibold">{result.message}</p>
              <p className="mt-2 text-sm opacity-90">Ask for a printed ticket or check the spelling of the code.</p>
            </>
          )}
          <Button variant="outline" className="mt-8 border-white/40 bg-white/15 text-inherit hover:bg-white/25" onClick={() => setResult(null)}>
            <ScanLine /> Scan next
          </Button>
          <p className="mt-4 text-xs opacity-80">Auto-closes in a few seconds</p>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="space-y-1.5">
                <Label htmlFor="event">Event</Label>
                <Select
                  id="event"
                  value={String(eventId ?? '')}
                  onChange={(e) => setEventId(Number(e.target.value))}
                  options={(events.data?.items ?? []).map((event) => ({ value: String(event.id), label: `${event.title} — ${event.sold}/${event.capacity} sold` }))}
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Attendance</span>
                  <span className="text-muted-foreground">
                    {checked} of {total} checked in ({stats.data?.attendance_pct ?? 0}%)
                  </span>
                </div>
                <Progress className="mt-2" value={checked} max={Math.max(total, 1)} tone="success" />
              </div>
            </CardContent>
          </Card>

          <QRScanner onDecode={(text) => submit(text)} label="Scan a ticket QR" />

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Keyboard className="size-4 text-primary" /> Manual entry
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  submit(code);
                }}
                className="space-y-2"
              >
                <Label htmlFor="ticket-code">Ticket code</Label>
                <div className="flex gap-2">
                  <Input
                    id="ticket-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="TKT-0001-AB12"
                    autoComplete="off"
                    autoCapitalize="characters"
                    className="font-mono"
                  />
                  <Button type="submit" loading={scan.isPending}>
                    <QrCode /> Check in
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Codes are on the ticket page and in the confirmation email.</p>
              </form>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Recent scans</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {log.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Scans will appear here as you check people in.</p>
            ) : (
              log.map((entry, index) => {
                const entryMeta = RESULT_META[entry.result];
                return (
                  <div key={`${entry.ticket?.ticket_code ?? 'x'}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{entry.ticket?.buyer_name ?? 'Unknown ticket'}</p>
                      <p className="truncate font-mono text-xs text-muted-foreground">{entry.ticket?.ticket_code ?? '—'}</p>
                    </div>
                    <Badge variant={entry.result === 'WELCOME' ? 'success' : entry.result === 'ALREADY_CHECKED_IN' ? 'warn' : 'danger'}>
                      {entryMeta.title}
                    </Badge>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
