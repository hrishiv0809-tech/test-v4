import * as React from 'react';
import { Camera, CameraOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface QRScannerProps {
  onDecode: (text: string) => void;
  className?: string;
  label?: string;
}

/**
 * Camera QR scanner (html5-qrcode). Camera access can be blocked, unavailable or
 * simply absent — every screen using this must also offer manual code entry.
 */
export function QRScanner({ onDecode, className, label = 'Point the camera at the QR code' }: QRScannerProps): JSX.Element {
  const containerId = React.useId().replace(/:/g, '-');
  const scannerRef = React.useRef<import('html5-qrcode').Html5Qrcode | null>(null);
  const [active, setActive] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [starting, setStarting] = React.useState(false);
  const lastScan = React.useRef<{ text: string; at: number }>({ text: '', at: 0 });

  const stop = React.useCallback(async (): Promise<void> => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (scanner) {
      try {
        await scanner.stop();
        scanner.clear();
      } catch {
        /* already stopped */
      }
    }
    setActive(false);
  }, []);

  React.useEffect(() => {
    return () => {
      void stop();
    };
  }, [stop]);

  const start = async (): Promise<void> => {
    setError(null);
    setStarting(true);
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode(containerId, { verbose: false });
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText: string) => {
          const now = Date.now();
          if (lastScan.current.text === decodedText && now - lastScan.current.at < 2500) return;
          lastScan.current = { text: decodedText, at: now };
          onDecode(decodedText.trim());
        },
        () => {
          /* per-frame decode misses are expected — ignore */
        },
      );
      setActive(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(
        /permission|denied|notallowed/i.test(message)
          ? 'Camera permission was blocked. Enter the code manually below.'
          : 'No camera available on this device. Enter the code manually below.',
      );
      scannerRef.current = null;
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className={cn('rounded-2xl border border-border bg-card p-4', className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Camera className="size-4 text-primary" /> {label}
        </p>
        {active ? (
          <Button variant="outline" size="sm" onClick={() => void stop()}>
            <CameraOff /> Stop
          </Button>
        ) : (
          <Button size="sm" loading={starting} onClick={() => void start()}>
            <Camera /> Start camera
          </Button>
        )}
      </div>

      <div
        id={containerId}
        className={cn(
          'mt-3 overflow-hidden rounded-xl bg-black/90',
          active ? 'min-h-[240px]' : 'grid h-[180px] place-items-center',
        )}
      >
        {!active ? (
          <p className="px-6 text-center text-xs text-white/70">
            {error ?? 'Camera preview appears here. Manual entry always works if the camera is unavailable.'}
          </p>
        ) : null}
      </div>
    </div>
  );
}
