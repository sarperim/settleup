/**
 * TC-EXP-011 — Empty participant list is rejected (E2)
 * (expense-tracking.md §2; UC-EXP-001 E2, BR-EXP-002 ≥ 1 participant,
 * 03-api-design.md §4 `400 NO_PARTICIPANTS`).
 *
 * Integration level. An empty `participantIds` passes DTO shape validation and
 * is rejected by the service's participant-list check — `NO_PARTICIPANTS`, not
 * `VALIDATION_FAILED` (API §4 service-level precedence).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  api,
  createIntegrationApp,
  CSRF_HEADERS,
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

describe('TC-EXP-011 — empty participant list', () => {
  it('rejects with NO_PARTICIPANTS and creates no expense', async () => {
    const { alice, group } = await createStandingGroup(ctx.server);

    const response = await api(ctx.server)
      .post(`/api/groups/${group.id}/expenses`)
      .set(CSRF_HEADERS)
      .set('Cookie', alice.cookie)
      .send({
        description: 'Nobody',
        amountKurus: 1000,
        payerId: alice.id,
        participantIds: [],
        splitType: 'EQUAL',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('NO_PARTICIPANTS');
    expect(await ctx.prisma.expense.count()).toBe(0);
  });
});
