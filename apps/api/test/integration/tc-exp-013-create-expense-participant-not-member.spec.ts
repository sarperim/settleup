/**
 * TC-EXP-013 — Payer or participant outside the group is rejected
 * (expense-tracking.md §2; FR-EXP-003, BR-EXP-002 member-only payer/participants,
 * UC-EXP-001 E4 region, 03-api-design.md §4 `400 PARTICIPANT_NOT_MEMBER`).
 *
 * Integration level. Step 3 asserts the amended fixed service precedence
 * (API §4, 2026-09-25): the participation check runs before the split-arithmetic
 * check, so `PARTICIPANT_NOT_MEMBER` beats `SPLIT_SUM_MISMATCH`.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  api,
  createIntegrationApp,
  CSRF_HEADERS,
  type IntegrationApp,
} from './support/app';
import { truncateAllTables } from './support/truncate';
import {
  createStandingGroup,
  registerNonMember,
} from './support/standing-group';

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

const description = 'Invalid membership';

describe('TC-EXP-013 — payer/participant must be a member', () => {
  it('rejects a non-member payer, a non-member participant, and a combined violation by precedence', async () => {
    const { alice, bob, carol, group } = await createStandingGroup(ctx.server);
    const dave = await registerNonMember(ctx.server);

    // 1. Non-member payer (participants valid).
    const payerOutside = await api(ctx.server)
      .post(`/api/groups/${group.id}/expenses`)
      .set(CSRF_HEADERS)
      .set('Cookie', alice.cookie)
      .send({
        description,
        amountKurus: 9000,
        payerId: dave.id,
        participantIds: [alice.id, bob.id, carol.id],
        splitType: 'EQUAL',
      });

    expect(payerOutside.status).toBe(400);
    expect(payerOutside.body.error.code).toBe('PARTICIPANT_NOT_MEMBER');

    // 2. Non-member participant among members.
    const participantOutside = await api(ctx.server)
      .post(`/api/groups/${group.id}/expenses`)
      .set(CSRF_HEADERS)
      .set('Cookie', alice.cookie)
      .send({
        description,
        amountKurus: 9000,
        payerId: alice.id,
        participantIds: [alice.id, bob.id, dave.id],
        splitType: 'EQUAL',
      });

    expect(participantOutside.status).toBe(400);
    expect(participantOutside.body.error.code).toBe('PARTICIPANT_NOT_MEMBER');

    // 3. Combined: sum mismatch AND non-member participant.
    const combined = await api(ctx.server)
      .post(`/api/groups/${group.id}/expenses`)
      .set(CSRF_HEADERS)
      .set('Cookie', alice.cookie)
      .send({
        description,
        amountKurus: 5000,
        payerId: alice.id,
        participantIds: [alice.id, bob.id, dave.id],
        splitType: 'EXACT',
        exactAmounts: { [alice.id]: 1000, [bob.id]: 1000, [dave.id]: 1000 },
      });

    expect(combined.status).toBe(400);
    // Membership precedes split arithmetic (API §4, amended 2026-09-25).
    expect(combined.body.error.code).toBe('PARTICIPANT_NOT_MEMBER');

    // No expense created by any of the three.
    expect(await ctx.prisma.expense.count()).toBe(0);
    expect(await ctx.prisma.expenseShare.count()).toBe(0);
  });
});
