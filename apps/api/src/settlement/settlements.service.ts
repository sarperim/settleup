/**
 * Settlements service — C5's settle-up read model (TKT-bal-003;
 * 01-system-architecture.md §2 C5, §5.3; 03-api-design.md §3c settlements row;
 * D-ARCH-004).
 *
 * `GET /api/groups/:groupId/settlements` returns two distinguished parts:
 *
 * - **`outstanding`** — the current minimum-transaction suggestion plan,
 *   computed **live** on every read from the derived balances (via the TKT-bal-002
 *   `BalancesService`) and the TKT-bal-001 suggestion engine. Never stored
 *   (D-ARCH-004 / strategy G-3); zero-balance members never appear
 *   (BR-BAL-005).
 * - **`settled`** — the stored `SettledPayment` facts of the group, both
 *   `SETTLED` and `UNDONE`, in their stored order. An undone fact is retained
 *   forever and is distinguished by its `undoneAt` (NFR-BAL-005); the balance
 *   engine counts `SETTLED` only, so an undone row is already excluded from the
 *   plan above.
 *
 * All reads are group-scoped (`02-data-model.md §7`); C5 owns `settled_payments`
 * and reads them directly, while expenses/shares enter only through the C4
 * `LedgerReadService` inside `BalancesService` (01 §3 rule 1).
 *
 * Scale note (TKT-bal-001 round-1 SEC-1): the exact search is expected at the
 * brief's ≤ 8-member scale (NFR-BAL-003); the engine's own defensive greedy
 * fallback covers larger vectors.
 */
import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '../common/errors/app-error';
import { DEFAULT_MESSAGES } from '../common/errors/error-contract';
import { PrismaService } from '../prisma/prisma.service';
import { BalancesService, type BalancesView } from './balances.service';
import type { CreateSettlementDto } from './dto/create-settlement.dto';
import {
  SUGGESTION_ENGINE,
  type SuggestionEngine,
} from './suggestion-engine.provider';

/** A minimal group-scoped user reference — never an email (FR-ACC-008). */
export interface SettlementPartyView {
  readonly id: string;
  readonly displayName: string;
}

/** One entry of the derived outstanding plan (03-api-design.md §3c). */
export interface OutstandingSuggestionView {
  readonly payer: SettlementPartyView;
  readonly recipient: SettlementPartyView;
  readonly amountKurus: number;
}

/** One stored settled-payment fact (03-api-design.md §3c). */
export interface SettledPaymentView {
  readonly id: string;
  readonly payer: SettlementPartyView;
  readonly recipient: SettlementPartyView;
  readonly amountKurus: number;
  readonly paidAt: string;
  readonly undoneAt?: string;
}

/** The `GET …/settlements` response body (03-api-design.md §3c). */
export interface SettlementsView {
  readonly outstanding: OutstandingSuggestionView[];
  readonly settled: SettledPaymentView[];
}

/** The stored `PaymentStatus` of a settlement fact (02-data-model.md §4). */
export type SettlementStatus = 'SETTLED' | 'UNDONE';

/** A settlement fact as returned by the mark-paid/undo write routes (03 §3c). */
export interface SettlementView {
  readonly id: string;
  readonly payer: SettlementPartyView;
  readonly recipient: SettlementPartyView;
  readonly amountKurus: number;
  readonly status: SettlementStatus;
  readonly paidAt: string;
  readonly undoneAt?: string;
}

/** The `settled_payments` columns the write routes read/project. */
const SETTLEMENT_ROW_SELECT = {
  id: true,
  payerId: true,
  recipientId: true,
  amountKurus: true,
  status: true,
  paidAt: true,
  undoneAt: true,
} as const;

interface SettlementRow {
  readonly id: string;
  readonly payerId: string;
  readonly recipientId: string;
  readonly amountKurus: number;
  readonly status: SettlementStatus;
  readonly paidAt: Date;
  readonly undoneAt: Date | null;
}

