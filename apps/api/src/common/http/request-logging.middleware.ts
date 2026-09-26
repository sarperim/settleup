/**
 * Request logging middleware (TKT-foundation-004; 01-system-architecture.md
 * §8.4).
 *
 * Exactly one JSON line per request, emitted on response finish:
 * `{ method, path, status, durationMs, requestId, userId }`. A fresh
 * `requestId` is generated per request (and echoed as `X-Request-Id`); the
 * `userId` slot is `null` until the AuthGuard (C2) populates `req.user`.
 *
 * Never logs request bodies, cookies, emails, session tokens or passwords —
 * only method/path/status/duration and identifiers. The logged `path`
 * excludes the query string (a query param may carry a secret, e.g. a join
 * code — NFR-GRP-005).
 */
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { Logger } from 'pino';
import type { RequestWithContext } from './request-context';

export function createRequestLoggingMiddleware(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const context = req as RequestWithContext;
    const requestId = randomUUID();
    context.id = requestId;
    res.setHeader('X-Request-Id', requestId);

    const startedAt = process.hrtime.bigint();

    res.on('finish', () => {
      const durationMs =
        Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      logger.info(
        {
          method: req.method,
          path: req.path,
          status: res.statusCode,
          durationMs,
          requestId,
          userId: context.user?.id ?? null,
        },
        'request',
      );
    });

    next();
  };
}
