/**
 * TC-BAL-010 — Mark a suggested payment as paid, by its recipient (either
 * party) (balances-settlement.md §2; FR-BAL-006 recipient side, BR-BAL-006,
 * UC-BAL-003 main actor variant, 03-api-design.md §3c).
 *
 * Integration level. Fresh standing value fixture; alice — the **recipient** of
 * the bob→alice suggestion — marks it paid. Either party may (BR-BAL-006); the
 * balances and views shift exactly as in TC-BAL-009.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  api,
  createIntegrationApp,
  type IntegrationApp,
} from './support/app';
import {
  createStandingValueGroup,
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

describe('TC-BAL-010 — mark a suggested payment paid, by its recipient', () => {
  it('accepts the recipient as the actor and shifts the views identically', async () => {
    const { alice, bob, carol, group, plan } =
      await createStandingValueGroup(ctx.server);

    // Alice (the recipient) marks bob's payment paid.
    const settlement = await markPaid(ctx.server, alice.cookie, group.id, plan[0]!);
    expect(settlement.status).toBe('SETTLED');
    expect(settlement.payer.id).toBe(bob.id);
    expect(settlement.recipient.id).toBe(alice.id);
    expect(settlement.amountKurus).toBe(3000);

    // Balances shift exactly as in TC-BAL-009.
    const balancesResponse = await api(ctx.server)
      .get(`/api/groups/${group.id}/balances`)
      .set('Cookie', bob.cookie);
    expect(balancesResponse.status).toBe(200);
    expect(balancesResponse.body.sumKurus).toBe(0);
    const balances = new Map<string, number>(
      (
        balancesResponse.body.balances as Array<{
          member: { id: string };
          balanceKurus: number;
        }>
      ).map((entry) => [entry.member.id, entry.balanceKurus]),
    );
    expect(balances.get(alice.id)).toBe(3000);
    expect(balances.get(bob.id)).toBe(0);
    expect(balances.get(carol.id)).toBe(-3000);

    const view = await readSettlements(ctx.server, alice.cookie, group.id);
    expect(view.outstanding).toHaveLength(1);
    expect(view.outstanding[0]!.payer.id).toBe(carol.id);
    expect(view.outstanding[0]!.recipient.id).toBe(alice.id);
    expect(view.outstanding[0]!.amountKurus).toBe(3000);
    expect(view.settled).toHaveLength(1);
    expect(view.settled[0]!.payer.id).toBe(bob.id);
  });
});
