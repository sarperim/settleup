/**
 * Error contract primitives (TKT-foundation-004; 03-api-design.md §4).
 *
 * Every error response of the API is exactly
 * `{ "error": { "code", "message", "details?" } }`. The `code` vocabulary below
 * mirrors `packages/shared/src/errors.ts#ERROR_CODES` (the frozen contract the
 * SPA and the domain DTOs share).
 *
 * FLAG (TKT-foundation-004): the union is intentionally duplicated here rather
 * than imported from the `shared` workspace package. At the f-001 baseline the
 * `shared` package only exposes its compiled `dist/` (main/types), and neither
 * `pnpm typecheck` nor the Vitest run happen after `pnpm build` — so importing
 * `shared` from `apps/api/src` fails both the typecheck step and the test step
 * with `TS2307`/module-not-found until the pipeline builds `shared` first. The
 * duplication is flagged for the architect/planner (build-before-check
 * ordering); the runtime values are the contract and are asserted by tests.
 */

/** Optional, machine-readable error details (03 §4). */
export type ErrorDetails = Record<string, unknown>;

/** The complete 03-api-design.md §4 code table plus §3b's `LIST_TOO_LARGE`. */
export const API_ERROR_CODES = [
  'VALIDATION_FAILED',
  'INVALID_CURRENT_PASSWORD',
  'SPLIT_SUM_MISMATCH',
  'NO_PARTICIPANTS',
  'PARTICIPANT_NOT_MEMBER',
  'UNAUTHENTICATED',
  'INVALID_CREDENTIALS',
  'CSRF_HEADER_MISSING',
  'NOT_GROUP_CREATOR',
  'NOT_LOGGER',
  'NOT_PAYMENT_PARTY',
  'NOT_FOUND',
  'CODE_NOT_FOUND',
  'EMAIL_TAKEN',
  'ALREADY_MEMBER',
  'PENDING_REQUEST_EXISTS',
  'SUGGESTION_STALE',
  'ALREADY_UNDONE',
  'TOO_MANY_ATTEMPTS',
  'INTERNAL',
  'LIST_TOO_LARGE',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

/** The single error envelope every error response uses (03 §4). */
export interface ErrorEnvelope {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: ErrorDetails;
  };
}

/** Build the exact envelope; `details` is omitted when absent (03 §4). */
export function errorEnvelope(
  code: ApiErrorCode,
  message: string,
  details?: ErrorDetails,
): ErrorEnvelope {
  return details === undefined
    ? { error: { code, message } }
    : { error: { code, message, details } };
}

/** Generic, internals-free messages for mapped framework exceptions. */
export const DEFAULT_MESSAGES: Record<ApiErrorCode, string> = {
  VALIDATION_FAILED: 'Request validation failed.',
  INVALID_CURRENT_PASSWORD: 'The current password is incorrect.',
  SPLIT_SUM_MISMATCH: 'The exact split does not sum to the expense amount.',
  NO_PARTICIPANTS: 'At least one participant is required.',
  PARTICIPANT_NOT_MEMBER: 'A payer or participant is not a member of the group.',
  UNAUTHENTICATED: 'Authentication required.',
  INVALID_CREDENTIALS: 'Invalid email or password.',
  CSRF_HEADER_MISSING: 'Missing X-Requested-With header.',
  NOT_GROUP_CREATOR: 'Only the group creator may perform this action.',
  NOT_LOGGER: 'Only the expense logger may perform this action.',
  NOT_PAYMENT_PARTY: 'Only the payment payer or recipient may perform this action.',
  NOT_FOUND: 'Not found.',
  CODE_NOT_FOUND: 'No group matches this join code.',
  EMAIL_TAKEN: 'An account with this email already exists.',
  ALREADY_MEMBER: 'You are already a member of this group.',
  PENDING_REQUEST_EXISTS: 'A pending join request already exists.',
  SUGGESTION_STALE: 'The settlement suggestion is no longer current.',
  ALREADY_UNDONE: 'This settlement was already undone.',
  TOO_MANY_ATTEMPTS: 'Too many attempts. Try again later.',
  INTERNAL: 'An unexpected error occurred.',
  LIST_TOO_LARGE: 'The expense list is too large to return.',
};
