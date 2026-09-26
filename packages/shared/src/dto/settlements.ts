/**
 * Balances & Settlement DTOs — (03-api-design.md §3c, C5).
 *
 * Endpoints (all group-scoped): `GET /api/groups/:groupId/balances`
 * (200 `{ balances, sumKurus }`), `GET /api/groups/:groupId/settlements`
 * (200 `{ outstanding, settled }`), `POST /api/groups/:groupId/settlements`
 * (201 `{ settlement }`), `POST .../settlements/:settlementId/undo`
 * (200 `{ settlement }`).
 *
 * Balances and outstanding suggestions are **derived** on demand
 * (D-ARCH-004) — never stored, so they cannot drift. Outstanding
 * suggestions have no stable identity across recomputations; only exact
 * (payer, recipient, amount) matching against the current plan is
 * contractual (§3.4).
 */

import type { UserRefDto } from './common';

/**
 * One member's derived running balance. `balanceKurus` is a signed plain
 * number (positive = the group owes the member), not a `Kurus` value.
 */
export interface MemberBalanceDto {
  member: UserRefDto;
  balanceKurus: number;
}

/**
 * Success body of `GET /api/groups/:groupId/balances`. `sumKurus` is
 * always exactly 0 (zero-sum by construction, OBJ-004) and is carried for
 * the UI/tests (03 §3c).
 */
export interface BalancesResponseDto {
  balances: MemberBalanceDto[];
  sumKurus: number;
}

/**
 * One suggested outstanding payment of the current minimum-transaction
 * plan — derived output, recomputed on every read (BR-BAL-008).
 */
export interface OutstandingSuggestionDto {
  payer: UserRefDto;
  recipient: UserRefDto;
  amountKurus: number;
}

/** Status of a stored settled-payment fact (02-data-model.md §5.2). */
export type PaymentStatus = 'SETTLED' | 'UNDONE';

/**
 * A settled-payment fact. Rows are retained forever (NFR-BAL-005); an
 * undo sets `status` to `'UNDONE'` and `undoneAt`, and the row is
 * excluded from balance computation.
 */
export interface SettlementDto {
  id: string;
  payer: UserRefDto;
  recipient: UserRefDto;
  amountKurus: number;
  status: PaymentStatus;
  paidAt: string;
  /** Present iff the settlement has been undone. */
  undoneAt?: string;
}

/**
 * Success body of `GET /api/groups/:groupId/settlements` — the current
 * outstanding plan and the settled-payment facts, distinguished. An
 * all-zero group yields an empty `outstanding` (UC-BAL-002 A1).
 */
export interface SettleUpViewDto {
  outstanding: OutstandingSuggestionDto[];
  settled: SettlementDto[];
}

/**
 * `POST /api/groups/:groupId/settlements` request body (mark paid). Only
 * the payment's payer or recipient may mark it; the triple must exactly
 * match one suggestion of the plan as of the request's transaction, else
 * `409 SUGGESTION_STALE` (§3.4).
 */
export interface MarkPaidRequestDto {
  payerId: string;
  recipientId: string;
  amountKurus: number;
}

/** Success body of mark paid and undo. */
export interface SettlementResponseDto {
  settlement: SettlementDto;
}
