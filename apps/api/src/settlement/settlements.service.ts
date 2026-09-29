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
import { PrismaService } from '../prisma/prisma.service';
import { BalancesService } from './balances.service';
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

@Injectable()
export class SettlementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly balances: BalancesService,
    @Inject(SUGGESTION_ENGINE) private readonly engine: SuggestionEngine,
  ) {}

  /** The group's live outstanding plan plus its stored settlement facts. */
  async forGroup(groupId: string): Promise<SettlementsView> {
    const [balancesView, payments] = await Promise.all([
      this.balances.forGroup(groupId),
      this.prisma.settledPayment.findMany({
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
      }),
    ]);

    // Member references resolved from the balance view (one entry per member,
    // display names only). Payers/recipients of stored facts are always
    // members (memberships are permanent — BR-BAL-008).
    const refs = new Map(
      balancesView.balances.map((balance) => [balance.member.id, balance.member]),
    );
    const ref = (id: string): SettlementPartyView =>
      refs.get(id) ?? { id, displayName: '' };

    // Only nonzero balances enter the engine (BR-BAL-005).
    const nonzero = new Map<string, number>();
    for (const balance of balancesView.balances) {
      if (balance.balanceKurus !== 0) {
        nonzero.set(balance.member.id, balance.balanceKurus);
      }
    }

    const outstanding = this.engine.suggest(nonzero).map((payment) => ({
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
}
