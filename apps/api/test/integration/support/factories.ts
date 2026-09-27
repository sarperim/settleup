/**
 * Integration test factories (TKT-accounts-001; 00-test-strategy.md §5).
 *
 * Write paths are exercised through the public API. `registerUser` is the
 * first factory and lands with the ticket that owns its route (Accounts &
 * Access).
 */
import type { Server } from 'node:http';
import { api, CSRF_HEADERS } from './app';

/** Fixed fixture identity password prefix (strategy §5). */
export const TEST_PASSWORD = 'password-1';

export interface RegisteredUser {
  readonly id: string;
  readonly email: string;
  /** The `settleup_session=<token>` pair, ready for a `Cookie` header. */
  readonly cookie: string;
}

/**
 * Drive `POST /api/auth/register` and return `{ id, email, cookie }`.
 *
 * The email returned is the normalized (lowercased) stored form, matching the
 * 02-data-model.md §4 write contract.
 */
export async function registerUser(
  server: Server,
  email: string,
  password: string,
  displayName: string,
): Promise<RegisteredUser> {
  const response = await api(server)
    .post('/api/auth/register')
    .set(CSRF_HEADERS)
    .send({ email, password, displayName });

  if (response.status !== 201) {
    throw new Error(
      `registerUser fixture failed: expected 201, got ${response.status} (${JSON.stringify(response.body)})`,
    );
  }

  return {
    id: (response.body as { user: { id: string } }).user.id,
    email: email.trim().toLowerCase(),
    cookie: sessionCookiePair(response.headers['set-cookie']),
  };
}

/**
 * Extract the `settleup_session=<token>` pair from a `Set-Cookie` header.
 * Throws when the cookie is absent so a fixture failure is loud.
 */
export function sessionCookiePair(
  setCookie: string | string[] | undefined,
): string {
  const header = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  if (header === undefined) {
    throw new Error('expected a settleup_session Set-Cookie header, found none');
  }
  const pair = header.split(';', 1)[0];
  if (pair === undefined || !pair.startsWith('settleup_session=')) {
    throw new Error(`unexpected session cookie header: ${header}`);
  }
  return pair;
}

/** Read a raw `Set-Cookie` header value for the given cookie name. */
export function findSetCookie(
  setCookie: string | string[] | undefined,
  name: string,
): string | undefined {
  const headers = Array.isArray(setCookie) ? setCookie : [setCookie];
  return headers.find(
    (header): header is string =>
      typeof header === 'string' && header.startsWith(`${name}=`),
  );
}
