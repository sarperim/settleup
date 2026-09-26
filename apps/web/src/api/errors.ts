/**
 * Error-contract parsing for the SPA fetch wrapper (TKT-foundation-005).
 *
 * The API's single error contract is the §4 envelope
 * `{ "error": { "code", "message", "details?" } }`
 * (03-api-design.md §4; arch 01-system-architecture.md §8.3). The
 * `ErrorCode` union and `ErrorEnvelopeDto` shape are the frozen shared
 * contract from TKT-foundation-003 — this module must not invent codes.
 */

import { ERROR_CODES, type ErrorCode, type ErrorDetails } from 'shared';

/** Runtime narrowing of the shared `ErrorCode` union (03 §4 table + §3b). */
export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && (ERROR_CODES as readonly string[]).includes(value);
}

/** A parsed, well-formed §4 error envelope. */
export interface ParsedErrorEnvelope {
  code: ErrorCode;
  message: string;
  details?: ErrorDetails;
}

/**
 * Parse an unknown response body as the §4 error envelope. Returns `null`
 * when the body is not a well-formed envelope (missing `error`, unknown
 * `code`, non-string `message`, wrong shapes) — the caller then falls back
 * to a generic `INTERNAL` error rather than surfacing an untrusted payload.
 */
export function parseErrorEnvelope(body: unknown): ParsedErrorEnvelope | null {
  if (typeof body !== 'object' || body === null || !('error' in body)) {
    return null;
  }
  const error = (body as { error: unknown }).error;
  if (typeof error !== 'object' || error === null) {
    return null;
  }
  const candidate = error as { code?: unknown; message?: unknown; details?: unknown };
  if (!isErrorCode(candidate.code)) {
    return null;
  }
  // `message` is a required string in the frozen ErrorEnvelopeDto — a
  // non-string message means the body is not the contract envelope.
  if (typeof candidate.message !== 'string') {
    return null;
  }
  const parsed: ParsedErrorEnvelope = {
    code: candidate.code,
    message: candidate.message,
  };
  // `details` is an optional record; anything that is not a plain object
  // (strings, numbers, arrays) is treated as absent, never surfaced.
  if (
    typeof candidate.details === 'object' &&
    candidate.details !== null &&
    !Array.isArray(candidate.details)
  ) {
    parsed.details = candidate.details as ErrorDetails;
  }
  return parsed;
}

/**
 * Typed error thrown by the fetch wrapper. `code` is a member of the shared
 * `ErrorCode` union (or the wrapper's own `INTERNAL` fallback for a
 * non-envelope failure) so callers can branch on the API contract, not on
 * ad-hoc strings.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details?: ErrorDetails;

  constructor(status: number, code: ErrorCode, message: string, details?: ErrorDetails) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    if (details !== undefined) {
      this.details = details;
    }
  }
}
