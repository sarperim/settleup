/**
 * Auth module constants (TKT-accounts-001; 01-system-architecture.md §4
 * auth-cookie row, §8.1 session lifecycle).
 */

/** The session cookie name (arch. §4: `settleup_session`). */
export const SESSION_COOKIE_NAME = 'settleup_session';

/** Sliding session lifetime: 30 days (arch. §4/§8.1). */
export const SESSION_TTL_DAYS = 30;

/** Sliding session lifetime in milliseconds (cookie `maxAge`). */
export const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

/** Key under which `@Public()` marks a route as unauthenticated. */
export const IS_PUBLIC_KEY = 'auth:isPublic';
