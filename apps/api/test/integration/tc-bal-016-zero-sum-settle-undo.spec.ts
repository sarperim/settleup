/**
 * TC-BAL-016 — Zero-sum holds after settle and undo (SC-005, settlement
 * parameters) (balances-settlement.md §2; SC-005, NFR-BAL-001, OBJ-004,
 * FR-BAL-003, BR-BAL-003, UC-BAL-003/004 postconditions).
 *
 * Integration level. The **settlement half** of the SC-005 operation matrix —
 * the expense half is TC-EXP-023; together they are the full matrix
 * (create / edit / delete / settle / undo). Starting from the standing value
 * fixture, `sumKurus === 0` is asserted after **every** step of the
 * settle → settle → undo → undo sequence, whatever the intermediate balances.
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

describe('TC-BAL-016 — zero-sum holds after settle and undo (SC-005)', () => {
  it('keeps sumKurus === 0 through settle → settle → undo → undo', async () => {
    const { alice, bob, carol, group, plan } =
      await createStandingValueGroup(ctx.server);

    // Baseline: the fixture itself is zero-sum.
    const baseline = await readBalancesView(ctx.server, alice.cookie, group.id);
    expect(baseline.sumKurus).toBe(0);

    // 1. Settle the first suggestion (bob → alice 3000) by its payer.
    const first = await markPaid(ctx.server, bob.cookie, group.id, plan[0]!);
    const afterFirst = await readBalancesView(ctx.server, alice.cookie, group.id);
    expect(afterFirst.sumKurus).toBe(0);
    expect(afterFirst.balances.get(alice.id)).toBe(3000);
    expect(afterFirst.balances.get(bob.id)).toBe(0);
    expect(afterFirst.balances.get(carol.id)).toBe(-3000);

    // 2. Settle the remaining suggestion (carol → alice 3000) by its recipient.
    const second = await markPaid(ctx.server, alice.cookie, group.id, plan[1]!);
    const afterSecond = await readBalancesView(ctx.server, alice.cookie, group.id);
    expect(afterSecond.sumKurus).toBe(0);
    expect(afterSecond.balances.get(alice.id)).toBe(0);
    expect(afterSecond.balances.get(bob.id)).toBe(0);
    expect(afterSecond.balances.get(carol.id)).toBe(0);

    // 3. Undo the first settlement.
    await undoSettlement(ctx.server, bob.cookie, group.id, first.id);
    const afterThird = await readBalancesView(ctx.server, alice.cookie, group.id);
    expect(afterThird.sumKurus).toBe(0);
    expect(afterThird.balances.get(alice.id)).toBe(3000);
    expect(afterThird.balances.get(bob.id)).toBe(-3000);
    expect(afterThird.balances.get(carol.id)).toBe(0);

    // 4. Undo the second settlement — back to the pre-settlement balances.
    await undoSettlement(ctx.server, carol.cookie, group.id, second.id);
    const afterFourth = await readBalancesView(ctx.server, alice.cookie, group.id);
    expect(afterFourth.sumKurus).toBe(0);
    expect(afterFourth.balances.get(alice.id)).toBe(6000);
    expect(afterFourth.balances.get(bob.id)).toBe(-3000);
    expect(afterFourth.balances.get(carol.id)).toBe(-3000);
  });
});
