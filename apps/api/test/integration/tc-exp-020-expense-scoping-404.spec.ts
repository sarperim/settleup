/**
 * TC-EXP-020 — Nonexistent or cross-group expense id → 404
 * (expense-tracking.md §2; 03-api-design.md §3b 404 NOT_FOUND, FR-EXP-011
 * scoping).
 *
 * Integration level. Alice is a member of groups A and B, with an expense in B.
 * Addressing B's expense through A returns 404, and a missing id under A returns
 * 404 on the read, edit and delete routes — an expense is only addressable
 * through its own group, and a missing id is indistinguishable from a foreign
 * one.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  api,
  createIntegrationApp,
  CSRF_HEADERS,
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

const MISSING_ID = 'clx0000000000000000000000';

describe('TC-EXP-020 — expense ids are addressable only through their group', () => {
  it('returns 404 for a cross-group id on GET and a missing id on PATCH/DELETE', async () => {
    const { alice, group: groupA } = await createStandingGroup(ctx.server);
    const groupB = await createGroup(ctx.server, alice.cookie, 'Other');

    // Only alice belongs to group B; bob is a member of A only.
    const foreign = await createExpense(ctx.server, alice.cookie, groupB.id, {
      description: 'Foreign',
      amountKurus: 777,
      payerId: alice.id,
      participantIds: [alice.id],
      splitType: 'EQUAL',
    });

    // GET B's expense through A.
    const get = await api(ctx.server)
      .get(`/api/groups/${groupA.id}/expenses/${foreign.id}`)
      .set('Cookie', alice.cookie);
    expect(get.status).toBe(404);
    expect(get.body.error.code).toBe('NOT_FOUND');

    // PATCH a missing id under A.
    const patch = await api(ctx.server)
      .patch(`/api/groups/${groupA.id}/expenses/${MISSING_ID}`)
      .set(CSRF_HEADERS)
      .set('Cookie', alice.cookie)
      .send({ description: 'Nope' });
    expect(patch.status).toBe(404);
    expect(patch.body.error.code).toBe('NOT_FOUND');

    // DELETE a missing id under A.
    const del = await api(ctx.server)
      .delete(`/api/groups/${groupA.id}/expenses/${MISSING_ID}`)
      .set(CSRF_HEADERS)
      .set('Cookie', alice.cookie);
    expect(del.status).toBe(404);
    expect(del.body.error.code).toBe('NOT_FOUND');
  });
});
