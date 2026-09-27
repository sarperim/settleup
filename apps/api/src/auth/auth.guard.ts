/**
 * Global authentication guard (TKT-accounts-001; FR-ACC-009,
 * 01-system-architecture.md §8.1 layer 1).
 *
 * Registered as an `APP_GUARD` so it protects the entire API. Exactly the
 * routes marked `@Public()` (register, login) are exempt; every other request
 * must carry a valid `settleup_session` cookie. On success the acting-user
 * reference is attached to the request context (`request.user`), which later
 * guards (e.g. C3's `GroupMemberGuard`) consume.
 *
 * Anonymous/invalid/expired → `401 UNAUTHENTICATED` in the §4 envelope.
 */
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppError } from '../common/errors/app-error';
import { DEFAULT_MESSAGES } from '../common/errors/error-contract';
import type { RequestWithContext } from '../common/http/request-context';
import { IS_PUBLIC_KEY, SESSION_COOKIE_NAME } from './auth.constants';
import { SessionService } from './session.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithContext>();
    const token = readSessionToken(request);
    if (token === undefined) {
      throw unauthenticated();
    }

    const session = await this.sessions.resolve(token);
    if (session === null) {
      throw unauthenticated();
    }

    request.user = { id: session.userId };
    return true;
  }
}

function readSessionToken(request: RequestWithContext): string | undefined {
  const raw = (request as { cookies?: Record<string, unknown> }).cookies?.[
    SESSION_COOKIE_NAME
  ];
  return typeof raw === 'string' && raw.length > 0 ? raw : undefined;
}

function unauthenticated(): AppError {
  return new AppError(401, 'UNAUTHENTICATED', DEFAULT_MESSAGES.UNAUTHENTICATED);
}
