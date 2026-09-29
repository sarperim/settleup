/**
 * TC-BAL-017 — Balances never mix across groups (cross-group isolation)
 * (balances-settlement.md §2; BR-BAL-001, FR-BAL-002 "never combining",
 * UC-BAL-001 context; 02-data-model.md §7).
 *
 * Integration level. alice and bob are members of groups A **and** B, but the
 * only expense lives in A (alice payer, EXACT `{alice: 2000, bob: 2000}` over
 * 4000 kuruş). B's balances stay all-zero both before and after A's settlement
 * — balances and settled payments are group-scoped, never netted across groups.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createIntegrationApp,
  type IntegrationApp,
} from './support/app';
import {
  createExpense,
  createGroup,
  joinAndApprove,
  registerUser,
  TEST_PASSWORD,
} from './support/factories';
import {
  markPaid,
  readBalances,
  readSettlements,
  readBalancesView,
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

describe('TC-BAL-017 — balances never mix across groups', () => {
  it('keeps group B all-zero before and after a settlement in group A', async () => {
    const alice = await registerUser(
      ctx.server,
      'alice@test.local',
      TEST_PASSWORD,
      'Alice',
    );
    const bob = await registerUser(ctx.server, 'bob@test.local', TEST_PASSWORD, 'Bob');

    // alice and bob are members of both A and B.
    const groupA = await createGroup(ctx.server, alice.cookie, 'Group A');
    await joinAndApprove(ctx.server, alice.cookie, bob.cookie, groupA.joinCode);
    const groupB = await createGroup(ctx.server, alice.cookie, 'Group B');
    await joinAndApprove(ctx.server, alice.cookie, bob.cookie, groupB.joinCode);

    // An expense exists only in A: 4000 paid by alice, EXACT 2000/2000.
    await createExpense(ctx.server, alice.cookie, groupA.id, {
      description: 'A-only dinner',
      amountKurus: 4000,
      payerId: alice.id,
      participantIds: [alice.id, bob.id],
      splitType: 'EXACT',
      exactAmounts: { [alice.id]: 2000, [bob.id]: 2000 },
    });

    // 1. B's balances are all 0 — A's expense does not leak into B.
    const bBefore = await readBalancesView(ctx.server, alice.cookie, groupB.id);
    expect(bBefore.sumKurus).toBe(0);
    expect(bBefore.balances.get(alice.id)).toBe(0);
    expect(bBefore.balances.get(bob.id)).toBe(0);
    for (const value of bBefore.balances.values()) {
      expect(value).toBe(0);
    }

    // Sanity: A's expense produced a nonzero, zero-sum balance in A.
    const aBalances = await readBalances(ctx.server, alice.cookie, groupA.id);
    expect(aBalances.get(alice.id)).toBe(2000);
    expect(aBalances.get(bob.id)).toBe(-2000);

    // 2. Settle the outstanding suggestion in A (bob → alice 2000).
    const view = await readSettlements(ctx.server, alice.cookie, groupA.id);
    expect(view.outstanding).toHaveLength(1);
    const suggestion = view.outstanding[0]!;
    await markPaid(ctx.server, bob.cookie, groupA.id, {
      payerId: suggestion.payer.id,
      recipientId: suggestion.recipient.id,
      amountKurus: suggestion.amountKurus,
    });

    // A's balances changed (now zero); B's remain untouched and all-zero.
    const aAfter = await readBalancesView(ctx.server, alice.cookie, groupA.id);
    expect(aAfter.sumKurus).toBe(0);
    expect(aAfter.balances.get(alice.id)).toBe(0);
    expect(aAfter.balances.get(bob.id)).toBe(0);

    const bAfter = await readBalancesView(ctx.server, alice.cookie, groupB.id);
    expect(bAfter.sumKurus).toBe(0);
    expect(bAfter.balances.get(alice.id)).toBe(0);
    expect(bAfter.balances.get(bob.id)).toBe(0);
    for (const value of bAfter.balances.values()) {
      expect(value).toBe(0);
    }

    // A settlement is group-scoped too: B's settle-up view stays empty.
    const bSettlements = await readSettlements(ctx.server, alice.cookie, groupB.id);
    expect(bSettlements.outstanding).toEqual([]);
    expect(bSettlements.settled).toEqual([]);
  });
});
