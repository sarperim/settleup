/**
 * `GroupMemberGuard` — C3's layer-2 authorization guard
 * (TKT-groups-001; FR-GRP-008, SC-006, NFR-GRP-001,
 * 01-system-architecture.md §8.1 layer 2, 03-api-design.md §1 existence hiding).
 *
 * Applied to every group-scoped route of C3/C4/C5. It resolves the caller's
 * membership for the route's `:groupId` and either attaches it to the request
 * (`request.groupMembership`) or rejects with `404 NOT_FOUND` — a non-member
 * cannot distinguish an existing group from a nonexistent one.
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
export class GroupMemberGuard implements CanActivate {
  constructor(private readonly memberships: MembershipService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<GroupScopedRequest>();
    const groupId = request.params?.groupId;
    const userId = request.user?.id;

    // A missing :groupId or acting user is unreachable on a correctly wired
    // route; fail closed with the same 404 so nothing is disclosed either way.
    if (typeof groupId !== 'string' || userId === undefined) {
      throw notFound();
    }

    const membership = await this.memberships.findMembership(groupId, userId);
    if (membership === null) {
      throw notFound();
    }

    request.groupMembership = membership;
    return true;
  }
}

function notFound(): AppError {
  return new AppError(404, 'NOT_FOUND', DEFAULT_MESSAGES.NOT_FOUND);
}
