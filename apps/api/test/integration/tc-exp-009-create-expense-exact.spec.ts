/**
 * TC-EXP-009 — Exact split is stored as entered (incl. zero share)
 * (expense-tracking.md §2; FR-EXP-001, FR-EXP-007 accept side, BR-EXP-006,
 * OQ-EXP-003).
 *
 * Integration level. Alice logs an EXACT expense paid by bob; the zero-kuruş
 * participation is preserved and the payer may sit outside the logger role
 * (BR-EXP-001).
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

describe('TC-EXP-009 — exact split stored as entered', () => {
  it('preserves the 0-kuruş share and lets any member log for another payer', async () => {
    const { alice, bob, carol, group } = await createStandingGroup(ctx.server);

    const create = await api(ctx.server)
      .post(`/api/groups/${group.id}/expenses`)
      .set(CSRF_HEADERS)
      .set('Cookie', alice.cookie)
      .send({
        description: 'Tickets',
        amountKurus: 5000,
        payerId: bob.id,
        participantIds: [alice.id, bob.id, carol.id],
        splitType: 'EXACT',
        exactAmounts: { [alice.id]: 0, [bob.id]: 2500, [carol.id]: 2500 },
      });

    expect(create.status).toBe(201);
    const expense = create.body.expense;

    // Shares exactly as entered; the zero-kuruş share is preserved.
    expect(shareMap(expense.shares)).toEqual({
      [alice.id]: 0,
      [bob.id]: 2500,
      [carol.id]: 2500,
    });

    // The payer is bob while the logger is alice (any member may log).
    expect(expense.payer).toMatchObject({ id: bob.id, displayName: 'Bob' });
    expect(expense.logger).toMatchObject({ id: alice.id, displayName: 'Alice' });
    expect(expense.splitType).toBe('EXACT');

    // The zero share is persisted too.
    const persisted = await ctx.prisma.expenseShare.findFirst({
      where: { expenseId: expense.id, participantId: alice.id },
      select: { shareKurus: true },
    });
    expect(persisted?.shareKurus).toBe(0);
  });
});
