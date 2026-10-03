/**
 * A real axios adapter that serves the mock database.
 *
 * Why an adapter and not MSW: adapters need no service worker, no extra bundle
 * route, and work identically inside sandboxed preview iframes. The UI code is
 * unaware it is talking to a mock — it just calls `api.get('/events')`.
 */
import { AxiosError, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { loadDb, resetDb, saveDb, type DbUser, type MockDb } from './db';
import { MockError } from './errors';
import { notFoundHandler, routes, type Ctx } from './handlers';
import type { Role } from '../types';

let db: MockDb = loadDb();

export function currentDb(): MockDb {
  return db;
}

export function resetMockData(): void {
  db = resetDb();
}

export function persist(): void {
  saveDb(db);
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Real requests take time; the mock pretends to. Set
 * `globalThis.__SKYLINE_MOCK_LATENCY__ = 0` (e.g. from a test) to make the API
 * respond on the next tick instead.
 */
const latency = (): number => {
  const override = (globalThis as { __SKYLINE_MOCK_LATENCY__?: number }).__SKYLINE_MOCK_LATENCY__;
  return typeof override === 'number' ? override : 120 + Math.random() * 230;
};

/* ------------------------------------------------------------------- tokens */

const b64url = (input: string): string =>
  btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const unb64url = (input: string): string => {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  return atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
};

interface TokenPayload {
  sub: string;
  role: Role;
  email: string;
  name: string;
  exp: number;
}

export function createToken(user: DbUser): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload: TokenPayload = {
    sub: String(user.id),
    role: user.role,
    email: user.email,
    name: user.name,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
  };
  const body = b64url(JSON.stringify(payload));
  const signature = b64url(`mock-signature-${user.id}-${payload.exp}`);
  return `${header}.${body}.${signature}`;
}

export function decodeToken(token: string): TokenPayload | null {
  try {
    const [, body] = token.split('.');
    if (!body) return null;
    const payload = JSON.parse(unb64url(body)) as TokenPayload;
    if (!payload.exp || payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function userFromHeaders(config: InternalAxiosRequestConfig): DbUser | null {
  const headers = config.headers as unknown as { Authorization?: string; get?: (k: string) => string | undefined };
  const raw =
    (typeof headers?.get === 'function' ? headers.get('Authorization') : undefined) ??
    headers?.Authorization ??
    (headers as Record<string, string | undefined>)?.['authorization'];
  if (!raw || typeof raw !== 'string') return null;
  const token = raw.replace(/^Bearer\s+/i, '').trim();
  const payload = decodeToken(token);
  if (!payload) return null;
  const user = db.users.find((u) => u.id === Number(payload.sub));
  return user ?? null;
}

/* -------------------------------------------------------------------- router */

function matchRoute(method: string, path: string): { route: (typeof routes)[number]; params: Record<string, string> } | null {
  for (const route of routes) {
    if (route.method !== method) continue;
    const routeParts = route.path.split('/').filter(Boolean);
    const pathParts = path.split('/').filter(Boolean);
    if (routeParts.length !== pathParts.length) continue;
    const params: Record<string, string> = {};
    let ok = true;
    for (let i = 0; i < routeParts.length; i++) {
      const rp = routeParts[i];
      const pp = pathParts[i];
      if (rp.startsWith(':')) params[rp.slice(1)] = decodeURIComponent(pp);
      else if (rp !== pp) {
        ok = false;
        break;
      }
    }
    if (ok) return { route, params };
  }
  return null;
}

function parseQuery(config: InternalAxiosRequestConfig, search: string): Record<string, string> {
  const query: Record<string, string> = {};
  new URLSearchParams(search).forEach((value, key) => {
    query[key] = value;
  });
  const params = (config.params ?? {}) as Record<string, unknown>;
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query[key] = String(value);
  });
  return query;
}

async function parseBody(config: InternalAxiosRequestConfig): Promise<{ body: Record<string, unknown>; files: Record<string, File> }> {
  const data = config.data as unknown;
  if (!data) return { body: {}, files: {} };
  if (typeof FormData !== 'undefined' && data instanceof FormData) {
    const body: Record<string, unknown> = {};
    const files: Record<string, File> = {};
    data.forEach((value, key) => {
      if (typeof File !== 'undefined' && value instanceof File) files[key] = value;
      else body[key] = value;
    });
    return { body, files };
  }
  if (typeof data === 'string') {
    try {
      return { body: JSON.parse(data) as Record<string, unknown>, files: {} };
    } catch {
      return { body: {}, files: {} };
    }
  }
  if (typeof data === 'object') return { body: data as Record<string, unknown>, files: {} };
  return { body: {}, files: {} };
}

const responseFor = <T>(
  config: InternalAxiosRequestConfig,
  status: number,
  data: T,
): AxiosResponse<T> => ({
  data,
  status,
  statusText: status === 200 ? 'OK' : status === 201 ? 'Created' : String(status),
  headers: { 'content-type': 'application/json' },
  config,
  request: {},
});

/** Set `globalThis.__MOCK_DEBUG__ = true` (or window.__MOCK_DEBUG__) to trace every mock request. */
const debug = (step: string, detail: string): void => {
  if ((globalThis as { __MOCK_DEBUG__?: boolean }).__MOCK_DEBUG__) console.log(`[mock] ${step} ${detail}`);
};

export const mockAdapter: AxiosAdapter = async (config) => {
  const method = (config.method ?? 'get').toUpperCase();
  const rawUrl = config.url ?? '';
  const [rawPath, search = ''] = rawUrl.split('?');
  const path = (rawPath.startsWith('/') ? rawPath : `/${rawPath}`).replace(/\/+$/, '') || '/';

  const delay = latency();
  debug('start', `${method} ${path} (+${Math.round(delay)}ms)`);
  if (delay > 0) await sleep(delay);
  debug('awake', `${method} ${path}`);

  const matched = matchRoute(method, path);
  if (!matched) {
    const detail = notFoundHandler(`${method} ${path}`).message;
    throw new AxiosError(detail, 'ERR_BAD_REQUEST', config, null, responseFor(config, 404, { detail }));
  }

  const user = userFromHeaders(config);
  debug('auth', `${method} ${path} user=${user ? user.email : 'guest'}`);

  try {
    const { route, params } = matched;
    if ((route.auth || route.roles) && !user) {
      throw new MockError(401, 'Not authenticated');
    }
    if (route.roles && user && !route.roles.includes(user.role)) {
      throw new MockError(403, `Not enough permissions — this area is for ${route.roles.join(', ')}`);
    }

    const { body, files } = await parseBody(config);
    const ctx: Ctx = {
      db,
      method,
      path,
      params,
      query: parseQuery(config, search),
      body,
      files,
      user,
    };

    let data = await route.handler(ctx);
    debug('handled', `${method} ${path}`);
    persist();

    // Auth endpoints also mint the bearer token the real backend would return.
    if (path === '/auth/login' || path === '/auth/signup') {
      const payload = data as { user: DbUser };
      data = { access_token: createToken(payload.user), token_type: 'bearer', user: payload.user };
    }

    const status = method === 'POST' && ['/events', '/products', '/announcements', '/fundraisers', '/expenses'].includes(path) ? 201 : 200;
    return responseFor(config, status, data);
  } catch (error) {
    if (error instanceof MockError) {
      throw new AxiosError(error.message, 'ERR_BAD_REQUEST', config, null, responseFor(config, error.status, { detail: error.message }));
    }
    if (error instanceof AxiosError) throw error;
    const message = error instanceof Error ? error.message : 'Unexpected mock error';
    throw new AxiosError(message, 'ERR_BAD_RESPONSE', config, null, responseFor(config, 500, { detail: message }));
  }
};
