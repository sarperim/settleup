/**
 * The SPA's single fetch wrapper (TKT-foundation-005; arch
 * 01-system-architecture.md §8.2, 03-api-design.md §1).
 *
 * Rules encoded here:
 * - **Same-origin only**: every request resolves under the fixed `/api`
 *   base path — callers pass a path, never an absolute URL.
 * - **JSON bodies**: an object body is `JSON.stringify`-ed with the JSON
 *   content type.
 * - **CSRF**: every state-changing request (POST/PATCH/DELETE) carries
 *   `X-Requested-With: XMLHttpRequest`.
 * - **Cookies**: `credentials: 'include'` so the session cookie rides
 *   along.
 * - **Error contract**: non-2xx responses are parsed as the §4 envelope
 *   into a typed `ApiError`; `401 UNAUTHENTICATED` additionally triggers
 *   the unauthenticated handler (redirect to `/login`).
 */

import type { ErrorCode } from 'shared';
import { SPA_ROUTES } from '../routes';
import { ApiError, parseErrorEnvelope } from './errors';

/** HTTP methods the wrapper sends. */
export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

/** Methods that mutate server state and therefore need the CSRF header. */
const MUTATING_METHODS: ReadonlySet<HttpMethod> = new Set<HttpMethod>(['POST', 'PATCH', 'DELETE']);

/** The same-origin API base path (03-api-design.md header: base path `/api`). */
export const API_BASE_PATH = '/api';

/** CSRF header required on every state-changing request (arch §8.2). */
export const CSRF_HEADER = 'X-Requested-With';
export const CSRF_HEADER_VALUE = 'XMLHttpRequest';

export interface ApiRequestOptions {
  method?: HttpMethod;
  body?: unknown;
  signal?: AbortSignal;
}

export interface ApiClientOptions {
  /** Injectable fetch (tests); defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
  /** Invoked when the API answers `401 UNAUTHENTICATED` (default: go to `/login`). */
  onUnauthenticated?: () => void;
}

export interface ApiClient {
  request<T>(path: string, options?: ApiRequestOptions): Promise<T>;
  get<T>(path: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<T>;
  post<T>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<T>;
  patch<T>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<T>;
  del<T>(path: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<T>;
}

function defaultUnauthenticatedRedirect(): void {
  if (typeof window !== 'undefined' && typeof window.location?.assign === 'function') {
    window.location.assign(SPA_ROUTES.login);
  }
}

/**
 * Build the request URL under the same-origin base path. Rejects paths that
 * are not site-relative (`//host`, `http://…`) — the wrapper never talks to
 * a different origin (arch 01 §2 C1).
 */
function buildUrl(path: string): string {
  if (!path.startsWith('/') || path.startsWith('//')) {
    throw new TypeError(`API client path must be site-relative and start with "/" — got "${path}"`);
  }
  return `${API_BASE_PATH}${path}`;
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) {
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    // A non-JSON body is not the §4 envelope; the caller falls back to a
    // generic typed error rather than leaking the raw payload.
    return undefined;
  }
}

/**
 * Create an API client. Production uses the module-level `api` singleton
 * below; tests inject a fake `fetchImpl` and an `onUnauthenticated` spy.
 */
export function createApiClient(options: ApiClientOptions = {}): ApiClient {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const onUnauthenticated = options.onUnauthenticated ?? defaultUnauthenticatedRedirect;

  async function request<T>(path: string, requestOptions: ApiRequestOptions = {}): Promise<T> {
    const { method = 'GET', body, signal } = requestOptions;
    const url = buildUrl(path);

    const headers: Record<string, string> = { Accept: 'application/json' };
    let bodyInit: string | undefined;
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json; charset=utf-8';
      bodyInit = JSON.stringify(body);
    }
    if (MUTATING_METHODS.has(method)) {
      headers[CSRF_HEADER] = CSRF_HEADER_VALUE;
    }

    const response = await fetchImpl(url, {
      method,
      headers,
      credentials: 'include',
      body: bodyInit,
      signal,
    });

    if (response.status === 204) {
      return undefined as T;
    }

    const payload = await readBody(response);

    if (response.ok) {
      return payload as T;
    }

    const parsed = parseErrorEnvelope(payload);
    const code: ErrorCode = parsed?.code ?? 'INTERNAL';
    const message = parsed?.message ?? 'Unexpected error';

    // Only an explicit UNAUTHENTICATED envelope redirects. A login failure
    // is 401 INVALID_CREDENTIALS and must stay on the login page as a typed
    // error (03-api-design.md §2/§4).
    if (response.status === 401 && code === 'UNAUTHENTICATED') {
      onUnauthenticated();
    }

    throw new ApiError(response.status, code, message, parsed?.details);
  }

  return {
    request,
    get: <T>(path: string, opts?: Omit<ApiRequestOptions, 'method' | 'body'>) =>
      request<T>(path, { ...opts, method: 'GET' }),
    post: <T>(path: string, body?: unknown, opts?: Omit<ApiRequestOptions, 'method' | 'body'>) =>
      request<T>(path, { ...opts, method: 'POST', body }),
    patch: <T>(path: string, body?: unknown, opts?: Omit<ApiRequestOptions, 'method' | 'body'>) =>
      request<T>(path, { ...opts, method: 'PATCH', body }),
    del: <T>(path: string, opts?: Omit<ApiRequestOptions, 'method' | 'body'>) =>
      request<T>(path, { ...opts, method: 'DELETE' }),
  };
}

/** The application-wide client (same-origin `/api`, real fetch). */
export const api = createApiClient();
