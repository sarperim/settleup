/**
 * Ledger read API — C4's exported reads for C5 (TKT-exp-003;
 * 01-system-architecture.md §3 rule 1, 02-data-model.md §6 ownership matrix).
 *
 * C4 owns `expenses`/`expense_shares`; the Settlement module never touches
 * those tables directly — its balance computation consumes these group-scoped
 * reads. The list/detail HTTP routes also read through here, so there is one
 * query surface for the domain rather than parallel hand-rolled reads.
 *
 * These are raw reads: no membership checks (the `GroupMemberGuard` is the
 * privacy boundary, 01 §8.1) and no response-shape projection (that belongs to
 * `LedgerService`). The defensive list cap is a response concern and lives at
 * the service seam, not here — balances must still see the full ledger.
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { SplitType } from './engine/split-engine';

/** The persisted expense columns every read model needs. */
export interface LedgerExpenseRow {
  readonly id: string;
  readonly description: string;
  readonly amountKurus: number;
  readonly splitType: SplitType;
  readonly payerId: string;
  readonly loggerId: string;
  readonly createdAt: Date;
  readonly editedAt: Date | null;
}

/** One persisted share row (group-scoped reads for balance computation). */
export interface LedgerShareRow {
  readonly expenseId: string;
  readonly participantId: string;
  readonly shareKurus: number;
}

/** The expense columns every read model projects. */
export const EXPENSE_ROW_SELECT = {
  id: true,
  description: true,
  amountKurus: true,
  splitType: true,
  payerId: true,
  loggerId: true,
  createdAt: true,
  editedAt: true,
} as const;

@Injectable()
export class LedgerReadService {
  constructor(private readonly prisma: PrismaService) {}

  /** The number of expenses in a group (the list cap's boundary input). */
  countGroupExpenses(groupId: string): Promise<number> {
    return this.prisma.expense.count({ where: { groupId } });
  }

  /**
   * A group's expenses, newest first (02-data-model.md §4
   * `@@index([groupId, createdAt])`). `id` is the stable tiebreak for rows
   * sharing a `createdAt` millisecond.
   */
  listGroupExpenses(groupId: string): Promise<LedgerExpenseRow[]> {
    return this.prisma.expense.findMany({
      where: { groupId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: EXPENSE_ROW_SELECT,
    });
  }

  /** One expense addressable only through its own group, or `null`. */
  findGroupExpense(
    groupId: string,
    expenseId: string,
  ): Promise<LedgerExpenseRow | null> {
    return this.prisma.expense.findFirst({
      where: { id: expenseId, groupId },
      select: EXPENSE_ROW_SELECT,
    });
  }

  /** The shares of the given expenses, keyed by `expenseId` (`[]` if none). */
  findSharesForExpenses(
    expenseIds: readonly string[],
  ): Promise<LedgerShareRow[]> {
    if (expenseIds.length === 0) {
      return Promise.resolve([]);
    }
    return this.prisma.expenseShare.findMany({
      where: { expenseId: { in: [...expenseIds] } },
      select: { expenseId: true, participantId: true, shareKurus: true },
    });
  }

  /** Every share of a group's expenses — C5's balance aggregation input. */
  listGroupShares(groupId: string): Promise<LedgerShareRow[]> {
    return this.prisma.expenseShare.findMany({
      where: { expense: { groupId } },
      select: { expenseId: true, participantId: true, shareKurus: true },
    });
  }
}
