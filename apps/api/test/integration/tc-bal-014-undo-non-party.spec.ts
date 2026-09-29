/**
 * TC-BAL-014 — Undo by a member who is neither payer nor recipient is denied
 * (UC-BAL-004 E1) (balances-settlement.md §2; FR-BAL-008 deny side,
 * UC-BAL-004 E1, 03-api-design.md §4 `NOT_PAYMENT_PARTY`, amended 2026-09-25).
 *
 * Integration level. Row a: carol (non-party) undoes a `SETTLED` target.
 * Row b: carol undoes an already-`UNDONE` target — the combined case: the
 * party check precedes `ALREADY_UNDONE`, so the outcome is `403`, not `409`.
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
  readSettlements,
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

describe('TC-BAL-014 — non-party undo is denied', () => {
  it('rejects carol on both a SETTLED and an already-UNDONE target', async () => {
    const { alice, bob, carol, group, plan } =
      await createStandingValueGroup(ctx.server);

    const settlement = await markPaid(ctx.server, bob.cookie, group.id, plan[0]!);

    // Row a: carol undoes the SETTLED payment.
    const rowA = await api(ctx.server)
      .post(`/api/groups/${group.id}/settlements/${settlement.id}/undo`)
      .set(CSRF_HEADERS)
      .set('Cookie', carol.cookie);
    expect(rowA.status).toBe(403);
    expect(errorCode(rowA.body)).toBe('NOT_PAYMENT_PARTY');

    // Row a: still SETTLED, balances unchanged.
    const afterA = await ctx.prisma.settledPayment.findUnique({
      where: { id: settlement.id },
    });
    expect(afterA?.status).toBe('SETTLED');
    expect(afterA?.undoneAt).toBeNull();
    const balancesAfterA = await readBalances(ctx.server, carol.cookie, group.id);
    expect(balancesAfterA.get(alice.id)).toBe(3000);
    expect(balancesAfterA.get(bob.id)).toBe(0);

    // Row b: a party undoes it once → UNDONE, then carol retries.
    const undone = await undoSettlement(
      ctx.server,
      bob.cookie,
      group.id,
      settlement.id,
    );
    const rowB = await api(ctx.server)
      .post(`/api/groups/${group.id}/settlements/${settlement.id}/undo`)
      .set(CSRF_HEADERS)
      .set('Cookie', carol.cookie);
    expect(rowB.status).toBe(403);
    expect(errorCode(rowB.body)).toBe('NOT_PAYMENT_PARTY');

    // Row b: remains UNDONE, unchanged.
    const afterB = await ctx.prisma.settledPayment.findUnique({
      where: { id: settlement.id },
    });
    expect(afterB?.status).toBe('UNDONE');
    expect(afterB?.undoneAt?.toISOString()).toBe(undone.undoneAt);

    const view = await readSettlements(ctx.server, alice.cookie, group.id);
    expect(view.settled).toHaveLength(1);
    expect(view.settled[0]!.undoneAt).toBe(undone.undoneAt);
  });
});
