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

/**
 * Login-throttle threshold (arch. §8.2, NFR-ACC-001): the pair is blocked on
 * the 11th and subsequent attempts once this many counted failures accumulate.
 */
export const LOGIN_THROTTLE_MAX_FAILURES = 10;

/** Login-throttle fixed window, anchored at the first counted failure. */
export const LOGIN_THROTTLE_WINDOW_MS = 15 * 60 * 1000;
