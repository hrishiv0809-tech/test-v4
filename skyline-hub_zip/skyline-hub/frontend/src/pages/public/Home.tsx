import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  Gift,
  MapPin,
  Megaphone,
  Sparkles,
  Ticket,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { EventImage, ProductImage } from '@/components/shared/ProductImage';
import { CategoryBadge } from '@/components/shared/StatusBadge';
import { Markdown } from '@/components/shared/Markdown';
import { eventsApi } from '@/api/events';
import { announcementsApi } from '@/api/announcements';
import { productsApi } from '@/api/products';
import { plansApi } from '@/api/memberships';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency, formatDate, formatDateTime, percent } from '@/lib/utils';
import { ORG_NAME } from '@/lib/constants';

export default function Home(): JSX.Element {
  const { user } = useAuth();
  const events = useQuery({ queryKey: ['events', 'home'], queryFn: () => eventsApi.list({ upcoming: true, page_size: 3 }) });
  const announcements = useQuery({ queryKey: ['announcements', 'home'], queryFn: () => announcementsApi.list({ page_size: 3 }) });
  const products = useQuery({ queryKey: ['products', 'home'], queryFn: () => productsApi.list(true) });
  const plans = useQuery({ queryKey: ['plans'], queryFn: () => plansApi.list() });

  const upcoming = events.data?.items ?? [];
  const latest = announcements.data?.items ?? [];
  const merch = (products.data ?? []).slice(0, 3);

  return (
    <div>
      {/* Hero */}
      <section className="hero-grad relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
          <div className="animate-in">
            <Badge className="border-white/25 bg-white/10 text-white">
              <Sparkles className="size-3" /> Open for 2026 memberships
            </Badge>
            <h1 className="mt-4 text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              One hub for everything {ORG_NAME} runs.
            </h1>
            <p className="mt-4 max-w-xl text-lg text-white/80">
              Buy a membership in two minutes, get your digital card with a QR code, grab discounted gala tickets, order club
              merch and follow every dollar we raise and spend.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button size="lg" variant="accent" asChild className="shadow-lg">
                <Link to={user ? '/app/card' : '/signup'}>
                  {user ? 'View my membership' : 'Join now'} <ArrowRight />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white">
                <Link to="/events">Browse events</Link>
              </Button>
            </div>
            <dl className="mt-9 grid max-w-lg grid-cols-3 gap-4 text-white">
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/60">Members</dt>
                <dd className="text-2xl font-semibold">{plans.isLoading ? '—' : '29'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/60">Upcoming events</dt>
                <dd className="text-2xl font-semibold">{events.data?.total ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/60">Member savings</dt>
                <dd className="text-2xl font-semibold">Up to 40%</dd>
              </div>
            </dl>
          </div>

          <div className="relative">
            <Card className="overflow-hidden border-white/15 bg-white/95 dark:bg-card/95">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <CalendarDays className="size-4 text-primary" /> Next up on campus
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {events.isLoading ? (
                  <>
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </>
                ) : upcoming.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No published events yet — check back soon.</p>
                ) : (
                  upcoming.slice(0, 3).map((event) => (
                    <Link
                      key={event.id}
                      to={`/events/${event.id}`}
                      className="flex items-center gap-3 rounded-xl border border-border p-3 transition-colors hover:border-primary/40 hover:bg-muted/60"
                    >
                      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                        <span className="text-[11px] font-semibold uppercase leading-none">
                          {formatDate(event.start_date, 'MMM')}
                          <span className="block text-base font-bold leading-tight">{formatDate(event.start_date, 'd')}</span>
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{event.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {event.location} · from {formatCurrency(event.member_price)}
                        </span>
                      </span>
                      <ArrowRight className="size-4 text-muted-foreground" />
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Upcoming events */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">Upcoming events</h2>
            <p className="mt-1 text-sm text-muted-foreground">Member pricing applies automatically at checkout.</p>
          </div>
          <Button variant="ghost" asChild>
            <Link to="/events">All events <ArrowRight /></Link>
          </Button>
        </div>

        {events.isLoading ? (
          <div className="grid gap-5 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="h-40 w-full rounded-none" />
                <CardContent className="space-y-3 p-5">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : upcoming.length === 0 ? (
          <EmptyState icon={CalendarDays} title="No upcoming events yet" description="Published events will appear here the moment they go live." />
        ) : (
          <div className="grid gap-5 md:grid-cols-3">
            {upcoming.map((event) => {
              const fill = percent(event.sold, event.capacity);
              return (
                <Card key={event.id} className="group flex flex-col overflow-hidden transition-all hover:-translate-y-0.5 hover:border-primary/40">
                  <div className="h-40 w-full overflow-hidden">
                    <EventImage title={event.title} imageUrl={event.image_url} className="transition-transform duration-300 group-hover:scale-[1.03]" />
                  </div>
                  <CardContent className="flex flex-1 flex-col p-5">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="size-3.5" /> {formatDateTime(event.start_date)}
                    </div>
                    <h3 className="mt-2 text-lg font-semibold">{event.title}</h3>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="size-3.5" /> {event.location}
                    </p>
                    <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{event.description}</p>

                    <div className="mt-4 space-y-2">
                      <Progress value={event.sold} max={event.capacity} tone={fill > 85 ? 'danger' : 'primary'} />
                      <div className="flex items-center justify-between text-xs">
                        <span className={event.is_sold_out ? 'font-semibold text-red-600' : 'text-muted-foreground'}>
                          {event.is_sold_out ? 'Sold out' : `${event.seats_left} seats left`}
                        </span>
                        <span className="font-semibold text-foreground">
                          {formatCurrency(event.member_price)} <span className="font-normal text-muted-foreground">members</span>
                        </span>
                      </div>
                    </div>

                    <Button className="mt-4 w-full" variant="outline" asChild>
                      <Link to={`/events/${event.id}`}>{event.is_sold_out ? 'View details' : 'Get tickets'}</Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Announcements + merch */}
      <section className="border-y border-border bg-card/50 py-14">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 lg:grid-cols-2">
          <div>
            <div className="mb-6 flex items-end justify-between gap-4">
              <h2 className="flex items-center gap-2 text-2xl font-semibold">
                <Megaphone className="size-5 text-primary" /> Latest announcements
              </h2>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/announcements">Archive <ArrowRight /></Link>
              </Button>
            </div>

            {announcements.isLoading ? (
              <div className="space-y-3">
                {[0, 1].map((i) => (
                  <Card key={i} className="p-5">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="mt-3 h-4 w-full" />
                  </Card>
                ))}
              </div>
            ) : latest.length === 0 ? (
              <EmptyState icon={Megaphone} title="No announcements yet" />
            ) : (
              <div className="space-y-4">
                {latest.map((item) => (
                  <Card key={item.id} className="p-5">
                    <div className="flex items-center justify-between gap-3">
                      <CategoryBadge category={item.category} />
                      <span className="text-xs text-muted-foreground">{formatDateTime(item.published_at)}</span>
                    </div>
                    <h3 className="mt-3 font-semibold">{item.title}</h3>
                    <Markdown content={item.body.split('\n').slice(0, 3).join('\n')} className="mt-2 line-clamp-3" />
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="mb-6 flex items-end justify-between gap-4">
              <h2 className="flex items-center gap-2 text-2xl font-semibold">
                <Gift className="size-5 text-primary" /> Club merch
              </h2>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/store">Store <ArrowRight /></Link>
              </Button>
            </div>

            {products.isLoading ? (
              <div className="grid gap-4 sm:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <Card key={i} className="overflow-hidden">
                    <Skeleton className="h-28 w-full rounded-none" />
                    <CardContent className="space-y-2 p-4">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-4 w-1/3" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-3">
                {merch.map((product) => (
                  <Link key={product.id} to={`/store/${product.id}`} className="group">
                    <Card className="h-full overflow-hidden transition-all group-hover:-translate-y-0.5 group-hover:border-primary/40">
                      <div className="h-28 w-full overflow-hidden">
                        <ProductImage name={product.name} imageUrl={product.image_url} />
                      </div>
                      <CardContent className="p-4">
                        <p className="text-sm font-medium leading-snug">{product.name}</p>
                        <p className="mt-1 text-sm font-semibold text-primary">{formatCurrency(product.base_price)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {product.total_stock > 0 ? `${product.total_stock} in stock` : 'Sold out'}
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}

            <Card className="mt-6 border-primary/20 bg-primary/[0.04] p-5">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Ticket className="size-4 text-primary" /> Members save on every order
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Discounts are applied automatically at checkout the moment your dues are paid — no codes needed.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-semibold">Membership plans</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            Dues cover the whole academic year and pay for themselves after one or two events.
          </p>
        </div>

        {plans.isLoading ? (
          <div className="grid gap-6 md:grid-cols-2">
            <Skeleton className="h-72 w-full" />
            <Skeleton className="h-72 w-full" />
          </div>
        ) : (
          <div className="mx-auto grid max-w-3xl gap-6 md:grid-cols-2">
            {(plans.data ?? []).map((plan, index) => (
              <Card key={plan.id} className={index === 1 ? 'relative border-primary/40 shadow-lg' : ''}>
                {index === 1 ? (
                  <Badge className="absolute -top-3 left-5 bg-accent text-accent-foreground">Most popular</Badge>
                ) : null}
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{plan.name}</span>
                    <span className="text-2xl">{formatCurrency(plan.price)}</span>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">Valid for {plan.duration_months} months · until the end of the academic year</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="default"><Ticket className="size-3" /> {plan.ticket_discount_percent}% off tickets</Badge>
                    <Badge variant="accent">{plan.merch_discount_percent}% off merch</Badge>
                  </div>
                  <ul className="space-y-2 text-sm">
                    {plan.benefits.map((benefit) => (
                      <li key={benefit} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                        <span className="text-muted-foreground">{benefit}</span>
                      </li>
                    ))}
                  </ul>
                  <Button className="w-full" variant={index === 1 ? 'default' : 'outline'} asChild>
                    <Link to={user ? '/membership' : `/signup?plan=${plan.id}`}>
                      <Users /> Choose {plan.name.split(' ')[0]}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
