/**
 * Ledger service — C4 expense writes/reads (TKT-exp-002;
 * 01-system-architecture.md §2 C4, §5.1; 03-api-design.md §3b; 02-data-model.md
 * §4/§5.4/§9).
 *
 * `create` owns the UC-EXP-001 main flow: validate the participant list and the
 * payer/participant membership, compute the shares through the pure split
 * engine over the **injected CSPRNG source** (arch. §3 rule 3), then persist the
 * expense and its shares in **one DB transaction** (NFR-EXP-003). Service-level
 * checks run in the amended fixed order `NO_PARTICIPANTS` →
 * `PARTICIPANT_NOT_MEMBER` → `SPLIT_SUM_MISMATCH` (03 §4, 2026-09-25).
 *
 * `getDetail` and `list` read through `LedgerReadService` — the same exported
 * read API C5 Settlement consumes for balance computation (TKT-exp-003;
 * 01-system-architecture.md §3 rule 1). `list` applies the defensive 500-row
 * cap (NFR-EXP-004, 03-api-design.md §3b) before projecting the rows; the raw
 * read itself is uncapped so balances always see the full ledger.
 */
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService, type UserRef } from '../auth/users.service';
import { AppError } from '../common/errors/app-error';
import { DEFAULT_MESSAGES } from '../common/errors/error-contract';
import { MembershipService } from '../groups/membership.service';
import { RANDOM_SOURCE, type RandomSource } from '../groups/random-source';
import {
  splitExpense,
  type SplitShare,
  type SplitType,
} from './engine/split-engine';
import {
  EXPENSE_ROW_SELECT,
  LedgerReadService,
  type LedgerExpenseRow,
  type LedgerShareRow,
} from './ledger-read.service';
import type { CreateExpenseDto } from './dto/create-expense.dto';
import type { UpdateExpenseDto } from './dto/update-expense.dto';

/** One stored share as returned by the API (mirrors `ExpenseShareDto`). */
export interface ExpenseShareView {
  readonly participant: UserRef;
  readonly shareKurus: number;
}

/** An expense as returned by create/detail (mirrors `ExpenseDto`). */
export interface ExpenseView {
  readonly id: string;
  readonly description: string;
  readonly amountKurus: number;
  readonly splitType: SplitType;
  readonly payer: UserRef;
  readonly logger: UserRef;
  readonly shares: ExpenseShareView[];
  readonly createdAt: string;
  /** Present iff the expense has been edited (absent on create). */
  readonly editedAt?: string;
}

/**
 * The defensive list cap (NFR-EXP-004, arch. §9 flag 4; 03-api-design.md §3b).
 * Never expected at the brief §7 scale (20–50 expenses/trip); it exists so a
 * group that somehow exceeds it gets an explicit `500 LIST_TOO_LARGE` rather
 * than an unbounded response.
 */
export const EXPENSE_LIST_CAP = 500;

