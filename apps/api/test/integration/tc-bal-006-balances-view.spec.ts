/**
 * TC-BAL-006 — Balances view: per-member values and zero-sum (UC-BAL-001 main)
 * (balances-settlement.md §2; FR-BAL-001/002/003 read side, UC-BAL-001 main,
 * BR-BAL-001/002/003, SC-005 context, 03-api-design.md §3c balances row).
 *
 * Integration level. The standing value fixture (balances-settlement.md §2):
 * alice logs 9000 kuruş paid by alice with an EXACT split
 * `{alice: 3000, bob: 3000, carol: 3000}` → balances alice +6000, bob −3000,
 * carol −3000, `sumKurus = 0`.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  api,
  createIntegrationApp,
  type IntegrationApp,
} from './support/app';
import { createExpense } from './support/factories';
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

describe('TC-BAL-006 — balances view: per-member values and zero-sum', () => {
  it('returns one entry per member with the derived values and sumKurus 0', async () => {
    const { alice, bob, carol, group } = await createStandingGroup(ctx.server);

    // Standing value fixture: 9000 kuruş, payer alice, EXACT 3000/3000/3000.
    await createExpense(ctx.server, alice.cookie, group.id, {
      description: 'Group dinner',
      amountKurus: 9000,
      payerId: alice.id,
      participantIds: [alice.id, bob.id, carol.id],
      splitType: 'EXACT',
      exactAmounts: { [alice.id]: 3000, [bob.id]: 3000, [carol.id]: 3000 },
    });

    // GET .../balances as bob — any member may read the derived view.
    const response = await api(ctx.server)
      .get(`/api/groups/${group.id}/balances`)
      .set('Cookie', bob.cookie);

    expect(response.status).toBe(200);
    // The response carries exactly `balances` and the always-zero `sumKurus`.
    expect(Object.keys(response.body).sort()).toEqual(['balances', 'sumKurus']);

    const balances = response.body.balances as BalanceEntry[];
    // Exactly one entry per group member.
    expect(balances).toHaveLength(3);

    // Per-member values: payer amount minus own share (9000 − 3000 for alice).
    const byId = Object.fromEntries(
      balances.map((entry) => [entry.member.id, entry.balanceKurus]),
    );
    expect(byId).toEqual({
      [alice.id]: 6000,
      [bob.id]: -3000,
      [carol.id]: -3000,
    });

    // `member` exposes `{ id, displayName }` only — never email (FR-ACC-008).
    for (const entry of balances) {
      expect(Object.keys(entry.member).sort()).toEqual(['displayName', 'id']);
      expect(entry.member.displayName.length).toBeGreaterThan(0);
      expect(JSON.stringify(entry)).not.toContain('@');
    }
    const names = Object.fromEntries(
      balances.map((entry) => [entry.member.id, entry.member.displayName]),
    );
    expect(names[alice.id]).toBe('Alice');
    expect(names[bob.id]).toBe('Bob');
    expect(names[carol.id]).toBe('Carol');

    // The response carries the sum for the UI/tests — exactly integer 0.
    expect(response.body.sumKurus).toBe(0);
  });
});
