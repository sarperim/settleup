/**
 * Per-request context attached by the request-logging middleware
 * (TKT-foundation-004).
 */
import type { Request } from 'express';

export interface AuthenticatedUserRef {
  readonly id?: string;
}

export interface RequestContext {
  /** Request id generated per request (never reused). */
  id: string;
  /**
   * Acting user, filled by the AuthGuard (C2, a later ticket). Declared now so
   * the logging middleware's `userId` slot is stable.
   */
  user?: AuthenticatedUserRef;
}

export type RequestWithContext = Request & Partial<RequestContext> & {
  user?: AuthenticatedUserRef;
};
