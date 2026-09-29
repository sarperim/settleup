/**
 * TC-EXP-015 — Edit an expense by its logger (parameterized over changed
 * fields) (expense-tracking.md §2; FR-EXP-006/008/010, UC-EXP-002 main,
 * BR-EXP-005/007, 03-api-design.md §3b PATCH row, 01-system-architecture.md
 * §5.1 recompute rule).
 *
 * Integration level. Each row starts from a clean fixture (`beforeEach`
 * truncates) and drives `PATCH /api/groups/:groupId/expenses/:expenseId` as the
 * logger (alice). Rows a and e prove the stored shares are the permanent record
 * (BR-EXP-005): a description-only or payer-only edit recomputes nothing. Rows
 * b–d and f prove the recompute triggers (amount / participants / splitType).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  api,
  createIntegrationApp,
  CSRF_HEADERS,
  type IntegrationApp,
} from './support/app';
import { truncateAllTables } from './support/truncate';
import { createExpense } from './support/factories';
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

/** PATCH the expense as `cookie`. */
function patchExpense(
  cookie: string,
  groupId: string,
  expenseId: string,
  body: Record<string, unknown>,
) {
  return api(ctx.server)
    .patch(`/api/groups/${groupId}/expenses/${expenseId}`)
    .set(CSRF_HEADERS)
    .set('Cookie', cookie)
    .send(body);
}

/** A share vector keyed by participant id. */
function shareMap(shares: Array<{ participant: { id: string }; shareKurus: number }>) {
  return Object.fromEntries(
    shares.map((share) => [share.participant.id, share.shareKurus]),
  );
}

