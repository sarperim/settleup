/**
 * TC-EXP-008 — Uneven equal split applies the random-spread remainder (A1)
 * (expense-tracking.md §2; FR-EXP-004, FR-EXP-005, UC-EXP-001 A1, ASM-001,
 * BR-EXP-004).
 *
 * Integration level with the **real** CSPRNG, so the extra kuruş's recipient is
 * asserted only structurally (sum, per-share bounds, count of +1 shares) —
 * never as a specific participant assignment (strategy T5).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  api,
  createIntegrationApp,
  CSRF_HEADERS,
  type IntegrationApp,
} from './support/app';
import { truncateAllTables } from './support/truncate';
import { createStandingGroup } from './support/standing-group';

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

describe('TC-EXP-008 — uneven equal split spreads the remainder', () => {
  it('stores shares that sum to 10000, each 3333 or 3334, with exactly one 3334', async () => {
    const { alice, bob, carol, group } = await createStandingGroup(ctx.server);

    const create = await api(ctx.server)
      .post(`/api/groups/${group.id}/expenses`)
      .set(CSRF_HEADERS)
      .set('Cookie', alice.cookie)
      .send({
        description: 'Lunch',
        amountKurus: 10000,
        payerId: alice.id,
        participantIds: [alice.id, bob.id, carol.id],
        splitType: 'EQUAL',
      });

    expect(create.status).toBe(201);
    const shares: Array<{ participant: { id: string }; shareKurus: number }> =
      create.body.expense.shares;

    // Exactly one row per participant.
    expect(shares).toHaveLength(3);
    expect(new Set(shares.map((share) => share.participant.id)).size).toBe(3);

    // Shares sum exactly to the amount (NFR-EXP-003).
    const total = shares.reduce((sum, share) => sum + share.shareKurus, 0);
    expect(total).toBe(10000);

    // Each share is 3333 or 3334, and exactly one participant holds 3334
    // (r = 1) — the specific recipient is not asserted (random draw, T5).
    for (const share of shares) {
      expect([3333, 3334]).toContain(share.shareKurus);
    }
    expect(shares.filter((share) => share.shareKurus === 3334)).toHaveLength(1);

    // The stored shares are returned and are the expense's permanent record.
    const persisted = await ctx.prisma.expenseShare.findMany({
      where: { expenseId: create.body.expense.id },
      select: { shareKurus: true },
    });
    expect(persisted.reduce((sum, share) => sum + share.shareKurus, 0)).toBe(
      10000,
    );
  });
});
