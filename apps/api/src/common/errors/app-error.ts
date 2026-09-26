/**
 * `AppError` — the API's explicit, contract-carrying error (TKT-foundation-004).
 *
 * Domain code (C2–C5) throws `AppError` when it wants a specific 03 §4 code;
 * the global exception filter maps framework exceptions to generic codes and
 * passes `AppError` through untouched.
 */
import type { ApiErrorCode, ErrorDetails } from './error-contract';

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode,
    message: string,
    public readonly details?: ErrorDetails,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
