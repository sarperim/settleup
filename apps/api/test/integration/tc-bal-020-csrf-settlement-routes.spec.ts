/**
 * TC-BAL-020 — CSRF header required on the settlement state-changing routes
 * (balances-settlement.md §2; 03-api-design.md §1 CSRF, 01-system-architecture.md
 * §8.2).
 *
 * Integration level. `POST …/settlements` (valid triple) and
 * `POST …/settlements/:id/undo` — each **without** `X-Requested-With`, as a
 * party — are rejected `403 CSRF_HEADER_MISSING` before any handler runs, with
 * no side effect: no settlement is created and the existing one stays
 * `SETTLED`.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  api,
  createIntegrationApp,
  type IntegrationApp,
} from './support/app';
import {
  createStandingValueGroup,
  errorCode,
  markPaid,
  readSettlements,
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

describe('TC-BAL-020 — CSRF header on the settlement state-changing routes', () => {
  it('rejects mark-paid and undo without the header and applies no side effect', async () => {
    const { alice, bob, carol, group, plan } =
      await createStandingValueGroup(ctx.server);

    // Precondition: one settled payment and one live suggestion.
    const settled = await markPaid(ctx.server, bob.cookie, group.id, plan[0]!);
    const live = plan[1]!; // carol → alice 3000

    // Mark-paid without the header (valid triple, caller is a party).
    const mark = await api(ctx.server)
      .post(`/api/groups/${group.id}/settlements`)
      .set('Cookie', carol.cookie)
      .send(live);
    expect(mark.status).toBe(403);
    expect(errorCode(mark.body)).toBe('CSRF_HEADER_MISSING');

    // Undo without the header (caller is a party to the settled payment).
    const undo = await api(ctx.server)
      .post(`/api/groups/${group.id}/settlements/${settled.id}/undo`)
      .set('Cookie', bob.cookie);
    expect(undo.status).toBe(403);
    expect(errorCode(undo.body)).toBe('CSRF_HEADER_MISSING');

    // No side effect: the live suggestion is still outstanding and the stored
    // fact is unchanged.
    const view = await readSettlements(ctx.server, alice.cookie, group.id);
    const outstanding = view.outstanding
      .map((entry) => ({
        payer: entry.payer.id,
        recipient: entry.recipient.id,
        amountKurus: entry.amountKurus,
      }))
      .sort((a, b) => a.payer.localeCompare(b.payer));
    expect(outstanding).toEqual([
      { payer: carol.id, recipient: alice.id, amountKurus: 3000 },
    ]);
    expect(view.settled).toHaveLength(1);
    expect(view.settled[0]!.id).toBe(settled.id);
    expect(view.settled[0]!.undoneAt).toBeUndefined();

    // Direct read: still exactly one row, still SETTLED with no undoneAt.
    const rows = await ctx.prisma.settledPayment.findMany({
      where: { groupId: group.id },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(settled.id);
    expect(rows[0]!.status).toBe('SETTLED');
    expect(rows[0]!.undoneAt).toBeNull();
  });
});
