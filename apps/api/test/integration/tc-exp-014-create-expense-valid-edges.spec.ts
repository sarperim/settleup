/**
 * TC-EXP-014 — Zero amount, single participant, payer-not-participant
 * (combined valid edges) (expense-tracking.md §2; BR-EXP-002 payer independent
 * of participants, BR-EXP-010, OQ-EXP-001, OQ-EXP-002).
 *
 * Integration level. Two combined valid edges: the payer may sit outside the
 * split, and a single-participant zero-amount expense is valid.
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

function shareMap(
  shares: ReadonlyArray<{ participant: { id: string }; shareKurus: number }>,
): Record<string, number> {
  return Object.fromEntries(
    shares.map((share) => [share.participant.id, share.shareKurus]),
  );
}

describe('TC-EXP-014 — combined valid edges', () => {
  it('allows a payer outside the split and a single-participant zero expense', async () => {
    const { alice, bob, group } = await createStandingGroup(ctx.server);

    // 1. Payer alice, sole participant bob (payer not a participant).
    const payerOutside = await api(ctx.server)
      .post(`/api/groups/${group.id}/expenses`)
      .set(CSRF_HEADERS)
      .set('Cookie', alice.cookie)
      .send({
        description: 'Payer outside split',
        amountKurus: 10000,
        payerId: alice.id,
        participantIds: [bob.id],
        splitType: 'EQUAL',
      });

    expect(payerOutside.status).toBe(201);
    expect(shareMap(payerOutside.body.expense.shares)).toEqual({
      [bob.id]: 10000,
    });
    expect(payerOutside.body.expense.payer.id).toBe(alice.id);

    // 2. Zero amount, single participant = the payer.
    const zeroSingle = await api(ctx.server)
      .post(`/api/groups/${group.id}/expenses`)
      .set(CSRF_HEADERS)
      .set('Cookie', alice.cookie)
      .send({
        description: 'Zero for one',
        amountKurus: 0,
        payerId: alice.id,
        participantIds: [alice.id],
        splitType: 'EQUAL',
      });

    expect(zeroSingle.status).toBe(201);
    expect(shareMap(zeroSingle.body.expense.shares)).toEqual({ [alice.id]: 0 });
    expect(zeroSingle.body.expense.amountKurus).toBe(0);
  });
});
