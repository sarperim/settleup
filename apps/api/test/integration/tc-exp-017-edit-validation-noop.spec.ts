/**
 * TC-EXP-017 — Edit that fails validation leaves the expense unchanged (E1)
 * (expense-tracking.md §2; UC-EXP-002 E1, FR-EXP-002/007 edit side,
 * 03-api-design.md §3b PATCH row, §4 service-level precedence).
 *
 * Integration level. Alice logs an EXACT expense whose stored shares sum to its
 * amount; she then edits the amount alone. The stored exact amounts (the
 * permanent record) no longer sum to the new amount, so the edit must satisfy
 * the same validation as a create and is rejected with `400 SPLIT_SUM_MISMATCH`
 * — the expense and its `editedAt` are untouched.
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

describe('TC-EXP-017 — failed edit leaves the expense unchanged', () => {
  it('rejects an amount change that breaks the stored exact sum', async () => {
    const { alice, bob, group } = await createStandingGroup(ctx.server);
    const created = await createExpense(ctx.server, alice.cookie, group.id, {
      description: 'Tickets',
      amountKurus: 5000,
      payerId: alice.id,
      participantIds: [alice.id, bob.id],
      splitType: 'EXACT',
      exactAmounts: { [alice.id]: 2500, [bob.id]: 2500 },
    });

    const response = await api(ctx.server)
      .patch(`/api/groups/${group.id}/expenses/${created.id}`)
      .set(CSRF_HEADERS)
      .set('Cookie', alice.cookie)
      .send({ amountKurus: 6000 });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('SPLIT_SUM_MISMATCH');

    const read = await api(ctx.server)
      .get(`/api/groups/${group.id}/expenses/${created.id}`)
      .set('Cookie', alice.cookie);
    expect(read.status).toBe(200);
    const expense = read.body.expense;
    expect(expense.amountKurus).toBe(5000);
    expect('editedAt' in expense).toBe(false);
    expect(
      Object.fromEntries(
        expense.shares.map(
          (share: { participant: { id: string }; shareKurus: number }) => [
            share.participant.id,
            share.shareKurus,
          ],
        ),
      ),
    ).toEqual({ [alice.id]: 2500, [bob.id]: 2500 });
  });
});
