import * as React from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, HelpCircle, Search, ShieldX, Clock3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/shared/PageHeader';
import { QRScanner } from '@/components/shared/QRScanner';
import { membersApi } from '@/api/members';
import { apiErrorMessage } from '@/api/client';
import { cn, formatDate } from '@/lib/utils';
import type { VerifyResponse } from '@/api/types';

const RESULT_STYLES: Record<
  VerifyResponse['status'],
  { bg: string; text: string; icon: typeof CheckCircle2; headline: string; ring: string }
> = {
  ACTIVE: { bg: 'bg-emerald-500', text: 'text-white', icon: CheckCircle2, headline: 'ACTIVE MEMBER', ring: 'ring-emerald-500/30' },
  PENDING: { bg: 'bg-amber-500', text: 'text-amber-950', icon: Clock3, headline: 'PENDING PAYMENT', ring: 'ring-amber-500/30' },
  EXPIRED: { bg: 'bg-red-600', text: 'text-white', icon: ShieldX, headline: 'MEMBERSHIP EXPIRED', ring: 'ring-red-500/30' },
  NOT_FOUND: { bg: 'bg-red-600', text: 'text-white', icon: ShieldX, headline: 'NOT A MEMBER', ring: 'ring-red-500/30' },
};

export default function VerifyMember(): JSX.Element {
  const [code, setCode] = React.useState('');
  const [name, setName] = React.useState('');
  const [result, setResult] = React.useState<VerifyResponse | null>(null);
  const [history, setHistory] = React.useState<{ code: string; status: VerifyResponse['status']; at: string }[]>([]);

  const verify = useMutation({
    mutationFn: (params: { code?: string; q?: string }) => membersApi.verify(params),
    onSuccess: (data, variables) => {
      setResult(data);
      setHistory((prev) => [{ code: variables.code ?? variables.q ?? '—', status: data.status, at: new Date().toISOString() }, ...prev].slice(0, 6));
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const submitCode = (value: string): void => {
    const trimmed = value.trim();
    if (!trimmed) {
      toast.error('Enter a member code or scan a QR');
      return;
    }
    setCode(trimmed);
    verify.mutate({ code: trimmed });
  };

  const style = result ? RESULT_STYLES[result.status] : null;

  return (
    <>
      <PageHeader title="Verify member" description="Scan a membership card or type a code. Guests without a valid membership pay the guest price." />

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
          <QRScanner onDecode={(text) => submitCode(text)} className="w-full" />

          <Card>
            <CardContent className="space-y-4 p-5">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  submitCode(code);
                }}
                className="space-y-2"
              >
                <Label htmlFor="verify-code">Member code, student ID or ticket code</Label>
                <div className="flex gap-2">
                  <Input id="verify-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="SKY-1001" autoComplete="off" />
                  <Button type="submit" loading={verify.isPending}>
                    <Search /> Check
                  </Button>
                </div>
              </form>

              <Separator />

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (name.trim().length < 2) {
                    toast.error('Type at least two characters of the name');
                    return;
                  }
                  verify.mutate({ q: name.trim() });
                }}
                className="space-y-2"
              >
                <Label htmlFor="verify-name">…or search by name</Label>
                <div className="flex gap-2">
                  <Input id="verify-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tanvi Kulkarni" autoComplete="off" />
                  <Button type="submit" variant="outline" loading={verify.isPending}>
                    Search
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {result && style ? (
            <div className={cn('rounded-3xl p-8 text-center shadow-xl ring-4', style.bg, style.text, style.ring)} role="status" aria-live="assertive">
              <style.icon className="mx-auto size-14" />
              <p className="mt-4 text-3xl font-bold tracking-tight">{style.headline}</p>
              {result.member_name ? <p className="mt-2 text-xl font-semibold">{result.member_name}</p> : null}
              <p className="mt-1 text-sm opacity-90">{result.message}</p>
              <dl className="mt-6 grid grid-cols-2 gap-3 text-left text-sm">
                {result.plan_name ? (
                  <div className="rounded-xl bg-black/15 p-3">
                    <dt className="text-[11px] uppercase tracking-wide opacity-80">Plan</dt>
                    <dd className="font-medium">{result.plan_name}</dd>
                  </div>
                ) : null}
                {result.end_date ? (
                  <div className="rounded-xl bg-black/15 p-3">
                    <dt className="text-[11px] uppercase tracking-wide opacity-80">Valid until</dt>
                    <dd className="font-medium">{formatDate(result.end_date)}</dd>
                  </div>
                ) : null}
                {result.member_code ? (
                  <div className="rounded-xl bg-black/15 p-3">
                    <dt className="text-[11px] uppercase tracking-wide opacity-80">Member code</dt>
                    <dd className="font-mono font-medium">{result.member_code}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
          ) : (
            <Card className="grid min-h-[280px] place-items-center p-8 text-center">
              <div>
                <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
                  <HelpCircle className="size-6" />
                </span>
                <p className="mt-4 font-medium">Waiting for a scan</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  The result appears here in full colour — green for active, amber for pending, red for anything else.
                </p>
              </div>
            </Card>
          )}

          {history.length > 0 ? (
            <Card>
              <CardContent className="p-5">
                <p className="mb-3 text-sm font-medium">Recent checks</p>
                <ul className="space-y-2">
                  {history.map((entry, index) => (
                    <li key={`${entry.code}-${index}`} className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate font-mono text-xs">{entry.code}</span>
                      <Badge variant={entry.status === 'ACTIVE' ? 'success' : entry.status === 'PENDING' ? 'warn' : 'danger'}>
                        {entry.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
