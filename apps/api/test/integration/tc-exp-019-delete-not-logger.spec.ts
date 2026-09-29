/**
 * TC-EXP-019 — Delete by anyone other than the logger is denied (E1)
 * (expense-tracking.md §2; FR-EXP-009, UC-EXP-003 E1, BR-EXP-007,
 * 03-api-design.md §3b DELETE row).
 *
 * Integration level. Alice logs an expense; bob (a member) attempts the delete
 * and is denied with `403 NOT_LOGGER`; the expense remains readable and
 * unchanged.
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

describe('TC-EXP-019 — non-logger delete denied', () => {
  it('rejects a member non-logger with NOT_LOGGER and keeps the expense', async () => {
    const { alice, bob, carol, group } = await createStandingGroup(ctx.server);
    const created = await createExpense(ctx.server, alice.cookie, group.id, {
      description: 'Dinner',
      amountKurus: 9000,
      payerId: alice.id,
      participantIds: [alice.id, bob.id, carol.id],
      splitType: 'EQUAL',
    });

    const denied = await api(ctx.server)
      .delete(`/api/groups/${group.id}/expenses/${created.id}`)
      .set(CSRF_HEADERS)
      .set('Cookie', bob.cookie);
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('NOT_LOGGER');

    const read = await api(ctx.server)
      .get(`/api/groups/${group.id}/expenses/${created.id}`)
      .set('Cookie', alice.cookie);
    expect(read.status).toBe(200);
    expect(read.body.expense.description).toBe('Dinner');
    expect('editedAt' in read.body.expense).toBe(false);
  });
});
