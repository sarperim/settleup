/**
 * TC-BAL-015 — Undoing an already-undone settlement is rejected
 * (balances-settlement.md §2; 03-api-design.md §4 `ALREADY_UNDONE`,
 * 02-data-model.md §5.2, UC-BAL-004 error side).
 *
 * Integration level. A payment is settled and undone once by a party; a second
 * undo by a party is `409 ALREADY_UNDONE` and the stored row is unchanged —
 * still `UNDONE` with exactly one (unmodified) `undoneAt`, no second effect on
 * the balances.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  api,
  createIntegrationApp,
  CSRF_HEADERS,
  type IntegrationApp,
} from './support/app';
import {
  createStandingValueGroup,
  errorCode,
  markPaid,
  readBalances,
  undoSettlement,
} from './support/settlements';
import { truncateAllTables } from './support/truncate';

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

describe('TC-BAL-015 — double undo is rejected', () => {
  it('returns ALREADY_UNDONE and leaves the row unchanged', async () => {
    const { alice, bob, group, plan } =
      await createStandingValueGroup(ctx.server);

    const settlement = await markPaid(ctx.server, bob.cookie, group.id, plan[0]!);
    const undone = await undoSettlement(
      ctx.server,
      alice.cookie,
      group.id,
      settlement.id,
    );

    // 1. A second undo by a party (bob) is rejected.
    const second = await api(ctx.server)
      .post(`/api/groups/${group.id}/settlements/${settlement.id}/undo`)
      .set(CSRF_HEADERS)
      .set('Cookie', bob.cookie);
    expect(second.status).toBe(409);
    expect(errorCode(second.body)).toBe('ALREADY_UNDONE');

    // 2. The stored row is unchanged — still UNDONE with exactly one, unmodified
    //    undoneAt; balances were not affected a second time.
    const row = await ctx.prisma.settledPayment.findUnique({
      where: { id: settlement.id },
    });
    expect(row?.status).toBe('UNDONE');
    expect(row?.undoneAt?.toISOString()).toBe(undone.undoneAt);
    expect(row?.paidAt.toISOString()).toBe(settlement.paidAt);

    const balances = await readBalances(ctx.server, alice.cookie, group.id);
    expect(balances.get(alice.id)).toBe(6000);
    expect(balances.get(bob.id)).toBe(-3000);
  });
});
