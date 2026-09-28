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
 * `getDetail` is the minimal read-back the create flow's own acceptance case
 * (TC-EXP-007 step 2) requires for any member; the full reads (list, cap,
 * `LedgerReadService`) are TKT-exp-003's scope.
 */
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService, type UserRef } from '../auth/users.service';
import { AppError } from '../common/errors/app-error';
import { DEFAULT_MESSAGES } from '../common/errors/error-contract';
import { MembershipService } from '../groups/membership.service';
import { RANDOM_SOURCE, type RandomSource } from '../groups/random-source';
import { splitExpense, type SplitType } from './engine/split-engine';
import type { CreateExpenseDto } from './dto/create-expense.dto';

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

/** Persisted expense columns the read model needs. */
interface ExpenseRow {
  readonly id: string;
  readonly description: string;
  readonly amountKurus: number;
  readonly splitType: SplitType;
  readonly payerId: string;
  readonly loggerId: string;
  readonly createdAt: Date;
  readonly editedAt: Date | null;
}

@Injectable()
export class LedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly memberships: MembershipService,
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

  /** Expense detail for a member; `404` when it does not exist in the group. */
  async getDetail(groupId: string, expenseId: string): Promise<ExpenseView> {
    const expense = await this.prisma.expense.findFirst({
      where: { id: expenseId, groupId },
      select: EXPENSE_ROW_SELECT,
    });
    if (expense === null) {
      throw new AppError(404, 'NOT_FOUND', DEFAULT_MESSAGES.NOT_FOUND);
    }
    return this.toView(expense);
  }

  /**
   * Project a persisted expense to its API shape. Shares are re-read from the
   * store (the permanent record, BR-EXP-005) and every reference is resolved to
   * `{ id, displayName }` only (FR-ACC-008).
   */
  private async toView(expense: ExpenseRow): Promise<ExpenseView> {
    const shareRows = await this.prisma.expenseShare.findMany({
      where: { expenseId: expense.id },
      select: { participantId: true, shareKurus: true },
    });
    const refs = await this.users.getUserRefs([
      expense.payerId,
      expense.loggerId,
      ...shareRows.map((share) => share.participantId),
    ]);
    const refOf = (id: string): UserRef =>
      refs.get(id) ?? { id, displayName: '' };

    const view: ExpenseView = {
      id: expense.id,
      description: expense.description,
      amountKurus: expense.amountKurus,
      splitType: expense.splitType,
      payer: refOf(expense.payerId),
      logger: refOf(expense.loggerId),
      shares: shareRows.map((share) => ({
        participant: refOf(share.participantId),
        shareKurus: share.shareKurus,
      })),
      createdAt: expense.createdAt.toISOString(),
    };
    return expense.editedAt === null
      ? view
      : { ...view, editedAt: expense.editedAt.toISOString() };
  }
}

/** The expense columns every read model projects. */
const EXPENSE_ROW_SELECT = {
  id: true,
  description: true,
  amountKurus: true,
  splitType: true,
  payerId: true,
  loggerId: true,
  createdAt: true,
  editedAt: true,
} as const;
