/**
 * Session cookie helpers (TKT-accounts-001; 01-system-architecture.md §4
 * auth-cookie row, §8.2).
 *
 * `settleup_session` is HttpOnly, Secure (per `COOKIE_SECURE`), SameSite=Lax,
 * path `/`, with the 30-day sliding lifetime carried as `maxAge`.
 */
import type { CookieOptions, Request, Response } from 'express';
import { SESSION_COOKIE_NAME, SESSION_TTL_MS } from './auth.constants';

export function sessionCookieOptions(secure: boolean): CookieOptions {
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS,
  };
}

/**
 * Read the raw `settleup_session` token from a request's cookies, or
 * `undefined` when absent/not a non-empty string. Shared by the global
 * `AuthGuard` (validation) and the logout handler (revocation) so both agree on
 * exactly which cookie value addresses the session.
 */
export function readSessionToken(request: Request): string | undefined {
  const raw = (request as { cookies?: Record<string, unknown> }).cookies?.[
    SESSION_COOKIE_NAME
  ];
  return typeof raw === 'string' && raw.length > 0 ? raw : undefined;
}

/** Set the session cookie on a response (`secure` from validated config). */
export function setSessionCookie(
  response: Response,
  token: string,
  secure: boolean,
): void {
  response.cookie(SESSION_COOKIE_NAME, token, sessionCookieOptions(secure));
}
