/**
 * Ledger create input hardening — regression coverage for the round-1 review
 * findings S-1a (blocking), S-1b, K-2/S-1c and K-3/S-1d (PR #23 / TKT-exp-002).
 *
 * Fixer-added (not a plan TC): the `POST /api/groups/:groupId/expenses` fence
 * must reject, with `400 VALIDATION_FAILED` and `details.fields`, an EXACT split
 * whose `exactAmounts` contains a negative, oversized, fractional, or
 * non-participant-keyed value, and must reject a duplicate `participantIds`
 * list — never persisting a share and never surfacing a `500`. The engine's own
 * accept/reject contract is unchanged and remains covered by TC-EXP-009/010.
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

interface Ids {
  readonly alice: string;
  readonly bob: string;
  readonly carol: string;
}

interface Case {
  readonly label: string;
  readonly field: string;
  readonly body: (ids: Ids) => Record<string, unknown>;
}

const cases: readonly Case[] = [
  {
    label: 'negative exactAmounts value whose parts still sum to the amount',
    field: 'exactAmounts',
    body: (ids) => ({
      description: 'Negative share',
      amountKurus: 1000,
      payerId: ids.alice,
      participantIds: [ids.alice, ids.bob, ids.carol],
      splitType: 'EXACT',
      exactAmounts: {
        [ids.alice]: 1500,
        [ids.bob]: -500,
        [ids.carol]: 0,
      },
    }),
  },
  {
    label: 'exactAmounts value above amountKurus (with a negative offset)',
    field: 'exactAmounts',
    body: (ids) => ({
      description: 'Oversized share',
      amountKurus: 0,
      payerId: ids.alice,
      participantIds: [ids.alice, ids.bob],
      splitType: 'EXACT',
      exactAmounts: { [ids.alice]: 1, [ids.bob]: -1 },
    }),
  },
  {
    label: 'fractional exactAmounts value summing in float',
    field: 'exactAmounts',
    body: (ids) => ({
      description: 'Fractional share',
      amountKurus: 1001,
      payerId: ids.alice,
      participantIds: [ids.alice, ids.bob],
      splitType: 'EXACT',
      exactAmounts: { [ids.alice]: 500.5, [ids.bob]: 500.5 },
    }),
  },
  {
    label: 'exactAmounts key outside participantIds',
    field: 'exactAmounts',
    body: (ids) => ({
      description: 'Unknown key',
      amountKurus: 1000,
      payerId: ids.alice,
      participantIds: [ids.alice, ids.bob],
      splitType: 'EXACT',
      exactAmounts: { [ids.alice]: 500, [ids.bob]: 500, 'not-a-participant': 0 },
    }),
  },
  {
    label: 'duplicate participantIds',
    field: 'participantIds',
    body: (ids) => ({
      description: 'Duplicate participants',
      amountKurus: 1000,
      payerId: ids.alice,
      participantIds: [ids.alice, ids.alice, ids.bob],
      splitType: 'EQUAL',
    }),
  },
];

describe('Ledger create input hardening', () => {
  it.each(cases)('rejects $label with 400 and no write', async (row) => {
    const { alice, bob, carol, group } = await createStandingGroup(ctx.server);
    const ids: Ids = { alice: alice.id, bob: bob.id, carol: carol.id };

    const response = await api(ctx.server)
      .post(`/api/groups/${group.id}/expenses`)
      .set(CSRF_HEADERS)
      .set('Cookie', alice.cookie)
      .send(row.body(ids));

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
    expect(response.body.error.details.fields).toContain(row.field);
    // Nothing persisted — no negative/truncated share, no expense.
    expect(await ctx.prisma.expense.count()).toBe(0);
    expect(await ctx.prisma.expenseShare.count()).toBe(0);
  });

  it('still accepts a well-formed EXACT split (control)', async () => {
    const { alice, bob, group } = await createStandingGroup(ctx.server);

    const expense = await createExpense(ctx.server, alice.cookie, group.id, {
      description: 'Exact control',
      amountKurus: 1000,
      payerId: alice.id,
      participantIds: [alice.id, bob.id],
      splitType: 'EXACT',
      // `bob` carries the whole amount; `alice` is a valid 0-kuruş share.
      exactAmounts: { [alice.id]: 0, [bob.id]: 1000 },
    });

    expect(expense.splitType).toBe('EXACT');
    expect(
      Object.fromEntries(
        expense.shares.map((share) => [share.participant.id, share.shareKurus]),
      ),
    ).toEqual({ [alice.id]: 0, [bob.id]: 1000 });
    expect(await ctx.prisma.expense.count()).toBe(1);
  });
});
