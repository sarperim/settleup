/**
 * Global exception filter — the single error contract (TKT-foundation-004;
 * 03-api-design.md §4, 01-system-architecture.md §8.3).
 *
 * Guarantees:
 *   - every error response is exactly `{ error: { code, message, details? } }`;
 *   - unmapped framework 404s (no route) are folded into `404 NOT_FOUND` — the
 *     response never leaks Nest's default `{ statusCode, message, error }`
 *     shape, a stack trace, or an internal identifier;
 *   - unexpected faults become `500 INTERNAL` with a generic message and are
 *     logged (with the request id) server-side.
 */
import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';
import type { Logger } from 'pino';
import { AppError } from '../errors/app-error';
import {
  DEFAULT_MESSAGES,
  errorEnvelope,
  type ApiErrorCode,
  type ErrorDetails,
} from '../errors/error-contract';
import type { RequestWithContext } from '../http/request-context';

interface ResolvedError {
  status: number;
  code: ApiErrorCode;
  message: string;
  details?: ErrorDetails;
  /** True for unexpected faults — logged with the request id. */
  internal: boolean;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<RequestWithContext>();

    const resolved = resolve(exception);

    if (resolved.internal) {
      this.logger.error(
        {
          err: exception,
          requestId: request.id,
          method: request.method,
          path: request.originalUrl ?? request.url,
        },
        'unhandled_exception',
      );
    }

    if (response.headersSent) {
      return;
    }

    response
      .status(resolved.status)
      .json(errorEnvelope(resolved.code, resolved.message, resolved.details));
  }
}

function resolve(exception: unknown): ResolvedError {
  if (exception instanceof AppError) {
    return {
      status: exception.status,
      code: exception.code,
      message: exception.message,
      details: exception.details,
      internal: exception.status >= HttpStatus.INTERNAL_SERVER_ERROR,
    };
  }

  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const mapped = mapStatus(status);
    return { ...mapped, status, internal: status >= HttpStatus.INTERNAL_SERVER_ERROR };
  }

  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    code: 'INTERNAL',
    message: DEFAULT_MESSAGES.INTERNAL,
    internal: true,
  };
}

/**
 * Map framework-generated statuses to §4 codes. Domain code always throws
 * `AppError` with an explicit code, so only Nest's own exceptions (unmatched
 * route → 404, malformed body → 400, …) land here.
 */
function mapStatus(status: number): {
  code: ApiErrorCode;
  message: string;
  details?: ErrorDetails;
} {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return {
        code: 'VALIDATION_FAILED',
        message: DEFAULT_MESSAGES.VALIDATION_FAILED,
      };
    case HttpStatus.UNAUTHORIZED:
      return {
        code: 'UNAUTHENTICATED',
        message: DEFAULT_MESSAGES.UNAUTHENTICATED,
      };
    case HttpStatus.NOT_FOUND:
      return { code: 'NOT_FOUND', message: DEFAULT_MESSAGES.NOT_FOUND };
    case HttpStatus.TOO_MANY_REQUESTS:
      return {
        code: 'TOO_MANY_ATTEMPTS',
        message: DEFAULT_MESSAGES.TOO_MANY_ATTEMPTS,
      };
    default:
      // No generic 403/409/422 codes exist in the frozen §4 vocabulary; all
      // such responses are raised as AppError. Fall back to the generic 500.
      return { code: 'INTERNAL', message: DEFAULT_MESSAGES.INTERNAL };
  }
}
