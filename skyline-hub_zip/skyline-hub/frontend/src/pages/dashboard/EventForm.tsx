import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import { EventImage } from '@/components/shared/ProductImage';
import { eventsApi, type EventFormValues } from '@/api/events';
import { apiErrorMessage } from '@/api/client';
import { MAX_UPLOAD_MB } from '@/lib/constants';
import { formatBytes } from '@/lib/utils';

const schema = z
  .object({
    title: z.string().min(3, 'Give the event a title'),
    description: z.string().min(10, 'Write a short description'),
    location: z.string().min(2, 'Where is it happening?'),
    start_date: z.string().min(1, 'Pick a start'),
    end_date: z.string().min(1, 'Pick an end'),
    capacity: z.coerce.number().int().min(1, 'Capacity must be at least 1'),
    member_price: z.coerce.number().min(0, 'Cannot be negative'),
    non_member_price: z.coerce.number().min(0, 'Cannot be negative'),
    status: z.enum(['DRAFT', 'PUBLISHED', 'COMPLETED', 'CANCELLED']),
  })
  .refine((values) => new Date(values.end_date) > new Date(values.start_date), {
    message: 'The end must be after the start',
    path: ['end_date'],
  })
  .refine((values) => values.non_member_price >= values.member_price, {
    message: 'Guest price should not be cheaper than the member price',
    path: ['non_member_price'],
  });
type FormValues = z.infer<typeof schema>;

const toLocalInput = (iso?: string): string => {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export default function EventForm(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const eventId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [image, setImage] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);

  const existing = useQuery({ queryKey: ['event', eventId], queryFn: () => eventsApi.detail(eventId), enabled: isEdit && Number.isFinite(eventId) });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      description: '',
      location: '',
      start_date: '',
      end_date: '',
      capacity: 100,
      member_price: 0,
      non_member_price: 0,
      status: 'DRAFT',
    },
  });

  React.useEffect(() => {
    if (existing.data) {
      const event = existing.data;
      reset({
        title: event.title,
        description: event.description,
        location: event.location,
        start_date: toLocalInput(event.start_date),
        end_date: toLocalInput(event.end_date),
        capacity: event.capacity,
        member_price: event.member_price,
        non_member_price: event.non_member_price,
        status: event.status,
      });
      setPreview(event.image_url);
    }
  }, [existing.data, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload: EventFormValues = {
        ...values,
        start_date: new Date(values.start_date).toISOString(),
        end_date: new Date(values.end_date).toISOString(),
      };
      return isEdit ? eventsApi.update(eventId, payload, image) : eventsApi.create(payload, image);
    },
    onSuccess: (event) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['event', event.id] });
      toast.success(isEdit ? 'Event updated' : `Event ${event.status === 'PUBLISHED' ? 'published' : 'saved'}`);
      navigate('/app/events');
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const onImage = (file: File | null): void => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Use a jpg, png or webp image');
      return;
    }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      toast.error(`Image must be ${MAX_UPLOAD_MB}MB or smaller`);
      return;
    }
    setImage(file);
    setPreview(URL.createObjectURL(file));
  };

  if (isEdit && existing.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-3">
        <Link to="/app/events">
          <ArrowLeft /> All events
        </Link>
      </Button>
      <PageHeader title={isEdit ? 'Edit event' : 'Create event'} description="Member and guest prices are set here — the backend always recalculates at checkout." />

      <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="grid gap-6 lg:grid-cols-[1.4fr_1fr]" noValidate>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Event details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="title">Title</Label>
              <Input id="title" {...register('title')} placeholder="Spring Gala 2026" aria-invalid={Boolean(errors.title)} />
              {errors.title ? <p className="text-xs text-red-600">{errors.title.message}</p> : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" rows={5} {...register('description')} placeholder="What should attendees expect?" aria-invalid={Boolean(errors.description)} />
              {errors.description ? <p className="text-xs text-red-600">{errors.description.message}</p> : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="location">Location</Label>
              <Input id="location" {...register('location')} placeholder="Grand Ballroom, Student Union" aria-invalid={Boolean(errors.location)} />
              {errors.location ? <p className="text-xs text-red-600">{errors.location.message}</p> : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="start_date">Starts</Label>
                <Input id="start_date" type="datetime-local" {...register('start_date')} aria-invalid={Boolean(errors.start_date)} />
                {errors.start_date ? <p className="text-xs text-red-600">{errors.start_date.message}</p> : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="end_date">Ends</Label>
                <Input id="end_date" type="datetime-local" {...register('end_date')} aria-invalid={Boolean(errors.end_date)} />
                {errors.end_date ? <p className="text-xs text-red-600">{errors.end_date.message}</p> : null}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="capacity">Capacity</Label>
                <Input id="capacity" type="number" min={1} {...register('capacity')} aria-invalid={Boolean(errors.capacity)} />
                {errors.capacity ? <p className="text-xs text-red-600">{errors.capacity.message}</p> : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="member_price">Member price ($)</Label>
                <Input id="member_price" type="number" step="0.01" min={0} {...register('member_price')} aria-invalid={Boolean(errors.member_price)} />
                {errors.member_price ? <p className="text-xs text-red-600">{errors.member_price.message}</p> : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="non_member_price">Guest price ($)</Label>
                <Input id="non_member_price" type="number" step="0.01" min={0} {...register('non_member_price')} aria-invalid={Boolean(errors.non_member_price)} />
                {errors.non_member_price ? <p className="text-xs text-red-600">{errors.non_member_price.message}</p> : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Publishing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="status">Status</Label>
                <Select
                  id="status"
                  {...register('status')}
                  options={[
                    { value: 'DRAFT', label: 'Draft — not visible publicly' },
                    { value: 'PUBLISHED', label: 'Published — tickets on sale' },
                    { value: 'COMPLETED', label: 'Completed' },
                    { value: 'CANCELLED', label: 'Cancelled' },
                  ]}
                />
              </div>
              <p className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
                Tickets only sell while the status is <span className="font-medium text-foreground">Published</span>.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cover image</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-40 w-full overflow-hidden rounded-xl border border-border">
                <EventImage title={existing.data?.title ?? 'New event'} imageUrl={preview} />
              </div>
              <Label htmlFor="image" className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm hover:bg-muted">
                <ImagePlus className="size-4" /> Choose image
              </Label>
              <input
                id="image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(e) => onImage(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">
                Optional. jpg / png / webp up to {MAX_UPLOAD_MB}MB {image ? `· selected ${image.name} (${formatBytes(image.size)})` : ''}
              </p>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button type="submit" className="flex-1" loading={isSubmitting || mutation.isPending}>
              {isEdit ? 'Save changes' : 'Create event'}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate('/app/events')}>
              Cancel
            </Button>
          </div>
        </div>
      </form>
    </>
  );
}
