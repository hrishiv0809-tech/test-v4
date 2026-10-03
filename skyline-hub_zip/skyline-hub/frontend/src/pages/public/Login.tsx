import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ArrowRight, KeyRound, ShieldCheck, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Logo } from '@/components/layout/Logo';
import { apiErrorMessage, USE_MOCKS } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { DEMO_ACCOUNTS, ROLE_LABEL } from '@/lib/constants';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'At least 6 characters'),
});
type FormValues = z.infer<typeof schema>;

export default function Login(): JSX.Element {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/app/dashboard';

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  const onSubmit = async (values: FormValues): Promise<void> => {
    try {
      const user = await login(values);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}`);
      navigate(from, { replace: true });
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  };

  const fillDemo = (email: string, password: string): void => {
    setValue('email', email, { shouldValidate: true });
    setValue('password', password, { shouldValidate: true });
  };

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 lg:grid-cols-2 lg:py-16">
      <div className="hidden flex-col justify-center lg:flex">
        <Logo />
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">Sign in to Skyline Hub</h1>
        <p className="mt-3 max-w-md text-muted-foreground">
          Memberships, tickets, merch orders, fundraiser boards and the association's books — all behind one login.
        </p>
        <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
          <li className="flex items-center gap-2"><ShieldCheck className="size-4 text-primary" /> Role-based access — members never see the treasurer's books.</li>
          <li className="flex items-center gap-2"><Zap className="size-4 text-primary" /> Discounts applied automatically at checkout.</li>
          <li className="flex items-center gap-2"><KeyRound className="size-4 text-primary" /> Your digital membership card is always in your pocket.</li>
        </ul>
      </div>

      <div>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Sign in</CardTitle>
            <p className="text-sm text-muted-foreground">
              New here?{' '}
              <Link to="/signup" className="font-medium text-primary underline underline-offset-2">
                Create an account
              </Link>
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" placeholder="you@skyline.edu" aria-invalid={Boolean(errors.email)} {...register('email')} />
                {errors.email ? <p className="text-xs text-red-600">{errors.email.message}</p> : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" autoComplete="current-password" placeholder="••••••••" aria-invalid={Boolean(errors.password)} {...register('password')} />
                {errors.password ? <p className="text-xs text-red-600">{errors.password.message}</p> : null}
              </div>
              <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
                Sign in <ArrowRight />
              </Button>
            </form>

            <div className="mt-6 rounded-2xl border border-dashed border-border bg-muted/40 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">Demo accounts</p>
                {USE_MOCKS ? <Badge variant="warn">mock API</Badge> : null}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Tap a role to fill the form, then hit sign in.</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {DEMO_ACCOUNTS.map((account) => (
                  <Button
                    key={account.email}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="justify-start bg-card text-left"
                    onClick={() => fillDemo(account.email, account.password)}
                  >
                    <span className="truncate">
                      <span className="block text-xs font-semibold">{ROLE_LABEL[account.role]}</span>
                      <span className="block truncate text-[11px] font-normal text-muted-foreground">{account.email}</span>
                    </span>
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
