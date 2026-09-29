/**
 * TC-EXP-021 — Group ledger lists all expenses, newest first (UC-EXP-004 main)
 * (expense-tracking.md §2; FR-EXP-011, NFR-EXP-004 list shape, 02-data-model.md
 * §4 `@@index([groupId, createdAt])`, 03-api-design.md §3b list row).
 *
 * Integration level. Three expenses are logged through the public API in the
 * fixture group; a fourth is logged in a second group. The list must return
 * exactly the first group's three — group-scoped only — ordered by `createdAt`
 * descending, with the most recently created first.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  api,
  createIntegrationApp,
  type IntegrationApp,
} from './support/app';
import { truncateAllTables } from './support/truncate';
import { createExpense, createGroup } from './support/factories';
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

describe('TC-EXP-021 — group ledger list, newest first, group-scoped', () => {
  it('returns exactly the group’s expenses, sorted by createdAt descending', async () => {
    const { alice, bob, carol, group } = await createStandingGroup(ctx.server);

    // Three expenses in the fixture group, created strictly in order.
    const e1 = await createExpense(ctx.server, alice.cookie, group.id, {
      description: 'First',
      amountKurus: 900,
      payerId: alice.id,
      participantIds: [alice.id, bob.id, carol.id],
      splitType: 'EQUAL',
    });
    const e2 = await createExpense(ctx.server, alice.cookie, group.id, {
      description: 'Second',
      amountKurus: 1200,
      payerId: bob.id,
      participantIds: [alice.id, bob.id],
      splitType: 'EQUAL',
    });
    const e3 = await createExpense(ctx.server, alice.cookie, group.id, {
      description: 'Third',
      amountKurus: 500,
      payerId: carol.id,
      participantIds: [alice.id, carol.id],
      splitType: 'EQUAL',
    });

    // One expense in another group the caller also belongs to.
    const otherGroup = await createGroup(ctx.server, alice.cookie, 'Other');
    const foreign = await createExpense(
      ctx.server,
      alice.cookie,
      otherGroup.id,
      {
        description: 'Foreign',
        amountKurus: 777,
        payerId: alice.id,
        participantIds: [alice.id],
        splitType: 'EQUAL',
      },
    );

    // GET the fixture group's ledger as a member (bob).
    const response = await api(ctx.server)
      .get(`/api/groups/${group.id}/expenses`)
      .set('Cookie', bob.cookie);

    expect(response.status).toBe(200);
    expect(Object.keys(response.body)).toEqual(['expenses']);

    const expenses = response.body.expenses as Array<{
      id: string;
      createdAt: string;
    }>;

    // Exactly the group's three expenses — the other group's expense is absent
    // (group scoping).
    expect(expenses.map((expense) => expense.id).sort()).toEqual(
      [e1.id, e2.id, e3.id].sort(),
    );
    expect(expenses.map((expense) => expense.id)).not.toContain(foreign.id);

    // Sorted by `createdAt` descending: every adjacent pair is non-increasing
    // and the most recently created expense is first.
    for (let i = 1; i < expenses.length; i += 1) {
      const previous = Date.parse(expenses[i - 1]!.createdAt);
      const current = Date.parse(expenses[i]!.createdAt);
      expect(Number.isNaN(previous)).toBe(false);
      expect(Number.isNaN(current)).toBe(false);
      expect(previous).toBeGreaterThanOrEqual(current);
    }
    expect(expenses[0]!.id).toBe(e3.id);
  });
});
