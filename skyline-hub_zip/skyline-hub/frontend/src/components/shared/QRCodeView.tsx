import * as React from 'react';
import QRCode from 'qrcode';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface QRCodeViewProps {
  /** Raw value to encode (member_code or ticket_code). */
  value: string;
  /** Optional pre-rendered PNG (base64) returned by the API — used when present. */
  pngBase64?: string | null;
  size?: number;
  className?: string;
  label?: string;
}

/**
 * Renders the QR client-side with the `qrcode` package when the API does not
 * return a PNG (the mock API never does; the FastAPI backend may).
 */
export function QRCodeView({ value, pngBase64, size = 208, className, label }: QRCodeViewProps): JSX.Element {
  const [dataUrl, setDataUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const src = pngBase64 ? (pngBase64.startsWith('data:') ? pngBase64 : `data:image/png;base64,${pngBase64}`) : dataUrl;

  React.useEffect(() => {
    if (pngBase64) return;
    let cancelled = false;
    QRCode.toDataURL(value, {
      width: size * 2,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#1b1b20', light: '#ffffff' },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setError('Could not render the QR code');
      });
    return () => {
      cancelled = true;
    };
  }, [value, size, pngBase64]);

  if (error) {
    return (
      <div className={cn('grid place-items-center rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground', className)}>
        {error}
        <span className="mt-1 font-mono text-xs">{value}</span>
      </div>
    );
  }

  return (
    <figure className={cn('flex flex-col items-center gap-2', className)}>
      {src ? (
        <img
          src={src}
          width={size}
          height={size}
          alt={label ?? `QR code for ${value}`}
          className="rounded-2xl border border-border bg-white p-3 shadow-sm"
          style={{ width: size, height: size }}
        />
      ) : (
        <Skeleton className="rounded-2xl" style={{ width: size, height: size }} />
      )}
      <figcaption className="font-mono text-sm font-semibold tracking-wider text-muted-foreground">{value}</figcaption>
    </figure>
  );
}
