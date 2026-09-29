/**
 * TC-BAL-008 — All-zero group shows nothing owed (UC-BAL-002 A1)
 * (balances-settlement.md §2; UC-BAL-002 A1, FR-BAL-005, BR-BAL-005,
 * 03-api-design.md §3c).
 *
 * Integration level. Two groups are compared:
 *   (a) a group with no expenses at all (the standing fixture);
 *   (b) a group whose single expense nets everyone to zero — alice pays 5000
 *       with an EXACT split `{alice: 5000}` (single participant).
 *
 * Both must expose an empty `outstanding` plan, all-zero balances and
 * `sumKurus = 0` — a group whose balances are all zero is indistinguishable in
 * output shape from an empty one (UC-BAL-002 A1).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  api,
  createIntegrationApp,
  type IntegrationApp,
} from './support/app';
import { createExpense, createGroup } from './support/factories';
import { createStandingGroup } from './support/standing-group';
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

interface BalanceEntry {
  member: { id: string; displayName: string };
  balanceKurus: number;
}

describe('TC-BAL-008 — all-zero group shows nothing owed', () => {
  it('returns empty outstanding and all-zero balances for both an empty and a nets-to-zero group', async () => {
    // (a) A group with no expenses at all — the standing fixture.
    const { alice, bob, carol, group: emptyGroup } =
      await createStandingGroup(ctx.server);

    // (b) A group whose single expense nets everyone to zero: alice pays 5000,
    // EXACT split over the single participant alice.
    const zeroGroup = await createGroup(ctx.server, alice.cookie, 'Solo');
    await createExpense(ctx.server, alice.cookie, zeroGroup.id, {
      description: 'Solo self-payment',
      amountKurus: 5000,
      payerId: alice.id,
      participantIds: [alice.id],
      splitType: 'EXACT',
      exactAmounts: { [alice.id]: 5000 },
    });

    // Read both views for both groups, as members.
    const emptySettlements = await api(ctx.server)
      .get(`/api/groups/${emptyGroup.id}/settlements`)
      .set('Cookie', bob.cookie);
    const emptyBalances = await api(ctx.server)
      .get(`/api/groups/${emptyGroup.id}/balances`)
      .set('Cookie', bob.cookie);
    const zeroSettlements = await api(ctx.server)
      .get(`/api/groups/${zeroGroup.id}/settlements`)
      .set('Cookie', alice.cookie);
    const zeroBalances = await api(ctx.server)
      .get(`/api/groups/${zeroGroup.id}/balances`)
      .set('Cookie', alice.cookie);

    // Both settlement views: empty outstanding, empty settled.
    for (const response of [emptySettlements, zeroSettlements]) {
      expect(response.status).toBe(200);
      expect(response.body.outstanding).toEqual([]);
      expect(response.body.settled).toEqual([]);
    }

    // Both balance views: one entry per member, all exactly zero, sum 0.
    for (const response of [emptyBalances, zeroBalances]) {
      expect(response.status).toBe(200);
      const balances = response.body.balances as BalanceEntry[];
      expect(balances.length).toBeGreaterThan(0);
      for (const entry of balances) {
        expect(entry.balanceKurus).toBe(0);
      }
      expect(response.body.sumKurus).toBe(0);
    }

    // The empty group has exactly its three members; the nets-to-zero group
    // has exactly its single member (alice).
    expect((emptyBalances.body.balances as BalanceEntry[]).length).toBe(3);
    expect((zeroBalances.body.balances as BalanceEntry[]).length).toBe(1);
    expect((zeroBalances.body.balances as BalanceEntry[])[0]!.member.id).toBe(
      alice.id,
    );
    expect(alice.id).toBeDefined();
    expect(carol.id).toBeDefined();
  });
});
