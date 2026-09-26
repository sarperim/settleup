/**
 * CSRF middleware (TKT-foundation-004; 01-system-architecture.md §8.2,
 * 03-api-design.md §1).
 *
 * Every state-changing request (POST/PATCH/DELETE) must carry
 * `X-Requested-With: XMLHttpRequest` — the SPA's fetch wrapper always does, and
 * a browser cannot attach a custom header cross-site without a preflight. A
 * missing header is rejected with `403 CSRF_HEADER_MISSING` **before** any
 * handler runs (including register/login).
 */
import type { NextFunction, Request, Response } from 'express';
import { DEFAULT_MESSAGES, errorEnvelope } from '../errors/error-contract';

const STATE_CHANGING_METHODS = new Set(['POST', 'PATCH', 'DELETE']);
const REQUIRED_HEADER = 'x-requested-with';
const REQUIRED_VALUE = 'XMLHttpRequest';

export function createCsrfMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!STATE_CHANGING_METHODS.has(req.method)) {
      next();
      return;
    }

    if (req.get(REQUIRED_HEADER) === REQUIRED_VALUE) {
      next();
      return;
    }

    res
      .status(403)
      .json(
        errorEnvelope(
          'CSRF_HEADER_MISSING',
          DEFAULT_MESSAGES.CSRF_HEADER_MISSING,
        ),
      );
  };
}
