/**
 * TC-EXP-018 — Delete an expense by its logger: permanent removal (UC-EXP-003
 * main) (expense-tracking.md §2; FR-EXP-009/012, UC-EXP-003 main, BR-EXP-011,
 * NFR-EXP-005, 02-data-model.md §4 `onDelete: Cascade`, §1 principle 4).
 *
 * Integration level. Alice deletes an unedited expense (E1) and a previously
 * edited one (E2); both vanish from the list and the detail route, and the
 * `expenses` / `expense_shares` tables are read directly to prove a hard delete
 * (cascade, no archive table, no soft-delete flag).
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

describe('TC-EXP-018 — hard delete by the logger', () => {
  it('removes the expense and its shares for unedited and edited expenses', async () => {
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

    // Put E2 in the edited state (TC-EXP-015 state).
    const edited = await api(ctx.server)
      .patch(`/api/groups/${group.id}/expenses/${e2.id}`)
      .set(CSRF_HEADERS)
      .set('Cookie', alice.cookie)
      .send({ description: 'Second (edited)' });
    expect(edited.status).toBe(200);
    expect(typeof edited.body.expense.editedAt).toBe('string');

    // ── Step 1: delete E1 ───────────────────────────────────────────────
    const delete1 = await api(ctx.server)
      .delete(`/api/groups/${group.id}/expenses/${e1.id}`)
      .set(CSRF_HEADERS)
      .set('Cookie', alice.cookie);
    expect(delete1.status).toBe(204);
    expect(delete1.text).toBe('');

    // ── Step 2: list omits E1; detail → 404 ─────────────────────────────
    const list = await api(ctx.server)
      .get(`/api/groups/${group.id}/expenses`)
      .set('Cookie', alice.cookie);
    expect(list.status).toBe(200);
    expect(list.body.expenses.map((e: { id: string }) => e.id)).not.toContain(
      e1.id,
    );

    const detail = await api(ctx.server)
      .get(`/api/groups/${group.id}/expenses/${e1.id}`)
      .set('Cookie', alice.cookie);
    expect(detail.status).toBe(404);
    expect(detail.body.error.code).toBe('NOT_FOUND');

    // ── Step 3: an edited expense is equally deletable ──────────────────
    const delete2 = await api(ctx.server)
      .delete(`/api/groups/${group.id}/expenses/${e2.id}`)
      .set(CSRF_HEADERS)
      .set('Cookie', alice.cookie);
    expect(delete2.status).toBe(204);

    // ── Step 4: DB-level hard delete (cascade) ──────────────────────────
    const expenseRows = await ctx.prisma.expense.findMany({
      where: { id: { in: [e1.id, e2.id] } },
    });
    expect(expenseRows).toHaveLength(0);

    const shareRows = await ctx.prisma.expenseShare.findMany({
      where: { expenseId: { in: [e1.id, e2.id] } },
    });
    expect(shareRows).toHaveLength(0);
  });
});
