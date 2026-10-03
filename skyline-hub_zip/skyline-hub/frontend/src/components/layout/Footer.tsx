import * as React from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { newsletterApi } from '@/api/newsletter';
import { apiErrorMessage } from '@/api/client';
import { Logo } from './Logo';
import { ORG_NAME } from '@/lib/constants';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  name: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export function Footer(): JSX.Element {
  const [done, setDone] = React.useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: '', name: '' } });

  const onSubmit = async (values: FormValues): Promise<void> => {
    try {
      await newsletterApi.subscribe({ email: values.email, name: values.name || undefined });
      toast.success("You're on the list. Watch out for the next announcement.");
      setDone(true);
      reset();
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  };

  return (
    <footer className="mt-16 border-t border-border bg-card/60">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-[1.2fr_1fr_1fr_1.4fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            Everything the {ORG_NAME} runs — memberships, tickets, merch, fundraisers and the books — in one place.
          </p>
        </div>

        <nav aria-label="Explore">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Explore</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link className="hover:text-primary" to="/events">Events</Link></li>
            <li><Link className="hover:text-primary" to="/announcements">Announcements</Link></li>
            <li><Link className="hover:text-primary" to="/store">Merch store</Link></li>
            <li><Link className="hover:text-primary" to="/membership">Membership</Link></li>
          </ul>
        </nav>

        <nav aria-label="Members">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Members</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link className="hover:text-primary" to="/app/card">Membership card</Link></li>
            <li><Link className="hover:text-primary" to="/app/my-tickets">My tickets</Link></li>
            <li><Link className="hover:text-primary" to="/app/my-orders">My orders</Link></li>
            <li><Link className="hover:text-primary" to="/login">Sign in</Link></li>
          </ul>
        </nav>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Newsletter</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            One email per announcement. No spam, unsubscribe in one click.
          </p>
          {done ? (
            <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              Subscribed — thanks!
            </p>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="mt-3 space-y-2" noValidate>
              <Label htmlFor="newsletter-email" className="sr-only">Email address</Label>
              <div className="flex gap-2">
                <Input
                  id="newsletter-email"
                  type="email"
                  placeholder="you@skyline.edu"
                  autoComplete="email"
                  aria-invalid={Boolean(errors.email)}
                  {...register('email')}
                />
                <Button type="submit" disabled={isSubmitting} aria-label="Subscribe">
                  {isSubmitting ? <Loader2 className="animate-spin" /> : <Mail />}
                </Button>
              </div>
              {errors.email ? <p className="text-xs text-red-600">{errors.email.message}</p> : null}
            </form>
          )}
        </div>
      </div>

      <div className="border-t border-border py-5">
        <p className="mx-auto max-w-6xl px-4 text-center text-xs text-muted-foreground sm:text-left">
          © {new Date().getFullYear()} {ORG_NAME}. Demo application — payments, email and QR verification are simulated.
        </p>
      </div>
    </footer>
  );
}
