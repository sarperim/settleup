/**
 * TC-EXP-007 — Log an expense, equal split, even division (UC-EXP-001 main)
 * (expense-tracking.md §2; FR-EXP-001, FR-EXP-004, FR-EXP-006, FR-EXP-010,
 * UC-EXP-001 main steps 1–7, BR-EXP-001, BR-EXP-002, 03-api-design.md §3b).
 *
 * Integration level. 9000 kuruş over 3 participants divides evenly, so the
 * shares are deterministic (3000 each) despite the real CSPRNG remainder draw.
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

/** `{ participantId: shareKurus }` from the response's share list. */
function shareMap(
  shares: ReadonlyArray<{ participant: { id: string }; shareKurus: number }>,
): Record<string, number> {
  return Object.fromEntries(
    shares.map((share) => [share.participant.id, share.shareKurus]),
  );
}

describe('TC-EXP-007 — logging an equal, evenly dividing expense', () => {
  it('creates it as alice (logger + payer) with 3000 shares and the full server-set shape', async () => {
    const { alice, bob, carol, group } = await createStandingGroup(ctx.server);

    // 1. POST .../expenses as alice.
    const create = await api(ctx.server)
      .post(`/api/groups/${group.id}/expenses`)
      .set(CSRF_HEADERS)
      .set('Cookie', alice.cookie)
      .send({
        description: 'Dinner',
        amountKurus: 9000,
        payerId: alice.id,
        participantIds: [alice.id, bob.id, carol.id],
        splitType: 'EQUAL',
      });

    expect(create.status).toBe(201);
    expect(Object.keys(create.body)).toEqual(['expense']);

    const expense = create.body.expense;
    expect(expense.description).toBe('Dinner');
    expect(expense.amountKurus).toBe(9000);
    expect(expense.splitType).toBe('EQUAL');
    // `createdAt` is present and server-set; `editedAt` is absent (never edited).
    expect(typeof expense.createdAt).toBe('string');
    expect(Number.isNaN(Date.parse(expense.createdAt))).toBe(false);
    expect('editedAt' in expense).toBe(false);

    // The expense identifies its logger and payer as alice.
    expect(expense.logger).toMatchObject({
      id: alice.id,
      displayName: 'Alice',
    });
    expect(expense.payer).toMatchObject({
      id: alice.id,
      displayName: 'Alice',
    });

    // Exactly 3 shares, one per participant, each 3000 (even division).
    expect(expense.shares).toHaveLength(3);
    expect(shareMap(expense.shares)).toEqual({
      [alice.id]: 3000,
      [bob.id]: 3000,
      [carol.id]: 3000,
    });
    for (const share of expense.shares) {
      expect(typeof share.participant.displayName).toBe('string');
      expect(share.participant.displayName.length).toBeGreaterThan(0);
    }

    // 2. GET .../expenses/:expenseId as bob — any member may read it.
    const detail = await api(ctx.server)
      .get(`/api/groups/${group.id}/expenses/${expense.id}`)
      .set('Cookie', bob.cookie);

    expect(detail.status).toBe(200);
    expect(detail.body.expense.id).toBe(expense.id);
    expect(detail.body.expense.amountKurus).toBe(9000);
    expect(detail.body.expense.payer.displayName).toBe('Alice');
    expect('editedAt' in detail.body.expense).toBe(false);
    expect(
      Object.values(shareMap(detail.body.expense.shares)).sort((a, b) => a - b),
    ).toEqual([3000, 3000, 3000]);
  });
});
