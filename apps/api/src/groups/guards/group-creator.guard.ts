/**
 * `GroupCreatorGuard` — C3's layer-3 role guard
 * (TKT-groups-001; 01-system-architecture.md §8.1 layer 3,
 * 03-api-design.md §3 `403 NOT_GROUP_CREATOR`).
 *
 * Runs after `GroupMemberGuard` on routes only the group's creator may use.
 * Non-members are still `404 NOT_FOUND` (existence hiding) — so the guard
 * resolves membership itself when the member guard has not already run, rather
 * than assuming request state. Members who are not the creator get
 * `403 NOT_GROUP_CREATOR`.
 */
import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { AppError } from '../../common/errors/app-error';
import { DEFAULT_MESSAGES } from '../../common/errors/error-contract';
import type { GroupScopedRequest } from '../group-request-context';
import { MembershipService } from '../membership.service';

@Injectable()
export class GroupCreatorGuard implements CanActivate {
  constructor(private readonly memberships: MembershipService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<GroupScopedRequest>();
    const groupId = request.params?.groupId;
    const userId = request.user?.id;

    if (typeof groupId !== 'string' || userId === undefined) {
      throw notFound();
    }

    const membership =
      request.groupMembership ??
      (await this.memberships.findMembership(groupId, userId));

    if (membership === null) {
      throw notFound();
    }

    request.groupMembership = membership;

    if (!membership.isCreator) {
      throw new AppError(
        403,
        'NOT_GROUP_CREATOR',
        DEFAULT_MESSAGES.NOT_GROUP_CREATOR,
      );
    }

    return true;
  }
}

function notFound(): AppError {
  return new AppError(404, 'NOT_FOUND', DEFAULT_MESSAGES.NOT_FOUND);
}
