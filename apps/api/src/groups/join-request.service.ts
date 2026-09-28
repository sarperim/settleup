/**
 * Join-request service (TKT-groups-002; 03-api-design.md §3 join-info +
 * join-requests rows, §4; 02-data-model.md §4 JoinRequest, §5.3;
 * 01-system-architecture.md §2 C3, §6 FR-GRP-003/004/012/013).
 *
 * Owns the join-by-code flow: resolving a code to its group (`GET
 * /api/join-info` — the code holder learns the group's name and nothing else)
 * and placing a pending request (`POST /api/join-requests`). The code **is the
 * group selector**, so resolution precedes every requester-relation check: an
 * unknown code yields `404 CODE_NOT_FOUND` for every requester class
 * (TC-GRP-010). Relation checks follow the 02 §5.3 state machine — an existing
 * member (`409 ALREADY_MEMBER`, FR-GRP-013), a pending duplicate
 * (`409 PENDING_REQUEST_EXISTS`, FR-GRP-012), otherwise a `PENDING` row,
 * flipping an existing `REJECTED` row back to `PENDING` with `decidedAt`
 * cleared (BR-GRP-010 re-request semantics).
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService, type UserRef } from '../auth/users.service';
import { AppError } from '../common/errors/app-error';
import { DEFAULT_MESSAGES } from '../common/errors/error-contract';
import { MembershipService } from './membership.service';

/** `GET /api/join-info` success body — exactly `{ groupId, groupName }`. */
export interface JoinInfoView {
  readonly groupId: string;
  readonly groupName: string;
}

/** Join-request status — the 02-data-model.md §5.3 state machine. */
export type JoinRequestStatusValue = 'PENDING' | 'APPROVED' | 'REJECTED';

/** A join request as returned by `POST /api/join-requests` (03 §3). */
export interface JoinRequestView {
  readonly id: string;
  readonly groupId: string;
  /** The requester, display name only (FR-ACC-008). */
  readonly requester: UserRef;
  readonly status: JoinRequestStatusValue;
  readonly createdAt: string;
  /** Set on approve/reject; absent while PENDING (cleared on re-request). */
  readonly decidedAt?: string;
}

/** Persisted join-request columns the read model projects. */
interface JoinRequestRow {
  readonly id: string;
  readonly groupId: string;
  readonly status: JoinRequestStatusValue;
  readonly createdAt: Date;
  readonly decidedAt: Date | null;
}

const JOIN_REQUEST_SELECT = {
  id: true,
  groupId: true,
  status: true,
  createdAt: true,
  decidedAt: true,
} as const;

/** Join-request columns plus the requester id (for display-name resolution). */
const JOIN_REQUEST_WITH_USER_SELECT = {
  ...JOIN_REQUEST_SELECT,
  userId: true,
} as const;

/** The minimal group fact a code resolves to. */
interface ResolvedGroup {
  readonly id: string;
  readonly name: string;
}

