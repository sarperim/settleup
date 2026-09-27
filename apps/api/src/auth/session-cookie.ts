/**
 * Session cookie helpers (TKT-accounts-001; 01-system-architecture.md §4
 * auth-cookie row, §8.2).
 *
 * `settleup_session` is HttpOnly, Secure (per `COOKIE_SECURE`), SameSite=Lax,
 * path `/`, with the 30-day sliding lifetime carried as `maxAge`.
 */
import type { CookieOptions, Response } from 'express';
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

/** Set the session cookie on a response (`secure` from validated config). */
export function setSessionCookie(
  response: Response,
  token: string,
  secure: boolean,
): void {
  response.cookie(SESSION_COOKIE_NAME, token, sessionCookieOptions(secure));
}
