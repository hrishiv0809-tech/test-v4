import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Eye, Mail, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/shared/PageHeader';
import { CategoryBadge } from '@/components/shared/StatusBadge';
import { Markdown } from '@/components/shared/Markdown';
import { announcementsApi } from '@/api/announcements';
import { apiErrorMessage } from '@/api/client';
import type { AnnouncementCategory } from '@/api/types';

const schema = z.object({
  title: z.string().min(4, 'Give it a clear title'),
  category: z.enum(['MEETING', 'DEADLINE', 'CHANGE_OF_PLAN', 'GENERAL']),
  body: z.string().min(10, 'Write the announcement body'),
  send_email: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

export default function AnnouncementComposer(): JSX.Element {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [pendingValues, setPendingValues] = React.useState<FormValues | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', category: 'MEETING', body: '', send_email: true },
  });

  const body = watch('body');
  const title = watch('title');
  const category = watch('category');
  const sendEmail = watch('send_email');

  const mutation = useMutation({
    mutationFn: (values: FormValues) => announcementsApi.create(values),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(
        result.recipient_count > 0
          ? `Announcement posted — ${result.recipient_count} emails queued (see the Email log)`
          : 'Announcement posted',
      );
      navigate('/app/announcements');
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const submit = (values: FormValues): void => {
    if (values.send_email) {
      setPendingValues(values);
      setConfirmOpen(true);
      return;
    }
    mutation.mutate(values);
  };

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-3">
        <Link to="/app/announcements">
          <ArrowLeft /> All announcements
        </Link>
      </Button>

      <PageHeader
        title="New announcement"
        description="Markdown is supported: ## headings, **bold**, - lists and [links](https://example.com)."
      />

      <form onSubmit={handleSubmit(submit)} className="grid gap-6 lg:grid-cols-2" noValidate>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Compose</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="title">Title</Label>
              <Input id="title" {...register('title')} placeholder="General meeting — Thursday 6pm, Room 214" aria-invalid={Boolean(errors.title)} />
              {errors.title ? <p className="text-xs text-red-600">{errors.title.message}</p> : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="category">Category</Label>
              <Select
                id="category"
                {...register('category')}
                options={[
                  { value: 'MEETING', label: 'Meeting' },
                  { value: 'DEADLINE', label: 'Deadline' },
                  { value: 'CHANGE_OF_PLAN', label: 'Change of plan' },
                  { value: 'GENERAL', label: 'General' },
                ]}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="body">Body (markdown)</Label>
              <Textarea
                id="body"
                rows={14}
                className="font-mono text-[13px]"
                placeholder={'## Agenda\n\n1. Gala numbers\n2. Bake sale rota\n\n**Bring** your questions.'}
                aria-invalid={Boolean(errors.body)}
                {...register('body')}
              />
              {errors.body ? <p className="text-xs text-red-600">{errors.body.message}</p> : null}
            </div>

            <div className="flex items-start justify-between gap-3 rounded-xl border border-border p-4">
              <div>
                <Label htmlFor="send_email" className="cursor-pointer">
                  Also email active members + mailing list
                </Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Deduplicated by address. Without SMTP configured, every email is logged and visible on the Email log page.
                </p>
              </div>
              <Switch id="send_email" checked={sendEmail} onCheckedChange={(checked) => setValue('send_email', checked)} />
            </div>

            <div className="flex gap-2">
              <Button type="submit" className="flex-1" loading={isSubmitting || mutation.isPending}>
                {sendEmail ? <Mail /> : <Send />} {sendEmail ? 'Post & email' : 'Post announcement'}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate('/app/announcements')}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:sticky lg:top-24 lg:self-start">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Eye className="size-4 text-primary" /> Live preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-2xl border border-border p-5">
              <div className="flex items-center justify-between gap-2">
                <CategoryBadge category={category as AnnouncementCategory} />
                <span className="text-xs text-muted-foreground">just now</span>
              </div>
              <h3 className="mt-3 text-lg font-semibold">{title || 'Your title appears here'}</h3>
              {body ? (
                <Markdown content={body} className="mt-3" />
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">Start typing to see the rendered markdown.</p>
              )}
            </div>
            {sendEmail ? (
              <Badge variant="warn" className="mt-4">
                Will email active members and subscribers
              </Badge>
            ) : (
              <Badge variant="secondary" className="mt-4">
                Website only — no email
              </Badge>
            )}
          </CardContent>
        </Card>
      </form>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send this to everyone?</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">{title}</span> will be posted publicly and emailed to every active member and
              mailing-list subscriber (duplicates removed).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Not yet
            </Button>
            <Button
              loading={mutation.isPending}
              onClick={() => {
                if (pendingValues) mutation.mutate(pendingValues);
                setConfirmOpen(false);
              }}
            >
              <Mail /> Post & send emails
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
