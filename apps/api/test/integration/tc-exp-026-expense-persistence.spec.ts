/**
 * TC-EXP-026 — Expenses persist until their logger deletes them (NFR-EXP-005)
 * (expense-tracking.md §2; NFR-EXP-005, BR-EXP-011 context, UC-EXP-001
 * postcondition).
 *
 * Integration level. Alice logs E1 and E2; she edits E1's description and
 * deletes E2. E1 remains readable with the edit applied — no archiving, TTL or
 * cascade from unrelated operations — while E2 is gone: the only removal path
 * is its logger's delete.
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

describe('TC-EXP-026 — persistence until the logger deletes', () => {
  it('keeps an edited expense and removes only the deleted one', async () => {
    const { alice, bob, carol, group } = await createStandingGroup(ctx.server);

    const e1 = await createExpense(ctx.server, alice.cookie, group.id, {
      description: 'First',
      amountKurus: 9000,
      payerId: alice.id,
      participantIds: [alice.id, bob.id, carol.id],
      splitType: 'EQUAL',
    });
    const e2 = await createExpense(ctx.server, alice.cookie, group.id, {
      description: 'Second',
      amountKurus: 3000,
      payerId: alice.id,
      participantIds: [alice.id, bob.id],
      splitType: 'EQUAL',
    });

    const edit = await api(ctx.server)
      .patch(`/api/groups/${group.id}/expenses/${e1.id}`)
      .set(CSRF_HEADERS)
      .set('Cookie', alice.cookie)
      .send({ description: 'First (edited)' });
    expect(edit.status).toBe(200);

    const del = await api(ctx.server)
      .delete(`/api/groups/${group.id}/expenses/${e2.id}`)
      .set(CSRF_HEADERS)
      .set('Cookie', alice.cookie);
    expect(del.status).toBe(204);

    const detail = await api(ctx.server)
      .get(`/api/groups/${group.id}/expenses/${e1.id}`)
      .set('Cookie', alice.cookie);
    expect(detail.status).toBe(200);
    expect(detail.body.expense.description).toBe('First (edited)');
    expect(typeof detail.body.expense.editedAt).toBe('string');

    const list = await api(ctx.server)
      .get(`/api/groups/${group.id}/expenses`)
      .set('Cookie', alice.cookie);
    expect(list.status).toBe(200);
    const ids = list.body.expenses.map((e: { id: string }) => e.id);
    expect(ids).toContain(e1.id);
    expect(ids).not.toContain(e2.id);
  });
});
