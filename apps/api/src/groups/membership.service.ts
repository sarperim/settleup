/**
 * Membership read API (TKT-groups-001; 01-system-architecture.md §3 rule 1,
 * 02-data-model.md §6 ownership matrix).
 *
 * C3 owns `memberships`/`groups`; this exported service is the read path
 * C4 Ledger and C5 Settlement consume for authorization and group resolution
 * (`isMember`, per-(groupId, userId) resolution), and the member-list read
 * model uses it for display-name-only rows (FR-GRP-010, FR-ACC-008 mechanism).
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../auth/users.service';

/** A resolved membership fact. */
export interface MembershipRecord {
  readonly groupId: string;
  readonly userId: string;
  readonly isCreator: boolean;
}

/** One member-list entry — display names only (FR-ACC-008). */
export interface MemberView {
  readonly id: string;
  readonly displayName: string;
  readonly isCreator: boolean;
  readonly joinedAt: string;
}

@Injectable()
export class MembershipService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  /**
   * Resolve the caller's membership in a group, or `null`. The exported
   * `(groupId, userId)` resolution C4/C5 build their authorization on.
   */
  async findMembership(
    groupId: string,
    userId: string,
  ): Promise<MembershipRecord | null> {
    const membership = await this.prisma.membership.findUnique({
      where: { groupId_userId: { groupId, userId } },
      select: { groupId: true, userId: true, isCreator: true },
    });
    return membership;
  }

  /** Whether `userId` is a member of `groupId` (one indexed lookup). */
  async isMember(groupId: string, userId: string): Promise<boolean> {
    const membership = await this.prisma.membership.findUnique({
      where: { groupId_userId: { groupId, userId } },
      select: { id: true },
    });
    return membership !== null;
  }

  /**
   * The group's member list — `{ id, displayName, isCreator, joinedAt }` per
   * member, display names resolved via the C2 `UsersService` and never emails
   * (FR-GRP-010, FR-ACC-008). Order is unspecified upstream; membership insert
   * order is stable and used here.
   */
  async listMembers(groupId: string): Promise<MemberView[]> {
    const memberships = await this.prisma.membership.findMany({
      where: { groupId },
      select: { userId: true, isCreator: true, joinedAt: true },
      orderBy: { joinedAt: 'asc' },
    });

    const refs = await this.users.getUserRefs(
      memberships.map((membership) => membership.userId),
    );

    return memberships.map((membership) => ({
      id: membership.userId,
      displayName: refs.get(membership.userId)?.displayName ?? '',
      isCreator: membership.isCreator,
      joinedAt: membership.joinedAt.toISOString(),
    }));
  }
}