@Injectable()
export class SettlementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly balances: BalancesService,
    @Inject(SUGGESTION_ENGINE) private readonly engine: SuggestionEngine,
  ) {}

  /** The group's live outstanding plan plus its stored settlement facts. */
  async forGroup(groupId: string): Promise<SettlementsView> {
    const balancesView = await this.balances.forGroup(groupId);
    const payments = await this.prisma.settledPayment.findMany({
      where: { groupId },
      orderBy: [{ paidAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        payerId: true,
        recipientId: true,
        amountKurus: true,
        paidAt: true,
        undoneAt: true,
      },
    });

    const ref = this.refResolver(balancesView);

    const outstanding = this.suggestionPlan(balancesView).map((payment) => ({
      payer: ref(payment.payerId),
      recipient: ref(payment.recipientId),
      amountKurus: payment.amountKurus,
    }));

    const settled = payments.map((payment) => ({
      id: payment.id,
      payer: ref(payment.payerId),
      recipient: ref(payment.recipientId),
      amountKurus: payment.amountKurus,
      paidAt: payment.paidAt.toISOString(),
      ...(payment.undoneAt !== null
        ? { undoneAt: payment.undoneAt.toISOString() }
        : {}),
    }));

    return { outstanding, settled };
  }

  /**
   * Mark a suggested payment as paid (UC-BAL-003 main; FR-BAL-006/007,
   * BR-BAL-006/007; 03-api-design.md §3c, §3.4).
   *
   * Service-level precedence (03 §4, amended 2026-09-25): the **party check
   * first** — the caller must be the submitted payment's payer or recipient,
   * else `403 NOT_PAYMENT_PARTY` and no plan work is done. Then balances and
   * the plan are re-computed **inside the request's DB transaction** and the
   * submitted `(payerId, recipientId, amountKurus)` must exactly match one
   * suggestion; otherwise `409 SUGGESTION_STALE` (a stale client plan is
   * rejected, never double-applied). On a match a `SETTLED` fact is inserted.
   */
  async markPaid(
    actorId: string,
    groupId: string,
    dto: CreateSettlementDto,
  ): Promise<SettlementView> {
    // 1. Party check — before any plan recomputation (03 §4).
    if (actorId !== dto.payerId && actorId !== dto.recipientId) {
      throw new AppError(
        403,
        'NOT_PAYMENT_PARTY',
        DEFAULT_MESSAGES.NOT_PAYMENT_PARTY,
      );
    }

    // 2. Recompute balances + plan and insert atomically (03 §3.4).
    const created = await this.prisma.$transaction(async (tx) => {
      const balancesView = await this.balances.forGroup(groupId, tx);
      const match = this.suggestionPlan(balancesView).find(
        (payment) =>
          payment.payerId === dto.payerId &&
          payment.recipientId === dto.recipientId &&
          payment.amountKurus === dto.amountKurus,
      );
      if (match === undefined) {
        throw new AppError(
          409,
          'SUGGESTION_STALE',
          DEFAULT_MESSAGES.SUGGESTION_STALE,
        );
      }

      return tx.settledPayment.create({
        data: {
          groupId,
          payerId: dto.payerId,
          recipientId: dto.recipientId,
          amountKurus: dto.amountKurus,
          status: 'SETTLED',
        },
        select: SETTLEMENT_ROW_SELECT,
      });
    });

    const balancesView = await this.balances.forGroup(groupId);
    return this.toSettlementView(created, this.refResolver(balancesView));
  }

  /**
   * Undo a settled payment (UC-BAL-004 main; FR-BAL-008/009, BR-BAL-006/008;
   * 03-api-design.md §3c undo row).
   *
   * A payment is addressable only through its own group: a foreign or missing
   * `settlementId` is indistinguishable → `404 NOT_FOUND`. Service-level
   * precedence (03 §4, amended 2026-09-25): the **party check first** —
   * caller must be the settled payment's payer or recipient, else
   * `403 NOT_PAYMENT_PARTY` — then `409 ALREADY_UNDONE` for an already-undone
   * target. On success `status → UNDONE`, `undoneAt` set, `paidAt` unchanged;
   * the row is retained forever (NFR-BAL-005) and the excluded payment
   * naturally re-enters the derived plan on the next read.
   */
  async undo(
    groupId: string,
    settlementId: string,
    actorId: string,
  ): Promise<SettlementView> {
    const existing = await this.prisma.settledPayment.findFirst({
      where: { id: settlementId, groupId },
      select: SETTLEMENT_ROW_SELECT,
    });
    if (existing === null) {
      throw new AppError(404, 'NOT_FOUND', DEFAULT_MESSAGES.NOT_FOUND);
    }

    // Party check precedes the state check (03 §4).
    if (actorId !== existing.payerId && actorId !== existing.recipientId) {
      throw new AppError(
        403,
        'NOT_PAYMENT_PARTY',
        DEFAULT_MESSAGES.NOT_PAYMENT_PARTY,
      );
    }
    if (existing.status === 'UNDONE') {
      throw new AppError(
        409,
        'ALREADY_UNDONE',
        DEFAULT_MESSAGES.ALREADY_UNDONE,
      );
    }

    const updated = await this.prisma.settledPayment.update({
      where: { id: settlementId },
      data: { status: 'UNDONE', undoneAt: new Date() },
      select: SETTLEMENT_ROW_SELECT,
    });

    const balancesView = await this.balances.forGroup(groupId);
    return this.toSettlementView(updated, this.refResolver(balancesView));
  }

  /** Only members with a nonzero balance enter the engine (BR-BAL-005). */
  private suggestionPlan(
    balancesView: BalancesView,
  ): Array<{ payerId: string; recipientId: string; amountKurus: number }> {
    const nonzero = new Map<string, number>();
    for (const balance of balancesView.balances) {
      if (balance.balanceKurus !== 0) {
        nonzero.set(balance.member.id, balance.balanceKurus);
      }
    }
    return this.engine.suggest(nonzero);
  }

  /** Resolve a member id to its `{ id, displayName }` ref (FR-ACC-008). */
  private refResolver(
    balancesView: BalancesView,
  ): (id: string) => SettlementPartyView {
    const refs = new Map(
      balancesView.balances.map((balance) => [balance.member.id, balance.member]),
    );
    return (id: string) => refs.get(id) ?? { id, displayName: '' };
  }

  /** Project one stored settlement fact to its write-response shape. */
  private toSettlementView(
    row: SettlementRow,
    ref: (id: string) => SettlementPartyView,
  ): SettlementView {
    return {
      id: row.id,
      payer: ref(row.payerId),
      recipient: ref(row.recipientId),
      amountKurus: row.amountKurus,
      status: row.status,
      paidAt: row.paidAt.toISOString(),
      ...(row.undoneAt !== null
        ? { undoneAt: row.undoneAt.toISOString() }
        : {}),
    };
  }
}
