/**
 * TC-EXP-010 — Exact split summing to anything but the amount is rejected (E1)
 * (expense-tracking.md §2; FR-EXP-007 reject side, UC-EXP-001 E1, BR-EXP-006,
 * 03-api-design.md §3b `400 SPLIT_SUM_MISMATCH`).
 *
 * Integration level. Both off-by-one directions are rejected and leave the
 * ledger unchanged.
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

describe('TC-EXP-010 — exact split sum mismatch is rejected', () => {
  it('rejects 4999 and 5001 against a 5000 amount with no expense created', async () => {
    const { alice, bob, carol, group } = await createStandingGroup(ctx.server);

    for (const parts of [
      { [alice.id]: 2000, [bob.id]: 2000, [carol.id]: 999 },
      { [alice.id]: 2000, [bob.id]: 2000, [carol.id]: 1001 },
    ]) {
      const response = await api(ctx.server)
        .post(`/api/groups/${group.id}/expenses`)
        .set(CSRF_HEADERS)
        .set('Cookie', alice.cookie)
        .send({
          description: 'Off by one',
          amountKurus: 5000,
          payerId: alice.id,
          participantIds: [alice.id, bob.id, carol.id],
          splitType: 'EXACT',
          exactAmounts: parts,
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('SPLIT_SUM_MISMATCH');
    }

    // No expense is created in either case — the ledger is unchanged.
    expect(await ctx.prisma.expense.count()).toBe(0);
    expect(await ctx.prisma.expenseShare.count()).toBe(0);
  });
});
