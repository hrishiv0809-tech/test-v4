import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, MailX } from 'lucide-react';
import { newsletterApi } from '@/api/newsletter';
import { apiErrorMessage } from '@/api/client';

export default function Unsubscribe(): JSX.Element {
  const { token } = useParams<{ token: string }>();
  const query = useQuery({ queryKey: ['unsubscribe', token], queryFn: () => newsletterApi.unsubscribe(token ?? ''), enabled: Boolean(token), retry: false });

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <Card>
        <CardContent className="p-8 text-center">
          {query.isLoading ? (
            <>
              <Skeleton className="mx-auto size-12 rounded-2xl" />
              <Skeleton className="mx-auto mt-4 h-5 w-40" />
            </>
          ) : query.isError ? (
            <>
              <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300">
                <MailX className="size-6" />
              </span>
              <h1 className="mt-4 text-lg font-semibold">That link didn't work</h1>
              <p className="mt-2 text-sm text-muted-foreground">{apiErrorMessage(query.error)}</p>
              <Button className="mt-6" variant="outline" asChild>
                <Link to="/">Back to the site</Link>
              </Button>
            </>
          ) : (
            <>
              <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                <CheckCircle2 className="size-6" />
              </span>
              <h1 className="mt-4 text-lg font-semibold">You've been unsubscribed</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {query.data?.email} will no longer receive announcement emails. You can resubscribe from the footer at any time.
              </p>
              <Button className="mt-6" asChild>
                <Link to="/">Back to the site</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
