/**
 * Expense DTOs — Ledger (03-api-design.md §3b, C4).
 *
 * Endpoints (all group-scoped, `GroupMemberGuard`): `POST
 * /api/groups/:groupId/expenses` (201 `{ expense incl. shares }`), `GET
 * /api/groups/:groupId/expenses` (200 `{ expenses }` — full list, newest
 * first, no pagination), `GET /api/groups/:groupId/expenses/:expenseId`
 * (200 `{ expense }`), `PATCH .../expenses/:expenseId` (200 `{ expense }`),
 * `DELETE .../expenses/:expenseId` (204 — no body).
 *
 * There is **no expense date field** anywhere in these DTOs (BR-EXP-008) —
 * timestamps are server-set. Zero amounts are valid (BR-EXP-010),
 * single-participant expenses are valid (OQ-EXP-001), zero-kuruş exact
 * shares are valid (OQ-EXP-003).
 */

import type { UserRefDto } from './common';

/** Split type — exactly two values (BR-EXP-003). */
export type SplitType = 'EQUAL' | 'EXACT';

/**
 * `POST /api/groups/:groupId/expenses` request body. `exactAmounts` is
 * required iff `splitType` is `'EXACT'`; its values must sum exactly to
 * `amountKurus` (BR-EXP-006). `amountKurus` is an integer ≥ 0 and ≤
 * `KURUS_STORAGE_BOUND`.
 */
export interface CreateExpenseRequestDto {
  description: string;
  amountKurus: number;
  payerId: string;
  participantIds: string[];
  splitType: SplitType;
  /** Per-participant kuruş keyed by participant id (EXACT splits only). */
  exactAmounts?: Record<string, number>;
}

/**
 * `PATCH /api/groups/:groupId/expenses/:expenseId` request body — any
 * subset of the editable fields (logger only; 03 §3b). Shares are
 * recomputed with a fresh draw iff `amountKurus`, `participantIds` or
 * `splitType` change; a payer-only or description-only edit leaves the
 * stored shares untouched (FR-EXP-006).
 */
export interface EditExpenseRequestDto {
  description?: string;
  amountKurus?: number;
  payerId?: string;
  participantIds?: string[];
  splitType?: SplitType;
  /** Per-participant kuruş keyed by participant id (EXACT splits only). */
  exactAmounts?: Record<string, number>;
}

/** One stored share of an expense — the expense's permanent record (BR-EXP-005). */
export interface ExpenseShareDto {
  participant: UserRefDto;
  shareKurus: number;
}

/**
 * An expense as returned by create, detail, list and edit. Payer and
 * logger are exposed by display name only (FR-ACC-008). `editedAt` is
 * absent until the first edit (BR-EXP-008).
 */
export interface ExpenseDto {
  id: string;
  description: string;
  amountKurus: number;
  splitType: SplitType;
  payer: UserRefDto;
  logger: UserRefDto;
  shares: ExpenseShareDto[];
  createdAt: string;
  /** Present iff the expense has been edited. */
  editedAt?: string;
}

/** Success body of create, detail and edit. */
export interface ExpenseResponseDto {
  expense: ExpenseDto;
}

/** Success body of `GET /api/groups/:groupId/expenses` — full list, newest first. */
export interface ExpensesResponseDto {
  expenses: ExpenseDto[];
}
