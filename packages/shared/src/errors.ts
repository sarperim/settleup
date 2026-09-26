/**
 * Error contract — Settle Up (TKT-foundation-003).
 *
 * Every error response of the API has exactly the envelope below
 * (03-api-design.md §4). `ERROR_CODES` is the runtime source the
 * `ErrorCode` union is derived from; it covers exactly the §4 table plus
 * `LIST_TOO_LARGE` (§3b — the defensive ledger-list cap) — no more, no
 * less. Codes are stable API surface and the acceptance-test vocabulary.
 */

/** Optional, machine-readable error details (03 §4: e.g. offending field names). */
export type ErrorDetails = Record<string, unknown>;

/**
 * The complete error-code set: the 03-api-design.md §4 table in table
 * order, plus `LIST_TOO_LARGE` from §3b.
 */
export const ERROR_CODES = [
  // 03-api-design.md §4 table:
  'VALIDATION_FAILED', // 400 — DTO validation (details lists offending fields)
  'INVALID_CURRENT_PASSWORD', // 400 — password change with wrong current password
  'SPLIT_SUM_MISMATCH', // 400 — exact split ≠ amount
  'NO_PARTICIPANTS', // 400 — empty participant list
  'PARTICIPANT_NOT_MEMBER', // 400 — payer/participant not in group
  'UNAUTHENTICATED', // 401 — no/invalid/expired session
  'INVALID_CREDENTIALS', // 401 — login failure (generic message)
  'CSRF_HEADER_MISSING', // 403 — missing X-Requested-With on state-changing call
  'NOT_GROUP_CREATOR', // 403 — join-request handling by non-creator
  'NOT_LOGGER', // 403 — expense edit/delete by non-logger
  'NOT_PAYMENT_PARTY', // 403 — mark-paid/undo by neither payer nor recipient
  'NOT_FOUND', // 404 — existence-hiding / missing resource
  'CODE_NOT_FOUND', // 404 — join code matches no group
  'EMAIL_TAKEN', // 409 — duplicate registration
  'ALREADY_MEMBER', // 409 — join request while a member
  'PENDING_REQUEST_EXISTS', // 409 — duplicate pending request
  'SUGGESTION_STALE', // 409 — mark-paid matches no current suggestion (§3.4)
  'ALREADY_UNDONE', // 409 — undo of an already-undone settlement
  'TOO_MANY_ATTEMPTS', // 429 — login throttled (§4 login-throttle note)
  'INTERNAL', // 500 — unexpected fault
  // 03-api-design.md §3b (not in the §4 table): the defensive list cap.
  'LIST_TOO_LARGE', // 500 — group ledger beyond 500 expenses
] as const;

/** Stable error-code union — exactly the members of `ERROR_CODES`. */
export type ErrorCode = (typeof ERROR_CODES)[number];

/**
 * The error envelope every error response uses (03-api-design.md §4):
 * `{ "error": { "code", "message", "details?" } }`. `message` is
 * human-readable and safe to show in the UI; `details` is optional and
 * machine-readable; no stack traces or internals.
 */
export interface ErrorEnvelopeDto {
  error: {
    code: ErrorCode;
    message: string;
    details?: ErrorDetails;
  };
}
