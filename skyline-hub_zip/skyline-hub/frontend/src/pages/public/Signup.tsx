import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { plansApi } from '@/api/memberships';
import { apiErrorMessage } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency } from '@/lib/utils';
import { Logo } from '@/components/layout/Logo';

const schema = z.object({
  name: z.string().min(2, 'Enter your full name'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'At least 6 characters'),
  phone: z.string().min(7, 'Enter a contact number').optional().or(z.literal('')),
  student_id: z.string().min(3, 'Student ID is required'),
  plan_id: z.coerce.number().int().positive('Choose a plan'),
});
type FormValues = z.infer<typeof schema>;

export default function Signup(): JSX.Element {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { signup } = useAuth();
  const plans = useQuery({ queryKey: ['plans'], queryFn: () => plansApi.list() });
  const preset = params.get('plan');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '', phone: '', student_id: '', plan_id: preset ? Number(preset) : 1 },
  });

  const selectedPlanId = watch('plan_id');
  const selectedPlan = (plans.data ?? []).find((p) => Number(p.id) === Number(selectedPlanId)) ?? plans.data?.[0];

  const onSubmit = async (values: FormValues): Promise<void> => {
    try {
      await signup({
        name: values.name,
        email: values.email,
        password: values.password,
        phone: values.phone || undefined,
        student_id: values.student_id,
        plan_id: Number(values.plan_id),
      });
      toast.success('Account created — one step left to activate your membership');
      navigate('/checkout', { state: { kind: 'MEMBERSHIP_CHECKOUT', plan_id: Number(values.plan_id) } });
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  };

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 lg:grid-cols-[1fr_1.05fr] lg:py-16">
      <div>
        <Logo />
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">Join the Skyline Student Association</h1>
        <p className="mt-3 text-muted-foreground">
          Create your account, pick a plan and pay your dues. It takes about two minutes and your QR membership card is ready
          immediately.
        </p>

        <Card className="mt-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">What happens next</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p className="flex gap-2"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">1</span> Create your account (this form).</p>
            <p className="flex gap-2"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">2</span> Pay your dues with the mock checkout.</p>
            <p className="flex gap-2"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">3</span> Your card and discounts activate instantly.</p>
          </CardContent>
        </Card>

        {selectedPlan ? (
          <Card className="mt-4 border-primary/25 bg-primary/[0.04]">
            <CardContent className="p-5">
              <p className="flex items-center justify-between text-sm font-semibold">
                <span>{selectedPlan.name}</span>
                <span>{formatCurrency(selectedPlan.price)}</span>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="default">{selectedPlan.ticket_discount_percent}% off tickets</Badge>
                <Badge variant="accent">{selectedPlan.merch_discount_percent}% off merch</Badge>
              </div>
              <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                {selectedPlan.benefits.slice(0, 3).map((benefit) => (
                  <li key={benefit} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" /> {benefit}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Create your account</CardTitle>
          <p className="text-sm text-muted-foreground">
            Already a member?{' '}
            <Link to="/login" className="font-medium text-primary underline underline-offset-2">Sign in</Link>
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" autoComplete="name" placeholder="Alex Morgan" aria-invalid={Boolean(errors.name)} {...register('name')} />
              {errors.name ? <p className="text-xs text-red-600">{errors.name.message}</p> : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" placeholder="alex@skyline.edu" aria-invalid={Boolean(errors.email)} {...register('email')} />
                {errors.email ? <p className="text-xs text-red-600">{errors.email.message}</p> : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Input id="phone" type="tel" autoComplete="tel" placeholder="+1 415 555 0134" {...register('phone')} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="student_id">Student ID</Label>
                <Input id="student_id" placeholder="S-2026-1234" aria-invalid={Boolean(errors.student_id)} {...register('student_id')} />
                {errors.student_id ? <p className="text-xs text-red-600">{errors.student_id.message}</p> : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" autoComplete="new-password" placeholder="••••••••" aria-invalid={Boolean(errors.password)} {...register('password')} />
                {errors.password ? <p className="text-xs text-red-600">{errors.password.message}</p> : null}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="plan_id">Membership plan</Label>
              {plans.isLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select id="plan_id" {...register('plan_id')}>
                  {(plans.data ?? []).map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} — {formatCurrency(plan.price)} ({plan.ticket_discount_percent}% off tickets, {plan.merch_discount_percent}% off merch)
                    </option>
                  ))}
                </Select>
              )}
              {errors.plan_id ? <p className="text-xs text-red-600">{errors.plan_id.message}</p> : null}
            </div>

            <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
              Create account & continue <ArrowRight />
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              This is a demo — no payment details are ever collected and no real emails are sent.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
