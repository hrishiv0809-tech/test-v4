/**
 * Mock mode bootstrap.
 *
 * `installMockApi()` is awaited once in main.tsx before React renders, so every
 * request made by TanStack Query hits the in-memory database instead of the
 * network. Set VITE_USE_MOCKS=false in .env to talk to the real FastAPI backend
 * instead — no other code changes are required.
 */
import { api, setMockAdapter, USE_MOCKS } from '../client';

let installed = false;

export async function installMockApi(): Promise<void> {
  if (installed || !USE_MOCKS) return;
  const { mockAdapter } = await import('./adapter');
  setMockAdapter(mockAdapter);
  installed = true;
  // eslint-disable-next-line no-console
  console.info(
    '%c[Skyline Hub] Mock API is ON — demo data lives in localStorage. Set VITE_USE_MOCKS=false to use the FastAPI backend.',
    'color:#714B67;font-weight:bold',
  );
}

/** Wipes and reseeds the demo data (used by the "Reset demo data" menu item). */
export async function resetMockData(): Promise<void> {
  const { resetMockData: reset } = await import('./adapter');
  reset();
  api.defaults.adapter = (await import('./adapter')).mockAdapter;
}

export { USE_MOCKS };
