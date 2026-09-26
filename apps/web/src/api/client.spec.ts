/**
 * Fetch-wrapper behavior (TKT-foundation-005; arch 01 §8.2).
 *
 * These mechanism specs demonstrate the wrapper's contract with an injected
 * `fetch`: same-origin `/api` URLs, JSON bodies, the CSRF header on every
 * mutation, cookie credentials, §4 envelope parsing into a typed error, and
 * the `401 UNAUTHENTICATED` → `/login` hook. Full behavioral verification on
 * real routes arrives with the domain e2e TCs (TC-ACC-025, TC-EXP-028).
 */

import { describe, expect, it, vi } from 'vitest';

import { ApiError } from './errors';
import {
  API_BASE_PATH,
  CSRF_HEADER,
  CSRF_HEADER_VALUE,
  createApiClient,
  type ApiClient,
  type HttpMethod,
} from './client';

interface CapturedCall {
  url: string;
  init: RequestInit;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function makeClient(responses: Response[]): {
  client: ApiClient;
  calls: CapturedCall[];
  onUnauthenticated: ReturnType<typeof vi.fn>;
} {
  const calls: CapturedCall[] = [];
  let index = 0;
  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    const response = responses[index];
    index += 1;
    if (!response) {
      throw new Error('unexpected fetch call');
    }
    return response;
  }) as unknown as typeof fetch;
  const onUnauthenticated = vi.fn();
  const client = createApiClient({ fetchImpl, onUnauthenticated });
  return { client, calls, onUnauthenticated };
}

describe('createApiClient — request shaping', () => {
  it('GETs under the same-origin /api base path with cookie credentials', async () => {
    const { client, calls } = makeClient([jsonResponse(200, { groups: [] })]);

    await expect(client.get('/groups')).resolves.toEqual({ groups: [] });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(`${API_BASE_PATH}/groups`);
    expect(calls[0]!.url.startsWith('/')).toBe(true);
    expect(calls[0]!.init.credentials).toBe('include');
    expect(calls[0]!.init.method).toBe('GET');
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers[CSRF_HEADER]).toBeUndefined();
    expect(calls[0]!.init.body).toBeUndefined();
  });

  it.each<HttpMethod>(['POST', 'PATCH', 'DELETE'])(
    'sets X-Requested-With on %s (mutating) requests',
    async (method) => {
      const { client, calls } = makeClient([new Response(null, { status: 204 })]);

      await client.request('/groups/1', {
        method,
        body: method === 'DELETE' ? undefined : { a: 1 },
      });

      const headers = calls[0]!.init.headers as Record<string, string>;
      expect(calls[0]!.init.method).toBe(method);
      expect(headers[CSRF_HEADER]).toBe(CSRF_HEADER_VALUE);
    },
  );

  it('serializes an object body as JSON with the JSON content type', async () => {
    const { client, calls } = makeClient([jsonResponse(201, { group: { id: 'g1' } })]);

    await client.post('/groups', { name: 'Trip', nested: { n: 1 } });

    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers['Content-Type']).toContain('application/json');
    expect(headers[CSRF_HEADER]).toBe(CSRF_HEADER_VALUE);
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ name: 'Trip', nested: { n: 1 } });
  });

  it('returns the parsed JSON body on success', async () => {
    const { client } = makeClient([jsonResponse(200, { user: { id: 'u1' } })]);
    await expect(client.get('/auth/me')).resolves.toEqual({ user: { id: 'u1' } });
  });

  it('resolves to undefined for 204 No Content', async () => {
    const { client } = makeClient([new Response(null, { status: 204 })]);
    await expect(client.del('/auth/logout')).resolves.toBeUndefined();
  });

  it('rejects a non-site-relative path before touching fetch', async () => {
    const { client, calls } = makeClient([]);
    await expect(client.get('https://evil.example/x')).rejects.toBeInstanceOf(TypeError);
    await expect(client.get('//evil.example/x')).rejects.toBeInstanceOf(TypeError);
    expect(calls).toHaveLength(0);
  });
});

describe('createApiClient — §4 error envelope', () => {
  it('parses a representative 409 EMAIL_TAKEN envelope into a typed error', async () => {
    const { client, onUnauthenticated } = makeClient([
      jsonResponse(409, {
        error: { code: 'EMAIL_TAKEN', message: 'taken', details: { field: 'email' } },
      }),
    ]);

    const error = await client.post('/auth/register', {}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(409);
    expect((error as ApiError).code).toBe('EMAIL_TAKEN');
    expect((error as ApiError).message).toBe('taken');
    expect((error as ApiError).details).toEqual({ field: 'email' });
    expect(onUnauthenticated).not.toHaveBeenCalled();
  });

  it('parses a representative 404 NOT_FOUND envelope into a typed error', async () => {
    const { client } = makeClient([
      jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'Not found.' } }),
    ]);

    const error = await client.get('/groups/missing/expenses').catch((e: unknown) => e);
    expect((error as ApiError).code).toBe('NOT_FOUND');
    expect((error as ApiError).status).toBe(404);
  });

  it('falls back to a typed INTERNAL error for a non-envelope failure', async () => {
    const { client } = makeClient([new Response('<html>boom</html>', { status: 500 })]);

    const error = await client.get('/groups').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(500);
    expect((error as ApiError).code).toBe('INTERNAL');
  });
});

describe('createApiClient — 401 handling', () => {
  it('invokes onUnauthenticated and throws UNAUTHENTICATED on a 401 envelope', async () => {
    const { client, onUnauthenticated } = makeClient([
      jsonResponse(401, { error: { code: 'UNAUTHENTICATED', message: 'No session.' } }),
    ]);

    const error = await client.get('/groups').catch((e: unknown) => e);
    expect((error as ApiError).code).toBe('UNAUTHENTICATED');
    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
  });

  it('does NOT redirect on a login failure (401 INVALID_CREDENTIALS)', async () => {
    const { client, onUnauthenticated } = makeClient([
      jsonResponse(401, { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials.' } }),
    ]);

    const error = await client.post('/auth/login', {}).catch((e: unknown) => e);
    expect((error as ApiError).code).toBe('INVALID_CREDENTIALS');
    expect(onUnauthenticated).not.toHaveBeenCalled();
  });
});