@Injectable()
export class LedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly memberships: MembershipService,
    private readonly read: LedgerReadService,
    @Inject(RANDOM_SOURCE) private readonly random: RandomSource,
  ) {}

  /**
   * Log an expense (FR-EXP-001/002/003/004/005/006/007, BR-EXP-002/004/006/010).
   */
  async create(
    loggerId: string,
    groupId: string,
    dto: CreateExpenseDto,
  ): Promise<ExpenseView> {
    // 1. Participant-list shape (BR-EXP-002) — before any membership work.
    if (dto.participantIds.length === 0) {
      throw new AppError(
        400,
        'NO_PARTICIPANTS',
        DEFAULT_MESSAGES.NO_PARTICIPANTS,
      );
    }

    // 2. Payer and participants must belong to the group (FR-EXP-003).
    for (const userId of [dto.payerId, ...dto.participantIds]) {
      if (!(await this.memberships.isMember(groupId, userId))) {
        throw new AppError(
          400,
          'PARTICIPANT_NOT_MEMBER',
          DEFAULT_MESSAGES.PARTICIPANT_NOT_MEMBER,
        );
      }
    }

    // 3. Split arithmetic (FR-EXP-004/005/007) — real CSPRNG for the remainder.
    const split = splitExpense(
      {
        amountKurus: dto.amountKurus,
        participantIds: dto.participantIds,
        splitType: dto.splitType,
        exactAmounts: dto.exactAmounts,
      },
      this.random,
    );
    if (!split.ok) {
      throw new AppError(
        400,
        'SPLIT_SUM_MISMATCH',
        DEFAULT_MESSAGES.SPLIT_SUM_MISMATCH,
      );
    }

    // 4. Expense + shares in one transaction (NFR-EXP-003).
    const created = await this.prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          groupId,
          description: dto.description,
          amountKurus: dto.amountKurus,
          payerId: dto.payerId,
          splitType: dto.splitType,
          loggerId,
        },
        select: EXPENSE_ROW_SELECT,
      });
      await tx.expenseShare.createMany({
        data: split.shares.map((share) => ({
          expenseId: expense.id,
          participantId: share.participantId,
          shareKurus: share.shareKurus,
        })),
      });
      return expense;
    });

    return this.toView(created);
  }

  /**
   * Edit an expense (UC-EXP-002 main; FR-EXP-006/008/010, BR-EXP-005/007).
   *
   * `NOT_LOGGER` and the group-scoped `404` are enforced by
   * `ExpenseLoggerGuard` before this method; `expense` is the already-resolved
   * permanent row. The update is **partial**: every omitted DTO field keeps its
   * stored value, and the effective values are validated with the create rules
   * in the same service-level order `NO_PARTICIPANTS` →
   * `PARTICIPANT_NOT_MEMBER` → `SPLIT_SUM_MISMATCH` (03 §4).
   *
   * Shares are the expense's permanent record (BR-EXP-005): they are recomputed
   * with a fresh draw **iff** the amount, participants or split type changed —
   * a description-only or payer-only edit leaves the stored shares untouched.
   * `editedAt` is set on success only; a rejected edit touches nothing.
   */
  async update(
    groupId: string,
    expense: LedgerExpenseRow,
    dto: UpdateExpenseDto,
  ): Promise<ExpenseView> {
    const storedShares = await this.read.findSharesForExpenses([expense.id]);
    const storedParticipantIds = storedShares.map(
      (share) => share.participantId,
    );

    // Effective values: omitted fields keep their stored value.
    const amountKurus = dto.amountKurus ?? expense.amountKurus;
    const payerId = dto.payerId ?? expense.payerId;
    const splitType = dto.splitType ?? expense.splitType;
    const participantIds = dto.participantIds ?? storedParticipantIds;

    // 1. Participant-list shape (BR-EXP-002) — same order as create.
    if (participantIds.length === 0) {
      throw new AppError(
        400,
        'NO_PARTICIPANTS',
        DEFAULT_MESSAGES.NO_PARTICIPANTS,
      );
    }

    // 2. Payer and participants must belong to the group (FR-EXP-003).
    for (const userId of [payerId, ...participantIds]) {
      if (!(await this.memberships.isMember(groupId, userId))) {
        throw new AppError(
          400,
          'PARTICIPANT_NOT_MEMBER',
          DEFAULT_MESSAGES.PARTICIPANT_NOT_MEMBER,
        );
      }
    }

    // 3. Recompute trigger (FR-EXP-006/BR-EXP-005): amount, participants or
    //    split type changed → fresh draw / fresh exact arithmetic; otherwise
    //    the stored shares stand.
    const amountChanged = amountKurus !== expense.amountKurus;
    const splitTypeChanged = splitType !== expense.splitType;
    const participantsChanged = !sameParticipantSet(
      participantIds,
      storedParticipantIds,
    );
    const recompute = amountChanged || splitTypeChanged || participantsChanged;

    let shares: SplitShare[] | null = null;
    if (recompute) {
      // For EXACT, the per-participant amounts default to the stored shares
      // (the permanent record) when the caller supplies none — an amount-only
      // edit is validated against them (TC-EXP-017).
      const exactAmounts =
        splitType === 'EXACT'
          ? (dto.exactAmounts ??
            Object.fromEntries(
              storedShares.map((share) => [
                share.participantId,
                share.shareKurus,
              ]),
            ))
          : undefined;
      const split = splitExpense(
        { amountKurus, participantIds, splitType, exactAmounts },
        this.random,
      );
      if (!split.ok) {
        throw new AppError(
          400,
          'SPLIT_SUM_MISMATCH',
          DEFAULT_MESSAGES.SPLIT_SUM_MISMATCH,
        );
      }
      shares = split.shares;
    }

    // 4. Expense (+ replaced shares) in one transaction (NFR-EXP-003).
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.expense.update({
        where: { id: expense.id },
        data: {
          description: dto.description ?? expense.description,
          amountKurus,
          payerId,
          splitType,
          editedAt: new Date(),
        },
        select: EXPENSE_ROW_SELECT,
      });
      if (shares !== null) {
        await tx.expenseShare.deleteMany({ where: { expenseId: expense.id } });
        await tx.expenseShare.createMany({
          data: shares.map((share) => ({
            expenseId: expense.id,
            participantId: share.participantId,
            shareKurus: share.shareKurus,
          })),
        });
      }
      return row;
    });

    return this.toView(updated);
  }

  /**
   * Delete an expense permanently (UC-EXP-003 main; FR-EXP-009/012,
   * BR-EXP-011, NFR-EXP-005). `NOT_LOGGER` and the `404` are enforced by
   * `ExpenseLoggerGuard`. The `expense_shares` rows cascade at the store
   * (02-data-model.md §4) — a hard delete, no archive table, no soft-delete
   * flag.
   */
  async delete(expense: LedgerExpenseRow): Promise<void> {
    await this.prisma.expense.delete({ where: { id: expense.id } });
  }

  /** Expense detail for a member; `404` when it does not exist in the group. */
  async getDetail(groupId: string, expenseId: string): Promise<ExpenseView> {
    const expense = await this.read.findGroupExpense(groupId, expenseId);
    if (expense === null) {
      throw new AppError(404, 'NOT_FOUND', DEFAULT_MESSAGES.NOT_FOUND);
    }
    return this.toView(expense);
  }

  /**
   * The group ledger (UC-EXP-004 main; FR-EXP-011): every expense, newest
   * first. A group above the defensive cap fails loudly with
   * `500 LIST_TOO_LARGE` (NFR-EXP-004) instead of returning an unbounded
   * response.
   */
  async list(groupId: string): Promise<ExpenseView[]> {
    const count = await this.read.countGroupExpenses(groupId);
    if (count > EXPENSE_LIST_CAP) {
      throw new AppError(
        500,
        'LIST_TOO_LARGE',
        DEFAULT_MESSAGES.LIST_TOO_LARGE,
      );
    }
    return this.toViews(await this.read.listGroupExpenses(groupId));
  }

  /** Project one persisted expense to its API shape. */
  private async toView(expense: LedgerExpenseRow): Promise<ExpenseView> {
    const [view] = await this.toViews([expense]);
    // Non-empty by construction: `toViews` returns one view per input row.
    return view!;
  }

  /**
   * Project persisted expenses to their API shape in one batch. Shares are
   * re-read from the store (the permanent record, BR-EXP-005) and every
   * reference is resolved to `{ id, displayName }` only (FR-ACC-008) — one
   * shares query and one users query for the whole list, not per row.
   */
  private async toViews(
    expenses: readonly LedgerExpenseRow[],
  ): Promise<ExpenseView[]> {
    if (expenses.length === 0) {
      return [];
    }
    const shareRows = await this.read.findSharesForExpenses(
      expenses.map((expense) => expense.id),
    );
    const refs = await this.users.getUserRefs([
      ...expenses.map((expense) => expense.payerId),
      ...expenses.map((expense) => expense.loggerId),
      ...shareRows.map((share) => share.participantId),
    ]);
    const refOf = (id: string): UserRef =>
      refs.get(id) ?? { id, displayName: '' };

    const sharesByExpense = new Map<string, LedgerShareRow[]>();
    for (const share of shareRows) {
      const bucket = sharesByExpense.get(share.expenseId);
      if (bucket === undefined) {
        sharesByExpense.set(share.expenseId, [share]);
      } else {
        bucket.push(share);
      }
    }

    return expenses.map((expense) => {
      const view: ExpenseView = {
        id: expense.id,
        description: expense.description,
        amountKurus: expense.amountKurus,
        splitType: expense.splitType,
        payer: refOf(expense.payerId),
        logger: refOf(expense.loggerId),
        shares: (sharesByExpense.get(expense.id) ?? []).map((share) => ({
          participant: refOf(share.participantId),
          shareKurus: share.shareKurus,
        })),
        createdAt: expense.createdAt.toISOString(),
      };
      return expense.editedAt === null
        ? view
        : { ...view, editedAt: expense.editedAt.toISOString() };
    });
  }
}

/**
 * Whether two participant-id lists are the same **set** (order-insensitive).
 * The recompute trigger (FR-EXP-006) concerns the participant set, so a
 * re-ordered list is not a change.
 */
function sameParticipantSet(
  a: readonly string[],
  b: readonly string[],
): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const ids = new Set(a);
  return b.every((id) => ids.has(id));
}
