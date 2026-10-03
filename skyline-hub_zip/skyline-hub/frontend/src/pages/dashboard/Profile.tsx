import * as React from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { IdCard, Moon, RefreshCw, Save, Sun, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { PageHeader } from '@/components/shared/PageHeader';
import { MembershipBadge } from '@/components/shared/StatusBadge';
import { authApi } from '@/api/auth';
import { membershipsApi } from '@/api/memberships';
import { apiErrorMessage, USE_MOCKS } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { ROLE_LABEL } from '@/lib/constants';
import { formatDate } from '@/lib/utils';

const schema = z.object({
  name: z.string().min(2, 'Name is required'),
  phone: z.string().optional(),
  student_id: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function Profile(): JSX.Element {
  const { user, refreshMe } = useAuth();
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const membership = useQuery({ queryKey: ['membership', 'me'], queryFn: () => membershipsApi.mine(), enabled: Boolean(user) });

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: user?.name ?? '', phone: user?.phone ?? '', student_id: user?.student_id ?? '' },
  });

  React.useEffect(() => {
    if (user) reset({ name: user.name, phone: user.phone ?? '', student_id: user.student_id ?? '' });
  }, [user, reset]);

  const save = useMutation({
    mutationFn: (values: FormValues) => authApi.updateMe(values),
    onSuccess: async () => {
      await refreshMe();
      queryClient.invalidateQueries();
      toast.success('Profile updated');
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const resetDemo = async (): Promise<void> => {
    const { resetMockData } = await import('@/api/mock');
    await resetMockData();
    toast.success('Demo data reset — reloading');
    setTimeout(() => window.location.reload(), 500);
  };

  return (
    <>
      <PageHeader title="Profile & settings" description="Your details, membership summary and workspace preferences." />

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCog className="size-4 text-primary" /> Your details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit((values) => save.mutate(values))} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="p-name">Full name</Label>
                <Input id="p-name" {...register('name')} aria-invalid={Boolean(errors.name)} />
                {errors.name ? <p className="text-xs text-red-600">{errors.name.message}</p> : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-email">Email</Label>
                <Input id="p-email" value={user?.email ?? ''} readOnly disabled />
                <p className="text-xs text-muted-foreground">Email is used for sign-in and cannot be changed here.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="p-phone">Phone</Label>
                  <Input id="p-phone" {...register('phone')} placeholder="+1 415 555 0134" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-student">Student ID</Label>
                  <Input id="p-student" {...register('student_id')} placeholder="S-2026-1234" />
                </div>
              </div>
              <Button type="submit" loading={save.isPending} disabled={!isDirty}>
                <Save /> Save changes
              </Button>
            </form>

            <Separator className="my-6" />

            <div className="flex items-center justify-between rounded-xl border border-border p-4">
              <div>
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Moon className="size-4" /> Dark mode
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Follows your system theme until you change it here.</p>
              </div>
              <Switch
                aria-label="Toggle dark mode"
                checked={theme === 'dark'}
                onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
              />
            </div>

            {USE_MOCKS ? (
              <div className="mt-4 flex items-center justify-between rounded-xl border border-dashed border-border p-4">
                <div>
                  <p className="text-sm font-medium">Demo data</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Resets members, tickets, stock and the ledger back to the seeded demo state.
                  </p>
                </div>
                <Button variant="outline" onClick={() => void resetDemo()}>
                  <RefreshCw /> Reset
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Role</span>
                <span className="font-medium">{user ? ROLE_LABEL[user.role] : '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Member since</span>
                <span className="font-medium">{formatDate(user?.created_at)}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Membership</span>
                <MembershipBadge status={membership.data?.status ?? 'NONE'} />
              </div>
              {membership.data?.member_code ? (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Member code</span>
                  <span className="font-mono text-xs">{membership.data.member_code}</span>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <IdCard className="size-4 text-primary" /> Quick links
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Button variant="outline" asChild>
                <Link to="/app/card">My membership card</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/app/my-tickets">My tickets</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/app/my-orders">My orders</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/app/my-claims">My claims</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/[0.04]">
            <CardContent className="p-5 text-sm">
              <p className="flex items-center gap-2 font-medium">
                {theme === 'dark' ? <Moon className="size-4" /> : <Sun className="size-4" />} Tip
              </p>
              <p className="mt-1 text-muted-foreground">
                Press <kbd className="rounded border border-border bg-card px-1.5">Tab</kbd> to move through every control — the whole app
                is keyboard navigable, including the fundraiser board (use arrow keys to move cards).
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
