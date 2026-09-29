/**
 * TC-BAL-009 — Mark a suggested payment as paid, by its payer (UC-BAL-003 main)
 * (balances-settlement.md §2; FR-BAL-006 payer side, FR-BAL-007, UC-BAL-003
 * main, BR-BAL-006/007, 03-api-design.md §3c/§3.4).
 *
 * Integration level. Standing value fixture → plan {bob→alice 3000,
 * carol→alice 3000}. Bob (the suggestion's payer) marks his payment paid; the
 * payer's balance rises and the recipient's falls by the exact amount
 * (BR-BAL-002 settled terms), the plan regenerates without the settled
 * suggestion, and the new fact appears in `settled`.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  api,
  createIntegrationApp,
  type IntegrationApp,
} from './support/app';
import {
  createStandingValueGroup,
  markPaid,
  readSettlements,
} from './support/settlements';
import { truncateAllTables } from './support/truncate';

let ctx: IntegrationApp;

beforeAll(async () => {
  ctx = await createIntegrationApp();
});

afterAll(async () => {
  if (ctx) {
    await ctx.app.close();
  }
});

beforeEach(async () => {
  await truncateAllTables(ctx.prisma);
});

interface SuggestionEntry {
  payer: { id: string };
  recipient: { id: string };
  amountKurus: number;
}

function tuples(entries: SuggestionEntry[]) {
  return entries
    .map((entry) => ({
      payer: entry.payer.id,
      recipient: entry.recipient.id,
      amountKurus: entry.amountKurus,
    }))
    .sort((a, b) => a.payer.localeCompare(b.payer));
}

describe('TC-BAL-009 — mark a suggested payment paid, by its payer', () => {
  it('creates a SETTLED fact, shifts balances and regenerates the plan', async () => {
    const { alice, bob, carol, group, plan } =
      await createStandingValueGroup(ctx.server);

    // 1. Mark the bob→alice suggestion paid as bob (the payer).
    const settlement = await markPaid(ctx.server, bob.cookie, group.id, plan[0]!);

    expect(settlement.status).toBe('SETTLED');
    expect(settlement.amountKurus).toBe(3000);
    expect(typeof settlement.paidAt).toBe('string');
    expect(settlement.payer.id).toBe(bob.id);
    expect(settlement.recipient.id).toBe(alice.id);
    expect(settlement.undoneAt).toBeUndefined();

    // 2. Balances: alice +3000, bob 0, carol −3000; sum 0.
    const balancesResponse = await api(ctx.server)
      .get(`/api/groups/${group.id}/balances`)
      .set('Cookie', alice.cookie);
    expect(balancesResponse.status).toBe(200);
    expect(balancesResponse.body.sumKurus).toBe(0);
    const balances = new Map<string, number>(
      (
        balancesResponse.body.balances as Array<{
          member: { id: string };
          balanceKurus: number;
        }>
      ).map((entry) => [entry.member.id, entry.balanceKurus]),
    );
    expect(balances.get(alice.id)).toBe(3000);
    expect(balances.get(bob.id)).toBe(0);
    expect(balances.get(carol.id)).toBe(-3000);

    // 2. Settle-up view: the settled suggestion is gone; exactly carol→alice
    //    remains outstanding; `settled` lists the new payment.
    const view = await readSettlements(ctx.server, alice.cookie, group.id);
    expect(tuples(view.outstanding)).toEqual([
      { payer: carol.id, recipient: alice.id, amountKurus: 3000 },
    ]);
    expect(view.settled).toHaveLength(1);
    const fact = view.settled[0]!;
    expect(fact.payer.id).toBe(bob.id);
    expect(fact.recipient.id).toBe(alice.id);
    expect(fact.amountKurus).toBe(3000);
    expect(fact.paidAt).toBe(settlement.paidAt);
  });
});
