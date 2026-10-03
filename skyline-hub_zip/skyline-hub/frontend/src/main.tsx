import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import App from './App';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ApiErrorBoundary } from '@/components/layout/ApiErrorBoundary';
import { USE_MOCKS } from '@/api/client';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // never retry auth/permission failures — surface them immediately
        const status = (error as { response?: { status?: number } })?.response?.status;
        if (status && status >= 400 && status < 500) return false;
        return failureCount < 1;
      },
    },
    mutations: { retry: 0 },
  },
});

async function bootstrap(): Promise<void> {
  // Mock mode must be installed before the first query fires. The mock layer is
  // imported dynamically so a real-API build never ships it in the main chunk.
  if (USE_MOCKS) {
    const { installMockApi } = await import('@/api/mock');
    await installMockApi();
  }

  const root = document.getElementById('root');
  if (!root) throw new Error('#root is missing from index.html');

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ApiErrorBoundary>
            <BrowserRouter>
              <AuthProvider>
                <TooltipProvider delayDuration={200}>
                  <App />
                  <Toaster
                    position="top-right"
                    richColors
                    closeButton
                    toastOptions={{ className: 'rounded-xl' }}
                  />
                </TooltipProvider>
              </AuthProvider>
            </BrowserRouter>
          </ApiErrorBoundary>
        </ThemeProvider>
      </QueryClientProvider>
    </React.StrictMode>,
  );

  if (USE_MOCKS) {
    // eslint-disable-next-line no-console
    console.info('[Skyline Hub] Running with the in-browser mock API (VITE_USE_MOCKS=true).');
  }
}

void bootstrap();
