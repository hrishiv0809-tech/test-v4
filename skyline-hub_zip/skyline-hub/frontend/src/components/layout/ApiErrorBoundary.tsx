import * as React from 'react';
import { AlertOctagon, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface State {
  error: Error | null;
}

/** Catches render-time crashes so the user never sees a blank white screen. */
export class ApiErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error): void {
    // eslint-disable-next-line no-console
    console.error('[Skyline Hub] Unhandled UI error:', error);
  }

  render(): React.ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4">
        <Card className="max-w-lg">
          <CardContent className="p-8 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300">
              <AlertOctagon className="size-6" />
            </span>
            <h1 className="mt-4 text-lg font-semibold">Something broke in the interface</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              The error has been logged to the console. Reloading usually clears it — if it doesn't, reset the demo data.
            </p>
            <pre className="mt-4 max-h-32 overflow-auto rounded-xl bg-muted p-3 text-left text-xs text-muted-foreground">
              {this.state.error.message}
            </pre>
            <div className="mt-6 flex justify-center gap-2">
              <Button onClick={() => window.location.reload()}>
                <RefreshCw /> Reload
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
}
