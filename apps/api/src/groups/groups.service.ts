/**
 * Groups service (TKT-groups-001; 03-api-design.md §3 groups rows,
 * 01-system-architecture.md §2 C3, 02-data-model.md §4/§5.1).
 *
 * Owns `groups`: creation (group + creator membership in one transaction,
 * BR-GRP-005), the caller's overview read (FR-GRP-009), group detail and the
 * join-code visibility rule (FR-GRP-002). Join-code generation is delegated to
 * the pure generator over the injected CSPRNG source (arch. §3 rule 3).
 */
import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService, type UserRef } from '../auth/users.service';
import { AppError } from '../common/errors/app-error';
import { DEFAULT_MESSAGES } from '../common/errors/error-contract';
import { generateJoinCode } from './join-code';
import { RANDOM_SOURCE, type RandomSource } from './random-source';

/** A group as returned by create/detail/overview (mirrors `GroupDto`). */
export interface GroupView {
  readonly id: string;
  readonly name: string;
  readonly creator: UserRef;
  readonly createdAt: string;
  /** Present iff the caller is the creator (FR-GRP-002). */
  readonly joinCode?: string;
}

/** Persisted group columns the read models need. */
interface GroupRow {
  readonly id: string;
  readonly name: string;
  readonly creatorId: string;
  readonly joinCode: string;
  readonly createdAt: Date;
}

/** Join-code collision retries before surfacing `500 INTERNAL`. */
const MAX_JOIN_CODE_ATTEMPTS = 5;

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    @Inject(RANDOM_SOURCE) private readonly random: RandomSource,
  ) {}

  /**
   * Create a group, its join code and the creator's membership atomically
   * (FR-GRP-001/002, BR-GRP-001/005). A join-code collision (unique index) is
   * retried with a fresh draw; the group row and creator membership always land
   * together (one transaction).
   */
  async create(creatorId: string, name: string): Promise<GroupView> {
    const creator = await this.users.getUserRef(creatorId);
    if (creator === null) {
      // Defensive: the guard resolved a live session for this user.
      throw new AppError(
        401,
        'UNAUTHENTICATED',
        DEFAULT_MESSAGES.UNAUTHENTICATED,
      );
    }

    for (let attempt = 0; attempt < MAX_JOIN_CODE_ATTEMPTS; attempt += 1) {
      const joinCode = generateJoinCode(this.random);
      try {
        const group = await this.prisma.$transaction(async (tx) => {
          const created = await tx.group.create({
            data: { name, joinCode, creatorId },
            select: {
              id: true,
              name: true,
              creatorId: true,
              joinCode: true,
              createdAt: true,
            },
          });
          await tx.membership.create({
            data: { groupId: created.id, userId: creatorId, isCreator: true },
          });
          return created;
        });
        return toGroupView(group, creator, true);
      } catch (error: unknown) {
        if (isUniqueConstraintViolation(error)) {
          continue;
        }
        throw error;
      }
    }

    throw new AppError(500, 'INTERNAL', DEFAULT_MESSAGES.INTERNAL);
  }

  /**
   * The caller's memberships overview (FR-GRP-009): exactly the groups the
   * caller belongs to, each with its name. The creator's own groups carry their
   * join code; every other membership does not (FR-GRP-002).
   */
  async listForUser(userId: string): Promise<GroupView[]> {
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      select: {
        isCreator: true,
        group: {
          select: {
            id: true,
            name: true,
            creatorId: true,
            joinCode: true,
            createdAt: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    const creatorRefs = await this.users.getUserRefs(
      memberships.map((membership) => membership.group.creatorId),
    );

    return memberships.map((membership) =>
      toGroupView(
        membership.group,
        creatorRefs.get(membership.group.creatorId) ?? {
          id: membership.group.creatorId,
          displayName: '',
        },
        membership.isCreator,
      ),
    );
  }

  /**
   * Group detail for a member (the guard has already verified membership and
   * attached `isCreator`). The join code is included iff the caller is the
   * creator (FR-GRP-002).
   */
  async getForMember(
    groupId: string,
    includeJoinCode: boolean,
  ): Promise<GroupView> {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        name: true,
        creatorId: true,
        joinCode: true,
        createdAt: true,
      },
    });

    if (group === null) {
      // Unreachable: a membership row implies its group (FK).
      throw new AppError(404, 'NOT_FOUND', DEFAULT_MESSAGES.NOT_FOUND);
    }

    const creator = await this.users.getUserRef(group.creatorId);
    return toGroupView(
      group,
      creator ?? { id: group.creatorId, displayName: '' },
      includeJoinCode,
    );
  }
}

/** Project a persisted group to its API shape, optionally including the code. */
function toGroupView(
  group: GroupRow,
  creator: UserRef,
  includeJoinCode: boolean,
): GroupView {
  const view: GroupView = {
    id: group.id,
    name: group.name,
    creator,
    createdAt: group.createdAt.toISOString(),
  };
  return includeJoinCode ? { ...view, joinCode: group.joinCode } : view;
}