describe('TC-EXP-015 — edit by the logger, recompute iff triggered', () => {
  it('row a — description-only edit leaves the stored shares untouched and sets editedAt', async () => {
    const { alice, bob, carol, group } = await createStandingGroup(ctx.server);
    const created = await createExpense(ctx.server, alice.cookie, group.id, {
      description: 'Dinner',
      amountKurus: 9000,
      payerId: alice.id,
      participantIds: [alice.id, bob.id, carol.id],
      splitType: 'EQUAL',
    });

    const response = await patchExpense(alice.cookie, group.id, created.id, {
      description: 'Dinner 2',
    });

    expect(response.status).toBe(200);
    const expense = response.body.expense;
    expect(expense.description).toBe('Dinner 2');
    expect(expense.amountKurus).toBe(9000);
    expect(expense.splitType).toBe('EQUAL');
    // No recompute, no fresh draw: the stored permanent record is returned as
    // is (BR-EXP-005).
    expect(shareMap(expense.shares)).toEqual({
      [alice.id]: 3000,
      [bob.id]: 3000,
      [carol.id]: 3000,
    });
    expect(typeof expense.editedAt).toBe('string');
    expect(Date.parse(expense.editedAt)).toBeGreaterThanOrEqual(
      Date.parse(expense.createdAt),
    );
  });

  it('row b — amount change recomputes the shares', async () => {
    const { alice, bob, carol, group } = await createStandingGroup(ctx.server);
    const created = await createExpense(ctx.server, alice.cookie, group.id, {
      description: 'Dinner',
      amountKurus: 9000,
      payerId: alice.id,
      participantIds: [alice.id, bob.id, carol.id],
      splitType: 'EQUAL',
    });

    const response = await patchExpense(alice.cookie, group.id, created.id, {
      amountKurus: 12000,
    });

    expect(response.status).toBe(200);
    const expense = response.body.expense;
    expect(expense.amountKurus).toBe(12000);
    const shares = shareMap(expense.shares);
    expect(shares).toEqual({
      [alice.id]: 4000,
      [bob.id]: 4000,
      [carol.id]: 4000,
    });
    expect(
      Object.values(shares).reduce((sum, value) => sum + value, 0),
    ).toBe(12000);
    expect(typeof expense.editedAt).toBe('string');
  });

  it('row c — participant change recomputes over the new set', async () => {
    const { alice, bob, carol, group } = await createStandingGroup(ctx.server);
    const created = await createExpense(ctx.server, alice.cookie, group.id, {
      description: 'Dinner',
      amountKurus: 9000,
      payerId: alice.id,
      participantIds: [alice.id, bob.id, carol.id],
      splitType: 'EQUAL',
    });

    const response = await patchExpense(alice.cookie, group.id, created.id, {
      participantIds: [alice.id, bob.id],
    });

    expect(response.status).toBe(200);
    const expense = response.body.expense;
    expect(shareMap(expense.shares)).toEqual({
      [alice.id]: 4500,
      [bob.id]: 4500,
    });
    expect(expense.shares).toHaveLength(2);
    expect(typeof expense.editedAt).toBe('string');
  });

  it('row d — splitType EQUAL → EXACT stores the exact amounts as entered', async () => {
    const { alice, bob, carol, group } = await createStandingGroup(ctx.server);
    const created = await createExpense(ctx.server, alice.cookie, group.id, {
      description: 'Dinner',
      amountKurus: 9000,
      payerId: alice.id,
      participantIds: [alice.id, bob.id, carol.id],
      splitType: 'EQUAL',
    });

    const response = await patchExpense(alice.cookie, group.id, created.id, {
      splitType: 'EXACT',
      exactAmounts: { [alice.id]: 9000, [bob.id]: 0, [carol.id]: 0 },
    });

    expect(response.status).toBe(200);
    const expense = response.body.expense;
    expect(expense.splitType).toBe('EXACT');
    expect(shareMap(expense.shares)).toEqual({
      [alice.id]: 9000,
      [bob.id]: 0,
      [carol.id]: 0,
    });
    expect(typeof expense.editedAt).toBe('string');
  });

  it('row e — payer-only change leaves the stored shares untouched', async () => {
    const { alice, bob, carol, group } = await createStandingGroup(ctx.server);
    const created = await createExpense(ctx.server, alice.cookie, group.id, {
      description: 'Dinner',
      amountKurus: 9000,
      payerId: alice.id,
      participantIds: [alice.id, bob.id, carol.id],
      splitType: 'EQUAL',
    });

    const response = await patchExpense(alice.cookie, group.id, created.id, {
      payerId: bob.id,
    });

    expect(response.status).toBe(200);
    const expense = response.body.expense;
    expect(expense.payer).toMatchObject({ id: bob.id, displayName: 'Bob' });
    // A payer change is not a recompute trigger (FR-EXP-006) — the stored
    // shares are returned untouched (BR-EXP-005).
    expect(shareMap(expense.shares)).toEqual({
      [alice.id]: 3000,
      [bob.id]: 3000,
      [carol.id]: 3000,
    });
    expect(typeof expense.editedAt).toBe('string');
  });

  it('row f — splitType EXACT → EQUAL recomputes per the equal rule (structural)', async () => {
    const { alice, bob, carol, group } = await createStandingGroup(ctx.server);
    const created = await createExpense(ctx.server, alice.cookie, group.id, {
      description: 'Tickets',
      amountKurus: 5000,
      payerId: alice.id,
      participantIds: [alice.id, bob.id, carol.id],
      splitType: 'EXACT',
      exactAmounts: { [alice.id]: 0, [bob.id]: 2500, [carol.id]: 2500 },
    });

    const response = await patchExpense(alice.cookie, group.id, created.id, {
      splitType: 'EQUAL',
      amountKurus: 5000,
    });

    expect(response.status).toBe(200);
    const expense = response.body.expense;
    expect(expense.splitType).toBe('EQUAL');
    const values = expense.shares.map(
      (share: { shareKurus: number }) => share.shareKurus,
    );
    // Structural assertion (random draw — testing conventions T5): sum exact,
    // every share base or base+1, exactly r = 2 shares of 1667.
    expect(values.reduce((sum: number, value: number) => sum + value, 0)).toBe(
      5000,
    );
    expect(values.every((value: number) => value === 1666 || value === 1667)).toBe(
      true,
    );
    expect(values.filter((value: number) => value === 1667)).toHaveLength(2);
    expect(typeof expense.editedAt).toBe('string');
  });
});