@Injectable()
export class JoinRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly memberships: MembershipService,
  ) {}

  /**
   * Resolve a join code to `{ groupId, groupName }` — nothing else
   * (FR-GRP-004, TC-GRP-007). Unknown, wrong-length, or wrong-alphabet codes
   * are indistinguishable: all yield `404 CODE_NOT_FOUND` (TC-GRP-008).
   */
  async resolveJoinInfo(code: string): Promise<JoinInfoView> {
    const group = await this.findGroupByCode(code);
    if (group === null) {
      throw codeNotFound();
    }
    return { groupId: group.id, groupName: group.name };
  }

  /**
   * Place a join request for `requesterId` against the group its `code`
   * selects (FR-GRP-003). Code resolution precedes the relation checks:
   * member → `409 ALREADY_MEMBER` (FR-GRP-013); pending duplicate →
   * `409 PENDING_REQUEST_EXISTS` (FR-GRP-012); otherwise the `(groupId,userId)`
   * row becomes `PENDING` (created, or flipped from `REJECTED` with `decidedAt`
   * cleared — BR-GRP-010).
   */
  async place(requesterId: string, code: string): Promise<JoinRequestView> {
    const group = await this.findGroupByCode(code);
    if (group === null) {
      throw codeNotFound();
    }

    // FR-GRP-013: a creator-self or approved member can never place a request.
    if (await this.memberships.isMember(group.id, requesterId)) {
      throw new AppError(
        409,
        'ALREADY_MEMBER',
        DEFAULT_MESSAGES.ALREADY_MEMBER,
      );
    }

    const existing = await this.prisma.joinRequest.findUnique({
      where: { groupId_userId: { groupId: group.id, userId: requesterId } },
      select: { id: true, status: true },
    });

    // FR-GRP-012: one row per (groupId,userId) — a live pending duplicate.
    if (existing !== null && existing.status === 'PENDING') {
      throw new AppError(
        409,
        'PENDING_REQUEST_EXISTS',
        DEFAULT_MESSAGES.PENDING_REQUEST_EXISTS,
      );
    }

    const row =
      existing === null
        ? await this.prisma.joinRequest.create({
            data: { groupId: group.id, userId: requesterId },
            select: JOIN_REQUEST_SELECT,
          })
        : await this.prisma.joinRequest.update({
            where: { id: existing.id },
            data: { status: 'PENDING', decidedAt: null },
            select: JOIN_REQUEST_SELECT,
          });

    const requester = await this.users.getUserRef(requesterId);
    return toJoinRequestView(
      row,
      requester ?? { id: requesterId, displayName: '' },
    );
  }

  /**
   * The group's **pending** join requests — the creator's handling list
   * (FR-GRP-005, 03 §3). Pending-only by contract; each entry exposes the
   * requester by display name (FR-ACC-008). Caller authorization (creator-only)
   * is the route guard's job; this is a pure read model.
   */
  async listPending(groupId: string): Promise<JoinRequestView[]> {
    const rows = await this.prisma.joinRequest.findMany({
      where: { groupId, status: 'PENDING' },
      select: JOIN_REQUEST_WITH_USER_SELECT,
      orderBy: { createdAt: 'asc' },
    });

    const refs = await this.users.getUserRefs(rows.map((row) => row.userId));
    return rows.map((row) =>
      toJoinRequestView(
        row,
        refs.get(row.userId) ?? { id: row.userId, displayName: '' },
      ),
    );
  }

  /**
   * Approve or reject the pending request addressed by `requestId`
   * (FR-GRP-006/007, 03 §3 "Approve/reject semantics"). These routes carry no
   * `:groupId`, so the handler applies the guard pattern itself — resolve the
   * request, then its group, then the caller's membership — in the fixed order
   * the contract pins (first match wins):
   *
   *   1. no row for `requestId`            → `404 NOT_FOUND`
   *   2. caller not a member of its group  → `404 NOT_FOUND` (existence hiding)
   *   3. member but not the creator        → `403 NOT_GROUP_CREATOR`
   *   4. request status ≠ PENDING          → `404 NOT_FOUND`
   *
   * Authorization (2–3) precedes request-state (4), mirroring guard-before-
   * handler layering: a member non-creator on an already-decided request gets
   * `403`, not `404`. Approving also establishes membership (BR-GRP-004) in the
   * same transaction that closes the request; rejecting closes it without
   * membership, leaving the `(groupId, userId)` row reusable for a re-request
   * (BR-GRP-010, 02 §5.3).
   */
  async decide(
    requestId: string,
    callerId: string,
    decision: 'APPROVED' | 'REJECTED',
  ): Promise<JoinRequestView> {
    const request = await this.prisma.joinRequest.findUnique({
      where: { id: requestId },
      select: { id: true, groupId: true, userId: true, status: true },
    });
    if (request === null) {
      throw notFound();
    }

    const membership = await this.memberships.findMembership(
      request.groupId,
      callerId,
    );
    if (membership === null) {
      throw notFound();
    }
    if (!membership.isCreator) {
      throw new AppError(
        403,
        'NOT_GROUP_CREATOR',
        DEFAULT_MESSAGES.NOT_GROUP_CREATOR,
      );
    }

    if (request.status !== 'PENDING') {
      throw notFound();
    }

    const row = await this.prisma.$transaction(async (tx) => {
      if (decision === 'APPROVED') {
        await tx.membership.create({
          data: {
            groupId: request.groupId,
            userId: request.userId,
            isCreator: false,
          },
        });
      }
      return tx.joinRequest.update({
        where: { id: request.id },
        data: { status: decision, decidedAt: new Date() },
        select: JOIN_REQUEST_SELECT,
      });
    });

    const requester = await this.users.getUserRef(request.userId);
    return toJoinRequestView(
      row,
      requester ?? { id: request.userId, displayName: '' },
    );
  }

  /** Exact-match lookup on the unique join code; empty/unknown → `null`. */
  private async findGroupByCode(code: string): Promise<ResolvedGroup | null> {
    if (code.length === 0) {
      return null;
    }
    return this.prisma.group.findUnique({
      where: { joinCode: code },
      select: { id: true, name: true },
    });
  }
}

/** The generic missing/non-member error (existence hiding, 03 §1). */
function notFound(): AppError {
  return new AppError(404, 'NOT_FOUND', DEFAULT_MESSAGES.NOT_FOUND);
}

/** Project a persisted join request to its API shape. */
function toJoinRequestView(
  row: JoinRequestRow,
  requester: UserRef,
): JoinRequestView {
  const view: JoinRequestView = {
    id: row.id,
    groupId: row.groupId,
    requester,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
  return row.decidedAt === null
    ? view
    : { ...view, decidedAt: row.decidedAt.toISOString() };
}

/** The single non-matching-code error (FR-GRP-004). */
function codeNotFound(): AppError {
  return new AppError(404, 'CODE_NOT_FOUND', DEFAULT_MESSAGES.CODE_NOT_FOUND);
}
