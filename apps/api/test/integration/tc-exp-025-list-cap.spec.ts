/**
 * TC-EXP-025 — Defensive list cap beyond 500 expenses (strategy G-5)
 * (expense-tracking.md §2; NFR-EXP-004 defensive cap, arch. §9 flag 4,
 * 03-api-design.md §3b `500 LIST_TOO_LARGE`).
 *
 * Integration level. The ledger rows are seeded directly via Prisma (the
 * strategy §5 scale-fixture permission); fixture validity is asserted —
 * every seeded expense's shares sum exactly to its amount. The boundary is
 * exercised too: exactly 500 rows still returns the full list, the 501st row
 * trips the cap.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  api,
  createIntegrationApp,
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

const PER_EXPENSE_KURUS = 100;
const SHARES = [34, 33, 33] as const;

/** Seed `count` valid EQUAL expenses (shares sum exactly to the amount). */
async function seedExpenses(
  groupId: string,
  participantIds: readonly [string, string, string],
  loggerId: string,
  count: number,
  offset: number,
): Promise<void> {
  const expenses = await ctx.prisma.expense.createManyAndReturn({
    data: Array.from({ length: count }, (_, index) => ({
      groupId,
      description: `Seed ${offset + index}`,
      amountKurus: PER_EXPENSE_KURUS,
      payerId: participantIds[index % participantIds.length]!,
      splitType: 'EQUAL' as const,
      loggerId,
    })),
    select: { id: true },
  });

  await ctx.prisma.expenseShare.createMany({
    data: expenses.flatMap((expense) =>
      participantIds.map((participantId, shareIndex) => ({
        expenseId: expense.id,
        participantId,
        shareKurus: SHARES[shareIndex]!,
      })),
    ),
  });
}

/** Assert every seeded expense's shares sum exactly to its amount. */
async function assertFixtureValidity(groupId: string): Promise<void> {
  const totals = await ctx.prisma.expenseShare.groupBy({
    by: ['expenseId'],
    where: { expense: { groupId } },
    _sum: { shareKurus: true },
  });
  expect(totals).toHaveLength(
    await ctx.prisma.expense.count({ where: { groupId } }),
  );
  for (const total of totals) {
    expect(total._sum.shareKurus).toBe(PER_EXPENSE_KURUS);
  }
}

describe('TC-EXP-025 — defensive list cap at 500', () => {
  it('returns 500 rows at the boundary and 500 LIST_TOO_LARGE at 501', async () => {
    const { alice, bob, carol, group } = await createStandingGroup(ctx.server);
    const participantIds = [alice.id, bob.id, carol.id] as const;

    // 500 rows: still a full list.
    await seedExpenses(group.id, participantIds, alice.id, 500, 0);
    await assertFixtureValidity(group.id);
    expect(await ctx.prisma.expense.count({ where: { groupId: group.id } })).toBe(
      500,
    );

    const atCap = await api(ctx.server)
      .get(`/api/groups/${group.id}/expenses`)
      .set('Cookie', bob.cookie);
    expect(atCap.status).toBe(200);
    expect(atCap.body.expenses).toHaveLength(500);

    // The 501st row trips the defensive cap.
    await seedExpenses(group.id, participantIds, alice.id, 1, 500);
    await assertFixtureValidity(group.id);

    const overCap = await api(ctx.server)
      .get(`/api/groups/${group.id}/expenses`)
      .set('Cookie', bob.cookie);

    expect(overCap.status).toBe(500);
    expect(overCap.body).toEqual({
      error: {
        code: 'LIST_TOO_LARGE',
        message: 'The expense list is too large to return.',
      },
    });
    expect(overCap.body.expenses).toBeUndefined();
  }, 60_000);
});
