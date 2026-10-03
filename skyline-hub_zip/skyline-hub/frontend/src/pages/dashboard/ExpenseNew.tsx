import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileUp, Receipt, UploadCloud, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/shared/PageHeader';
import { expensesApi } from '@/api/expenses';
import { eventsApi } from '@/api/events';
import { fundraisersApi } from '@/api/fundraisers';
import { apiErrorMessage } from '@/api/client';
import { EXPENSE_CATEGORIES, MAX_UPLOAD_MB } from '@/lib/constants';
import { cn, formatBytes } from '@/lib/utils';

const schema = z.object({
  amount: z.coerce.number().min(0.01, 'Enter the amount you paid'),
  description: z.string().min(5, 'Describe what this was for'),
  category: z.string().min(2, 'Pick a category'),
  fundraiser_id: z.string().optional(),
  event_id: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

const ACCEPTED = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];

export default function ExpenseNew(): JSX.Element {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [receipt, setReceipt] = React.useState<File | null>(null);
  const [receiptError, setReceiptError] = React.useState<string | null>(null);
  const [dragOver, setDragOver] = React.useState(false);

  const fundraisers = useQuery({ queryKey: ['fundraisers'], queryFn: () => fundraisersApi.list() });
  const events = useQuery({ queryKey: ['events', 'claim-links'], queryFn: () => eventsApi.list({ page_size: 50 }) });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { amount: 0, description: '', category: EXPENSE_CATEGORIES[0], fundraiser_id: '', event_id: '' },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      if (!receipt) throw new Error('A receipt is required');
      return expensesApi.create({
        amount: values.amount,
        description: values.description,
        category: values.category,
        fundraiser_id: values.fundraiser_id ? Number(values.fundraiser_id) : null,
        event_id: values.event_id ? Number(values.event_id) : null,
        receipt,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Claim submitted — the treasurer has it in the queue');
      navigate('/app/my-claims');
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const acceptFile = (file: File | null): void => {
    setReceiptError(null);
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      setReceiptError('Receipts must be a jpg, png or pdf');
      return;
    }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setReceiptError(`Receipt must be ${MAX_UPLOAD_MB}MB or smaller`);
      return;
    }
    setReceipt(file);
  };

  const receiptPreview = React.useMemo(() => {
    if (!receipt) return null;
    return URL.createObjectURL(receipt);
  }, [receipt]);

  return (
    <>
      <PageHeader
        title="Submit an expense claim"
        description="Attach the receipt photo — claims without one cannot be submitted, and the treasurer will reject them."
      />

      <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="grid gap-6 lg:grid-cols-[1.4fr_1fr]" noValidate>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Claim details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="amount">Amount paid ($)</Label>
                <Input id="amount" type="number" step="0.01" min={0} {...register('amount')} aria-invalid={Boolean(errors.amount)} />
                {errors.amount ? <p className="text-xs text-red-600">{errors.amount.message}</p> : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="category">Category</Label>
                <Select id="category" {...register('category')} options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">What was it for?</Label>
              <Textarea
                id="description"
                rows={3}
                {...register('description')}
                placeholder="Baking supplies — flour, butter and chocolate chips for the bake sale"
                aria-invalid={Boolean(errors.description)}
              />
              {errors.description ? <p className="text-xs text-red-600">{errors.description.message}</p> : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="fundraiser_id">Linked fundraiser</Label>
                <Select
                  id="fundraiser_id"
                  {...register('fundraiser_id')}
                  options={[
                    { value: '', label: 'Not linked' },
                    ...(fundraisers.data ?? []).map((f) => ({ value: String(f.id), label: f.title })),
                  ]}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="event_id">Linked event</Label>
                <Select
                  id="event_id"
                  {...register('event_id')}
                  options={[
                    { value: '', label: 'Not linked' },
                    ...(events.data?.items ?? []).map((e) => ({ value: String(e.id), label: e.title })),
                  ]}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Receipt (required)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <label
                htmlFor="receipt"
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragOver(false);
                  acceptFile(event.dataTransfer.files?.[0] ?? null);
                }}
                className={cn(
                  'flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border px-6 py-8 text-center transition-colors hover:border-primary/50',
                  dragOver && 'border-primary bg-primary/5',
                )}
              >
                <UploadCloud className="size-8 text-primary" />
                <p className="mt-2 text-sm font-medium">Drop the receipt here or browse</p>
                <p className="mt-1 text-xs text-muted-foreground">jpg, png or pdf · max {MAX_UPLOAD_MB}MB</p>
                <input
                  id="receipt"
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  className="sr-only"
                  onChange={(event) => acceptFile(event.target.files?.[0] ?? null)}
                />
              </label>

              {receiptError ? <p className="text-xs font-medium text-red-600">{receiptError}</p> : null}

              {receipt && receiptPreview ? (
                <div className="rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="flex min-w-0 items-center gap-2 text-sm">
                      <FileUp className="size-4 shrink-0 text-primary" />
                      <span className="truncate">{receipt.name}</span>
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{formatBytes(receipt.size)}</span>
                      <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove receipt" onClick={() => setReceipt(null)}>
                        <X />
                      </Button>
                    </div>
                  </div>
                  {receipt.type.startsWith('image/') ? (
                    <img src={receiptPreview} alt="Receipt preview" className="mt-3 max-h-56 w-full rounded-lg object-contain" />
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">PDF attached — the treasurer sees it inline in the queue.</p>
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Button type="submit" size="lg" className="w-full" loading={mutation.isPending} disabled={!receipt}>
            <Receipt /> Submit claim
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Submitting without a receipt is blocked here and rejected by the API — receipts are mandatory.
          </p>
        </div>
      </form>
    </>
  );
}
