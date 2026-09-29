/**
 * TC-BAL-019 — Settled rows are retained forever (NFR-BAL-005)
 * (balances-settlement.md §2; NFR-BAL-005, BR-BAL-007/008, 02-data-model.md
 * §5.2 "rows are facts", brief §5 groups persist indefinitely).
 *
 * Integration level. Run the sequence settle two → undo one → settle a
 * regenerated suggestion → undo it again, all through the API, then read the
 * `settled_payments` table **directly**: exactly the rows created by the
 * sequence exist — nothing was ever deleted or rewritten. The re-settle creates
 * a **new** row (never a resurrection of the undone one). There is no
 * delete/purge endpoint for settlements (03-api-design.md defines none).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createIntegrationApp,
  type IntegrationApp,
} from './support/app';
import {
  createStandingValueGroup,
  markPaid,
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

describe('TC-BAL-019 — settled rows are retained forever', () => {
  it('retains exactly the three created rows across settle/undo/re-settle/undo', async () => {
    const { alice, bob, group, plan } =
      await createStandingValueGroup(ctx.server);

    // Settle both suggestions.
    const first = await markPaid(ctx.server, bob.cookie, group.id, plan[0]!);
    const second = await markPaid(ctx.server, alice.cookie, group.id, plan[1]!);

    // Undo one of them.
    const firstUndone = await undoSettlement(
      ctx.server,
      bob.cookie,
      group.id,
      first.id,
    );

    // Settle the regenerated suggestion (bob → alice 3000 is outstanding again).
    const third = await markPaid(ctx.server, alice.cookie, group.id, plan[0]!);
    // The re-settle is a brand-new fact, never the undone row revived.
    expect(third.id).not.toBe(first.id);

    // Undo it again.
    const thirdUndone = await undoSettlement(
      ctx.server,
      bob.cookie,
      group.id,
      third.id,
    );

    // Direct `settled_payments` read (documented data model).
    const rows = await ctx.prisma.settledPayment.findMany({
      where: { groupId: group.id },
      orderBy: { id: 'asc' },
    });

    // Exactly the rows created by the sequence — nothing deleted or rewritten.
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.id).sort()).toEqual(
      [first.id, second.id, third.id].sort(),
    );

    const byId = new Map(rows.map((row) => [row.id, row]));

    // The undone rows keep their original paidAt and carry undoneAt; the
    // still-settled row has no undoneAt.
    const firstRow = byId.get(first.id)!;
    expect(firstRow.status).toBe('UNDONE');
    expect(firstRow.paidAt.toISOString()).toBe(first.paidAt);
    expect(firstRow.undoneAt?.toISOString()).toBe(firstUndone.undoneAt);

    const secondRow = byId.get(second.id)!;
    expect(secondRow.status).toBe('SETTLED');
    expect(secondRow.paidAt.toISOString()).toBe(second.paidAt);
    expect(secondRow.undoneAt).toBeNull();

    const thirdRow = byId.get(third.id)!;
    expect(thirdRow.status).toBe('UNDONE');
    expect(thirdRow.paidAt.toISOString()).toBe(third.paidAt);
    expect(thirdRow.undoneAt?.toISOString()).toBe(thirdUndone.undoneAt);

    // Every retained row belongs to this group and carries its exact facts.
    for (const row of rows) {
      expect(row.groupId).toBe(group.id);
      expect(row.amountKurus).toBe(3000);
    }
  });
});
