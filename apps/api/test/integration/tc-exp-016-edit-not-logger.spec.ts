/**
 * TC-EXP-016 — Edit by anyone other than the logger is denied (E2)
 * (expense-tracking.md §2; FR-EXP-008, UC-EXP-002 E2, BR-EXP-007,
 * 03-api-design.md §3b/§4 amended 2026-09-25 — authorization first).
 *
 * Integration level. Alice logs the expense; bob — a member, in fact its payer
 * and a participant — attempts two edits. Both are denied with
 * `403 NOT_LOGGER`, including the second body that is also field-invalid: the
 * logger check precedes field validation (guard order). The expense is
 * unchanged afterwards.
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

describe('TC-EXP-016 — non-logger edit denied (NOT_LOGGER precedes validation)', () => {
  it('denies even a payer/participant and leaves the expense unchanged', async () => {
    const { alice, bob, carol, group } = await createStandingGroup(ctx.server);
    // Bob is the payer *and* a participant; alice is the logger.
    const created = await createExpense(ctx.server, alice.cookie, group.id, {
      description: 'Dinner',
      amountKurus: 9000,
      payerId: bob.id,
      participantIds: [alice.id, bob.id, carol.id],
      splitType: 'EQUAL',
    });

    const step1 = await patchExpense(bob.cookie, group.id, created.id, {
      description: 'Tampered',
    });
    expect(step1.status).toBe(403);
    expect(step1.body.error.code).toBe('NOT_LOGGER');

    // Non-logger submitting an edit that is also field-invalid: the logger
    // check precedes field validation (API §4, amended 2026-09-25).
    const step2 = await patchExpense(bob.cookie, group.id, created.id, {
      amountKurus: -1,
    });
    expect(step2.status).toBe(403);
    expect(step2.body.error.code).toBe('NOT_LOGGER');

    const read = await api(ctx.server)
      .get(`/api/groups/${group.id}/expenses/${created.id}`)
      .set('Cookie', alice.cookie);
    expect(read.status).toBe(200);
    const expense = read.body.expense;
    expect(expense.description).toBe('Dinner');
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
    ).toEqual({
      [alice.id]: 3000,
      [bob.id]: 3000,
      [carol.id]: 3000,
    });
  });
});
