/**
 * Balances service — C5's derived balance engine (TKT-bal-002;
 * 01-system-architecture.md §2 C5, §5.2; 02-data-model.md §6/§7;
 * 03-api-design.md §3c balances row; D-ARCH-004).
 *
 * Balances are **derived, never materialized**: per `(group, member)`, computed
 * on demand as
 *
 * ```
 * balance(m, g) = Σ expenses.amountKurus  where payerId = m, groupId = g
 *               − Σ shares.shareKurus      where participantId = m,
 *                                               expense.groupId = g
 *               + Σ payments.amountKurus   where payerId = m, groupId = g,
 *                                               status = SETTLED
 *               − Σ payments.amountKurus   where recipientId = m, groupId = g,
 *                                               status = SETTLED
 * ```
 *
 * Zero-sum by construction (OBJ-004): shares sum to the expense amount (the C4
 * invariant) and each settled payment contributes `+X` and `−X`; the response
 * carries the computed sum (always exactly `0` in integer kuruş) for the UI/tests
 * (03 §3c).
 *
 * All reads are group-scoped (`02 §7` "always filtered by groupId") — never
 * cross-group (BR-BAL-001). Expenses/shares are read **only** through the C4
 * `LedgerReadService` (01 §3 rule 1: cross-module reads go through the owning
 * module); C5 owns `settled_payments` and reads them directly. One ledger read
 * pass per group (not per member): the ledger is loaded once and folded into a
 * per-member delta map.
 */
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipService } from '../groups/membership.service';
import { LedgerReadService } from '../ledger/ledger-read.service';

/** One member's derived balance (03-api-design.md §3c). */
export interface MemberBalanceView {
  readonly member: { readonly id: string; readonly displayName: string };
  readonly balanceKurus: number;
}

/** The `GET …/balances` response body (03-api-design.md §3c). */
export interface BalancesView {
  readonly balances: MemberBalanceView[];
  readonly sumKurus: number;
}

/** `PaymentStatus.SETTLED` — only settled facts enter the computation. */
const SETTLED = 'SETTLED';

@Injectable()
export class BalancesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly memberships: MembershipService,
    private readonly read: LedgerReadService,
  ) {}

  /**
   * The group's per-member balances and their sum. Only the group's stored
   * expenses, shares and settled payments are folded in — no cross-group data.
   *
   * `tx` is the optional interactive-transaction client (TKT-bal-004). The
   * mark-paid consistency rule (03-api-design.md §3.4) re-computes the plan
   * **inside the request's DB transaction**: passing `tx` makes the
   * `settled_payments` read share the connection with the subsequent insert,
   * so the plan is read from, and the fact written to, the same transaction.
   * Preventing a concurrent settlement from double-applying the same live
   * suggestion is the caller's responsibility — `markPaid` runs its
   * transaction at `Serializable`, so a conflicting concurrent transaction
   * aborts rather than both committing. The other three inputs (members,
   * expenses, shares) are immutable to the settlement routes, so their
   * owner-module reads (01 §3 rule 1) stay as-is.
   */
  async forGroup(
    groupId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<BalancesView> {
    const client = tx ?? this.prisma;
    const [members, expenses, shares, payments] = await Promise.all([
      this.memberships.listMembers(groupId),
      this.read.listGroupExpenses(groupId),
      this.read.listGroupShares(groupId),
      client.settledPayment.findMany({
        where: { groupId, status: SETTLED },
        select: { payerId: true, recipientId: true, amountKurus: true },
      }),
    ]);

    const deltas = new Map<string, number>();
    const add = (memberId: string, amount: number): void => {
      deltas.set(memberId, (deltas.get(memberId) ?? 0) + amount);
    };

    // Σ paid expenses − Σ own shares.
    for (const expense of expenses) {
      add(expense.payerId, expense.amountKurus);
    }
    for (const share of shares) {
      add(share.participantId, -share.shareKurus);
    }

    // Σ settled payments made − Σ settled payments received.
    for (const payment of payments) {
      add(payment.payerId, payment.amountKurus);
      add(payment.recipientId, -payment.amountKurus);
    }

    // One entry per member (zero-balance members included, balanceKurus 0).
    const balances = members.map((member) => ({
      member: { id: member.id, displayName: member.displayName },
      balanceKurus: deltas.get(member.id) ?? 0,
    }));

    const sumKurus = balances.reduce(
      (sum, balance) => sum + balance.balanceKurus,
      0,
    );

    return { balances, sumKurus };
  }
}
