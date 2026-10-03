import axios, { AxiosError, type AxiosInstance } from 'axios';
import type { ApiError } from './types';

/**
 * Reads Vite env vars defensively so the same module also loads under Node
 * (used by `npm run smoke`, which drives the mock API without a browser).
 */
const ENV: Record<string, string | undefined> =
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

export const API_BASE_URL: string = ENV.VITE_API_URL ?? 'http://localhost:8000/api';
export const USE_MOCKS: boolean = ENV.VITE_USE_MOCKS !== 'false';

export const TOKEN_KEY = 'skyline_token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable — session-only auth */
  }
}

/**
 * Normalises every failure into `{ detail, status }` so the UI can always show
 * `error.detail` in a toast, whether it came from the mock adapter or a real API.
 */
export function apiErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as Partial<ApiError> | undefined;
    if (data && typeof data.detail === 'string') return data.detail;
    if (error.code === 'ERR_NETWORK') {
      return `Can't reach the API at ${API_BASE_URL}. Start the backend or set VITE_USE_MOCKS=true in .env.`;
    }
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

export function apiStatusCode(error: unknown): number | undefined {
  return error instanceof AxiosError ? error.response?.status : undefined;
}

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
      setToken(null);
      try {
        localStorage.removeItem('skyline_user');
      } catch {
        /* noop */
      }
      const path = window.location.pathname;
      if (!path.startsWith('/login') && !path.startsWith('/signup') && !path.startsWith('/')) {
        window.location.assign('/login');
      } else if (path.startsWith('/app')) {
        window.location.assign('/login');
      }
    }
    return Promise.reject(error);
  },
);

export function setMockAdapter(adapter: AxiosInstance['defaults']['adapter']): void {
  api.defaults.adapter = adapter;
}

/** Generic typed helpers used by every domain module. */
export async function httpGet<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const { data } = await api.get<T>(url, { params });
  return data;
}

export async function httpPost<T>(url: string, body?: unknown): Promise<T> {
  const { data } = await api.post<T>(url, body);
  return data;
}

export async function httpPatch<T>(url: string, body?: unknown): Promise<T> {
  const { data } = await api.patch<T>(url, body);
  return data;
}

export async function httpDelete<T>(url: string): Promise<T> {
  const { data } = await api.delete<T>(url);
  return data;
}

export async function httpPostForm<T>(url: string, form: FormData): Promise<T> {
  const { data } = await api.post<T>(url, form, { headers: { 'Content-Type': 'multipart/form-data' } });
  return data;
}
