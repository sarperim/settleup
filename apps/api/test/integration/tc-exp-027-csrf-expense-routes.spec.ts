/**
 * TC-EXP-027 — CSRF header required on all expense state-changing routes
 * (expense-tracking.md §2; 03-api-design.md §1, 01-system-architecture.md
 * §8.2).
 *
 * Integration level. POST, PATCH and DELETE against the expense routes without
 * `X-Requested-With` are each rejected `403 CSRF_HEADER_MISSING` before any
 * handler runs, and have no side effect: no expense is created and the existing
 * expense is unchanged (description, shares, no `editedAt`).
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

describe('TC-EXP-027 — CSRF header on expense state-changing routes', () => {
  it('rejects POST/PATCH/DELETE without the header and applies no side effect', async () => {
    const { alice, bob, carol, group } = await createStandingGroup(ctx.server);
    const created = await createExpense(ctx.server, alice.cookie, group.id, {
      description: 'Dinner',
      amountKurus: 9000,
      payerId: alice.id,
      participantIds: [alice.id, bob.id, carol.id],
      splitType: 'EQUAL',
    });

    // POST without the header (valid body).
    const post = await api(ctx.server)
      .post(`/api/groups/${group.id}/expenses`)
      .set('Cookie', alice.cookie)
      .send({
        description: 'Sneaky',
        amountKurus: 1000,
        payerId: alice.id,
        participantIds: [alice.id],
        splitType: 'EQUAL',
      });
    expect(post.status).toBe(403);
    expect(post.body.error.code).toBe('CSRF_HEADER_MISSING');

    // PATCH without the header (valid change).
    const patch = await api(ctx.server)
      .patch(`/api/groups/${group.id}/expenses/${created.id}`)
      .set('Cookie', alice.cookie)
      .send({ description: 'Tampered' });
    expect(patch.status).toBe(403);
    expect(patch.body.error.code).toBe('CSRF_HEADER_MISSING');

    // DELETE without the header.
    const del = await api(ctx.server)
      .delete(`/api/groups/${group.id}/expenses/${created.id}`)
      .set('Cookie', alice.cookie);
    expect(del.status).toBe(403);
    expect(del.body.error.code).toBe('CSRF_HEADER_MISSING');

    // No side effect: the ledger holds exactly the one expense, unchanged.
    const list = await api(ctx.server)
      .get(`/api/groups/${group.id}/expenses`)
      .set('Cookie', alice.cookie);
    expect(list.status).toBe(200);
    expect(list.body.expenses).toHaveLength(1);

    const detail = await api(ctx.server)
      .get(`/api/groups/${group.id}/expenses/${created.id}`)
      .set('Cookie', alice.cookie);
    expect(detail.status).toBe(200);
    const expense = detail.body.expense;
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
