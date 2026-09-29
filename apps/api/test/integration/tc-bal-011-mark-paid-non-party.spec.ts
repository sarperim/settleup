/**
 * TC-BAL-011 — Mark paid by a member who is neither payer nor recipient is
 * denied (UC-BAL-003 E1) (balances-settlement.md §2; FR-BAL-006 deny side,
 * UC-BAL-003 E1, 03-api-design.md §4 `NOT_PAYMENT_PARTY`, §4 amended
 * 2026-09-25).
 *
 * Integration level. Carol is a member but a party to no live suggestion.
 * Step 2 sends a triple that both names her as a non-party **and** matches no
 * live suggestion — the combined precedence case: the party check runs before
 * plan matching, so the outcome is `403 NOT_PAYMENT_PARTY`, not
 * `SUGGESTION_STALE`, and no plan work is done.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  api,
  createIntegrationApp,
  CSRF_HEADERS,
  type IntegrationApp,
} from './support/app';
import {
  errorCode,
  createStandingValueGroup,
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

describe('TC-BAL-011 — non-party mark-paid is denied', () => {
  it('rejects the non-party with NOT_PAYMENT_PARTY, including the combined mismatch case', async () => {
    const { alice, bob, carol, group, plan } =
      await createStandingValueGroup(ctx.server);

    // 1. Carol submits the live bob→alice suggestion she is not a party to.
    const notParty = await api(ctx.server)
      .post(`/api/groups/${group.id}/settlements`)
      .set(CSRF_HEADERS)
      .set('Cookie', carol.cookie)
      .send(plan[0]!);
    expect(notParty.status).toBe(403);
    expect(errorCode(notParty.body)).toBe('NOT_PAYMENT_PARTY');

    // 2. Combined party + mismatch: 9999 is also not in the plan — the party
    //    check precedes plan matching, so the code is still NOT_PAYMENT_PARTY.
    const combined = await api(ctx.server)
      .post(`/api/groups/${group.id}/settlements`)
      .set(CSRF_HEADERS)
      .set('Cookie', carol.cookie)
      .send({ payerId: bob.id, recipientId: alice.id, amountKurus: 9999 });
    expect(combined.status).toBe(403);
    expect(errorCode(combined.body)).toBe('NOT_PAYMENT_PARTY');

    // 3. No settlement was created; the plan is unchanged.
    const view = await readSettlements(ctx.server, alice.cookie, group.id);
    expect(view.settled).toEqual([]);
    expect(view.outstanding).toHaveLength(2);
    const tuples = view.outstanding
      .map((entry) => ({
        payer: entry.payer.id,
        recipient: entry.recipient.id,
        amountKurus: entry.amountKurus,
      }))
      .sort((a, b) => a.payer.localeCompare(b.payer));
    expect(tuples).toEqual([
      { payer: bob.id, recipient: alice.id, amountKurus: 3000 },
      { payer: carol.id, recipient: alice.id, amountKurus: 3000 },
    ]);
  });
});
