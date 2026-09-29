/**
 * TC-BAL-013 — Undo a settled payment, by either party (UC-BAL-004 main)
 * (balances-settlement.md §2; FR-BAL-008/009, UC-BAL-004 main, BR-BAL-006/008,
 * NFR-BAL-005, 03-api-design.md §3c undo row).
 *
 * Integration level. Precondition: {bob→alice 3000} was settled (balances alice
 * +3000, bob 0, carol −3000). Undo — by the recipient and, on a fresh fixture,
 * by the payer — sets `UNDONE`, retains the row with `undoneAt`, leaves
 * `paidAt` unchanged, reverts the balances and re-includes the equivalent
 * payment in the regenerated plan (the plan is derived).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createIntegrationApp,
  type IntegrationApp,
} from './support/app';
import {
  createStandingValueGroup,
  markPaid,
  readBalancesView,
  readSettlements,
  undoSettlement,
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

describe('TC-BAL-013 — undo a settled payment, by either party', () => {
  it('by the recipient: UNDONE, balances revert, plan re-includes the payment', async () => {
    const { alice, bob, carol, group, plan } =
      await createStandingValueGroup(ctx.server);

    const settlement = await markPaid(ctx.server, bob.cookie, group.id, plan[0]!);
    const paidAt = settlement.paidAt;

    // 1. Alice (the recipient) undoes it.
    const undone = await undoSettlement(
      ctx.server,
      alice.cookie,
      group.id,
      settlement.id,
    );
    expect(undone.status).toBe('UNDONE');
    expect(typeof undone.undoneAt).toBe('string');
    expect(undone.paidAt).toBe(paidAt);

    // 2. Balances revert to the pre-settlement values; sum 0.
    const { balances, sumKurus } = await readBalancesView(
      ctx.server,
      alice.cookie,
      group.id,
    );
    expect(sumKurus).toBe(0);
    expect(balances.get(alice.id)).toBe(6000);
    expect(balances.get(bob.id)).toBe(-3000);
    expect(balances.get(carol.id)).toBe(-3000);

    // 2. The plan re-includes the equivalent payment; the row is retained with
    //    `undoneAt` set (NFR-BAL-005).
    const view = await readSettlements(ctx.server, alice.cookie, group.id);
    expect(view.outstanding).toHaveLength(2);
    const tuples = view.outstanding
      .map((entry) => ({
        payer: entry.payer.id,
        recipient: entry.recipient.id,
        amountKurus: entry.amountKurus,
      }))
      .sort((a, b) => a.payer.localeCompare(b.payer));
    expect(tuples).toEqual([
      { payer: bob.id, recipient: alice.id, amountKurus: 3000 },
      { payer: carol.id, recipient: alice.id, amountKurus: 3000 },
    ]);
    expect(view.settled).toHaveLength(1);
    expect(view.settled[0]!.id).toBe(settlement.id);
    expect(view.settled[0]!.undoneAt).toBe(undone.undoneAt);
  });

  it('by the payer: the same outcome (either party)', async () => {
    const { alice, bob, carol, group, plan } =
      await createStandingValueGroup(ctx.server);

    const settlement = await markPaid(ctx.server, bob.cookie, group.id, plan[0]!);
    const undone = await undoSettlement(
      ctx.server,
      bob.cookie,
      group.id,
      settlement.id,
    );
    expect(undone.status).toBe('UNDONE');
    expect(undone.paidAt).toBe(settlement.paidAt);

    // Same outcomes as the recipient case: balances revert, sum 0, plan
    // re-includes the payment, and the row is retained with `undoneAt`.
    const { balances, sumKurus } = await readBalancesView(
      ctx.server,
      bob.cookie,
      group.id,
    );
    expect(sumKurus).toBe(0);
    expect(balances.get(alice.id)).toBe(6000);
    expect(balances.get(bob.id)).toBe(-3000);
    expect(balances.get(carol.id)).toBe(-3000);

    const view = await readSettlements(ctx.server, bob.cookie, group.id);
    expect(view.outstanding).toHaveLength(2);
    const tuples = view.outstanding
      .map((entry) => ({
        payer: entry.payer.id,
        recipient: entry.recipient.id,
        amountKurus: entry.amountKurus,
      }))
      .sort((a, b) => a.payer.localeCompare(b.payer));
    expect(tuples).toEqual([
      { payer: bob.id, recipient: alice.id, amountKurus: 3000 },
      { payer: carol.id, recipient: alice.id, amountKurus: 3000 },
    ]);
    expect(view.settled).toHaveLength(1);
    expect(view.settled[0]!.id).toBe(settlement.id);
    expect(view.settled[0]!.undoneAt).toBe(undone.undoneAt);
  });
});
