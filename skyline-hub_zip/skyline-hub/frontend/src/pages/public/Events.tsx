import * as React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Clock, MapPin, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { SearchInput } from '@/components/shared/SearchInput';
import { EventImage } from '@/components/shared/ProductImage';
import { DataPagination } from '@/components/shared/DataPagination';
import { eventsApi } from '@/api/events';
import { useDebounce } from '@/hooks/useDebounce';
import { formatCurrency, formatDateTime, percent } from '@/lib/utils';

export default function Events(): JSX.Element {
  const [tab, setTab] = React.useState<'upcoming' | 'past'>('upcoming');
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const debounced = useDebounce(search);

  React.useEffect(() => setPage(1), [tab, debounced]);

  const query = useQuery({
    queryKey: ['events', 'public', tab, debounced, page],
    queryFn: () => eventsApi.list({ page_size: 9, page, search: debounced || undefined }),
  });

  const now = Date.now();
  const items = (query.data?.items ?? []).filter((event) =>
    tab === 'upcoming' ? new Date(event.start_date).getTime() >= now - 86_400_000 : new Date(event.start_date).getTime() < now,
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <PageHeader
        title="Events"
        description="Everything happening on campus this semester. Member prices are applied automatically."
        actions={
          <Tabs value={tab} onValueChange={(value) => setTab(value as 'upcoming' | 'past')}>
            <TabsList>
              <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
              <TabsTrigger value="past">Past</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      <div className="mb-6 max-w-sm">
        <SearchInput value={search} onChange={setSearch} placeholder="Search events or venues…" ariaLabel="Search events" />
      </div>

      {query.isLoading ? (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="h-40 w-full rounded-none" />
              <CardContent className="space-y-3 p-5">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-2 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : query.isError ? (
        <EmptyState icon={CalendarDays} title="Couldn't load events" description="Check your connection and try again." action={<Button onClick={() => query.refetch()}>Retry</Button>} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={tab === 'upcoming' ? CalendarDays : Search}
          title={tab === 'upcoming' ? 'No upcoming events yet' : 'No past events to show'}
          description={tab === 'upcoming' ? 'As soon as the board publishes an event it shows up here.' : 'Completed events will be archived here with their attendance reports.'}
        />
      ) : (
        <>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {items.map((event) => {
              const fill = percent(event.sold, event.capacity);
              return (
                <Card key={event.id} className="group flex flex-col overflow-hidden transition-all hover:-translate-y-0.5 hover:border-primary/40">
                  <div className="relative h-44 w-full overflow-hidden">
                    <EventImage title={event.title} imageUrl={event.image_url} className="transition-transform duration-300 group-hover:scale-[1.03]" />
                    <div className="absolute left-3 top-3 flex gap-2">
                      <Badge variant="secondary" className="bg-white/90 text-foreground">{formatDateTime(event.start_date)}</Badge>
                    </div>
                    {event.is_sold_out ? (
                      <div className="absolute inset-0 grid place-items-center bg-black/55">
                        <span className="rounded-xl bg-white/95 px-4 py-2 text-sm font-semibold uppercase tracking-wide">Sold out</span>
                      </div>
                    ) : null}
                  </div>
                  <CardContent className="flex flex-1 flex-col p-5">
                    <h2 className="text-lg font-semibold leading-snug">{event.title}</h2>
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="size-3.5" /> {event.location}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="size-3.5" /> Ends {formatDateTime(event.end_date)}
                    </p>
                    <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{event.description}</p>

                    <div className="mt-auto space-y-2 pt-4">
                      <Progress value={event.sold} max={event.capacity} tone={fill > 85 ? 'danger' : 'primary'} />
                      <div className="flex items-center justify-between text-xs">
                        <span className={event.is_sold_out ? 'font-semibold text-red-600' : 'text-muted-foreground'}>
                          {event.is_sold_out ? 'Sold out' : `${event.seats_left} seats left`}
                        </span>
                        <span className="text-muted-foreground">{event.sold}/{event.capacity} sold</span>
                      </div>
                      <div className="flex items-center justify-between rounded-xl bg-muted/60 px-3 py-2">
                        <span className="text-xs text-muted-foreground">Members</span>
                        <span className="text-sm font-semibold">{formatCurrency(event.member_price)}</span>
                        <span className="text-xs text-muted-foreground">Guests</span>
                        <span className="text-sm font-semibold">{formatCurrency(event.non_member_price)}</span>
                      </div>
                      <Button className="w-full" variant={event.is_sold_out ? 'outline' : 'default'} asChild>
                        <Link to={`/events/${event.id}`}>{event.is_sold_out ? 'View details' : 'Get tickets'}</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {query.data ? (
            <DataPagination
              page={query.data.page}
              pages={query.data.pages}
              total={query.data.total}
              pageSize={query.data.page_size}
              onPageChange={setPage}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
