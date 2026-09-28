/**
 * Groups controller (TKT-groups-001; 03-api-design.md §3 groups rows).
 *
 * `POST /api/groups` and `GET /api/groups` are account-scoped (no `:groupId`);
 * the group-scoped reads apply `GroupMemberGuard` (layer 2), which hides
 * non-members behind `404 NOT_FOUND` and attaches the caller's membership so
 * the detail handler can apply the creator-only join-code rule (FR-GRP-002).
 */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { RequestWithContext } from '../common/http/request-context';
import { AppError } from '../common/errors/app-error';
import { DEFAULT_MESSAGES } from '../common/errors/error-contract';
import type { GroupScopedRequest } from './group-request-context';
import { CreateGroupDto } from './dto/create-group.dto';
import { GroupsService, type GroupView } from './groups.service';
import {
  MembershipService,
  type MemberView,
} from './membership.service';
import {
  JoinRequestService,
  type JoinRequestView,
} from './join-request.service';
import { GroupMemberGuard } from './guards/group-member.guard';
import { GroupCreatorGuard } from './guards/group-creator.guard';

/** The acting user's id, or `UNAUTHENTICATED` if somehow absent. */
function requireUserId(request: RequestWithContext): string {
  const userId = request.user?.id;
  if (userId === undefined) {
    // Unreachable: the global AuthGuard rejects anonymous calls first.
    throw new AppError(
      401,
      'UNAUTHENTICATED',
      DEFAULT_MESSAGES.UNAUTHENTICATED,
    );
  }
  return userId;
}

@Controller('groups')
export class GroupsController {
  constructor(
    private readonly groups: GroupsService,
    private readonly memberships: MembershipService,
    private readonly joinRequests: JoinRequestService,
  ) {}

  /** Create a group; caller becomes creator + first member (FR-GRP-001/002). */
  @Post()
  @HttpCode(201)
  async create(
    @Body() dto: CreateGroupDto,
    @Req() request: RequestWithContext,
  ): Promise<{ group: GroupView }> {
    const userId = requireUserId(request);
    return { group: await this.groups.create(userId, dto.name) };
  }

  /** The caller's memberships overview (FR-GRP-009). */
  @Get()
  async list(
    @Req() request: RequestWithContext,
  ): Promise<{ groups: GroupView[] }> {
    const userId = requireUserId(request);
    return { groups: await this.groups.listForUser(userId) };
  }

  /** Group detail; `joinCode` present iff the caller is the creator. */
  @Get(':groupId')
  @UseGuards(GroupMemberGuard)
  async detail(
    @Param('groupId') groupId: string,
    @Req() request: GroupScopedRequest,
  ): Promise<{ group: GroupView }> {
    const includeJoinCode = request.groupMembership?.isCreator ?? false;
    return { group: await this.groups.getForMember(groupId, includeJoinCode) };
  }

  /** Member list — display names only (FR-GRP-010, FR-ACC-008). */
  @Get(':groupId/members')
  @UseGuards(GroupMemberGuard)
  async members(
    @Param('groupId') groupId: string,
  ): Promise<{ members: MemberView[] }> {
    return { members: await this.memberships.listMembers(groupId) };
  }

  /**
   * Pending join requests — **creator only** (FR-GRP-005). Layer 2 hides
   * non-members behind `404`; layer 3 then rejects members who are not the
   * creator with `403 NOT_GROUP_CREATOR` (03 §3, arch. §8.1 layer 3).
   */
  @Get(':groupId/join-requests')
  @UseGuards(GroupMemberGuard, GroupCreatorGuard)
  async listJoinRequests(
    @Param('groupId') groupId: string,
  ): Promise<{ requests: JoinRequestView[] }> {
    return { requests: await this.joinRequests.listPending(groupId) };
  }
}
