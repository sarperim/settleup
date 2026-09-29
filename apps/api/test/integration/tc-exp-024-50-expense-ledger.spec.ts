/**
 * TC-EXP-024 — 50-expense ledger correctness at expected scale
 * (expense-tracking.md §2; NFR-EXP-004, brief §7 "20–50 expenses per trip",
 * 03-api-design.md §3b list row).
 *
 * Integration level. The standing group fixture (3 members) receives 50
 * expenses through the public API in a fixed deterministic mix — rotating payer,
 * EQUAL even/uneven and EXACT splits, descriptions "E01"…"E50". The ledger must
 * return exactly 50 rows newest-first with one full list (no pagination), every
 * expense's shares summing to its amount, and the balances view must report
 * `sumKurus === 0` across the full ledger.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  api,
  createIntegrationApp,
  type IntegrationApp,
} from './support/app';
import { createExpense, type CreatedExpense } from './support/factories';
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

/** `Σ shareKurus` of an expense as returned by the API. */
function sharesSum(
  expense: Readonly<{
    shares: ReadonlyArray<{ shareKurus: number }>;
  }>,
): number {
  return expense.shares.reduce((sum, share) => sum + share.shareKurus, 0);
}

describe('TC-EXP-024 — 50-expense ledger at expected scale', () => {
  it('lists exactly 50 expenses newest-first with zero-sum across the ledger', async () => {
    const { alice, bob, carol, group } = await createStandingGroup(ctx.server);
    const members = [alice, bob, carol];

    const created: CreatedExpense[] = [];
    for (let i = 1; i <= 50; i += 1) {
      const description = `E${String(i).padStart(2, '0')}`;
      const payer = members[i % members.length]!;
      const participants = [alice.id, bob.id, carol.id];

      if (i % 2 === 1) {
        // EQUAL — even or uneven depending on the amount.
        const amountKurus = 3000 + i * 7;
        const expense = await createExpense(ctx.server, alice.cookie, group.id, {
          description,
          amountKurus,
          payerId: payer.id,
          participantIds: participants,
          splitType: 'EQUAL',
        });
        // Seed validity: shares sum exactly to the amount.
        expect(sharesSum(expense)).toBe(amountKurus);
        created.push(expense);
      } else {
        // EXACT — deterministic per-participant split.
        const amountKurus = 1000 + i * 13;
        const first = Math.floor(amountKurus / 2);
        const second = Math.floor(amountKurus / 4);
        const third = amountKurus - first - second;
        const expense = await createExpense(ctx.server, alice.cookie, group.id, {
          description,
          amountKurus,
          payerId: payer.id,
          participantIds: participants,
          splitType: 'EXACT',
          exactAmounts: {
            [alice.id]: first,
            [bob.id]: second,
            [carol.id]: third,
          },
        });
        expect(sharesSum(expense)).toBe(amountKurus);
        created.push(expense);
      }
    }

    // GET the ledger as a member — one full list, no pagination.
    const listResponse = await api(ctx.server)
      .get(`/api/groups/${group.id}/expenses`)
      .set('Cookie', bob.cookie);

    expect(listResponse.status).toBe(200);
    expect(Object.keys(listResponse.body)).toEqual(['expenses']);

    const expenses = listResponse.body.expenses as CreatedExpense[];
    // Exactly 50 — a single full list, not a page.
    expect(expenses).toHaveLength(50);
    expect(expenses.map((expense) => expense.id).sort()).toEqual(
      created.map((expense) => expense.id).sort(),
    );

    // Every expense's shares sum to its amount (the full set spot-verified).
    for (const expense of expenses) {
      expect(sharesSum(expense)).toBe(expense.amountKurus);
    }
    // Descriptions are exactly E01…E50.
    expect(expenses.map((expense) => expense.description).sort()).toEqual(
      created.map((expense) => expense.description).sort(),
    );

    // Newest first: every adjacent pair is non-increasing and the first row
    // carries the maximum `createdAt`.
    const times = expenses.map((expense) => Date.parse(expense.createdAt));
    for (const time of times) {
      expect(Number.isNaN(time)).toBe(false);
    }
    for (let i = 1; i < times.length; i += 1) {
      expect(times[i - 1]!).toBeGreaterThanOrEqual(times[i]!);
    }
    expect(times[0]).toBe(Math.max(...times));

    // Zero-sum across the full ledger.
    const balancesResponse = await api(ctx.server)
      .get(`/api/groups/${group.id}/balances`)
      .set('Cookie', bob.cookie);

    expect(balancesResponse.status).toBe(200);
    expect(balancesResponse.body.sumKurus).toBe(0);
    const total = (
      balancesResponse.body.balances as ReadonlyArray<{ balanceKurus: number }>
    ).reduce((sum, entry) => sum + entry.balanceKurus, 0);
    expect(total).toBe(0);
  });
});
