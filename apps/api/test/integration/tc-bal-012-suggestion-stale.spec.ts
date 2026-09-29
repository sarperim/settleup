/**
 * TC-BAL-012 — Mark paid with no matching live suggestion → SUGGESTION_STALE
 * (strategy G-2) (balances-settlement.md §2; 03-api-design.md §3.4, G-2,
 * BR-BAL-008, FR-BAL-007 context, UC-BAL-003 error side).
 *
 * Integration level. Each row uses a fresh standing value fixture; the live
 * plan is {bob→alice 3000, carol→alice 3000}. Every non-matching triple —
 * amount off by one (a), wrong direction/parties (b), a plan that changed
 * concurrently (c), nothing outstanding (d), a non-member named in the triple
 * (e) — is rejected with `409 SUGGESTION_STALE` and creates no row.
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
} from './support/settlements';
import { registerNonMember } from './support/standing-group';
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

function markPaidRaw(
  server: typeof ctx.server,
  cookie: string,
  groupId: string,
  body: { payerId: string; recipientId: string; amountKurus: number },
) {
  return api(server)
    .post(`/api/groups/${groupId}/settlements`)
    .set(CSRF_HEADERS)
    .set('Cookie', cookie)
    .send(body);
}

describe('TC-BAL-012 — no matching live suggestion → SUGGESTION_STALE', () => {
  it('row a: amount off by one is stale', async () => {
    const { alice, bob, group } = await createStandingValueGroup(ctx.server);

    const response = await markPaidRaw(ctx.server, bob.cookie, group.id, {
      payerId: bob.id,
      recipientId: alice.id,
      amountKurus: 3001,
    });
    expect(response.status).toBe(409);
    expect(errorCode(response.body)).toBe('SUGGESTION_STALE');

    const view = await readSettlements(ctx.server, alice.cookie, group.id);
    expect(view.settled).toEqual([]);
  });

  it('row b: wrong direction / wrong parties are stale', async () => {
    const { alice, bob, carol, group } =
      await createStandingValueGroup(ctx.server);

    const reversed = await markPaidRaw(ctx.server, alice.cookie, group.id, {
      payerId: alice.id,
      recipientId: bob.id,
      amountKurus: 3000,
    });
    expect(reversed.status).toBe(409);
    expect(errorCode(reversed.body)).toBe('SUGGESTION_STALE');

    const wrongRecipient = await markPaidRaw(ctx.server, bob.cookie, group.id, {
      payerId: bob.id,
      recipientId: carol.id,
      amountKurus: 3000,
    });
    expect(wrongRecipient.status).toBe(409);
    expect(errorCode(wrongRecipient.body)).toBe('SUGGESTION_STALE');

    const view = await readSettlements(ctx.server, alice.cookie, group.id);
    expect(view.settled).toEqual([]);
  });

  it('row c: a plan that changed concurrently rejects the now-stale triple', async () => {
    const { alice, bob, group, plan } =
      await createStandingValueGroup(ctx.server);

    // The first settle succeeds; bob's balance is now 0.
    await markPaid(ctx.server, bob.cookie, group.id, plan[0]!);

    // The same triple was in the plan when the client read it — stale now.
    const stale = await markPaidRaw(ctx.server, bob.cookie, group.id, plan[0]!);
    expect(stale.status).toBe(409);
    expect(errorCode(stale.body)).toBe('SUGGESTION_STALE');

    const view = await readSettlements(ctx.server, alice.cookie, group.id);
    expect(view.settled).toHaveLength(1);
  });

  it('row d: nothing outstanding is stale', async () => {
    const { alice, bob, group, plan } =
      await createStandingValueGroup(ctx.server);

    // Settle both suggestions: balances are all zero.
    await markPaid(ctx.server, bob.cookie, group.id, plan[0]!);
    await markPaid(ctx.server, alice.cookie, group.id, plan[1]!);
    const balances = await readBalances(ctx.server, alice.cookie, group.id);
    for (const value of balances.values()) {
      expect(value).toBe(0);
    }

    const response = await markPaidRaw(ctx.server, bob.cookie, group.id, plan[0]!);
    expect(response.status).toBe(409);
    expect(errorCode(response.body)).toBe('SUGGESTION_STALE');

    const view = await readSettlements(ctx.server, alice.cookie, group.id);
    expect(view.settled).toHaveLength(2);
  });

  it('row e: a non-member named in the triple never matches a suggestion', async () => {
    const { alice, group } = await createStandingValueGroup(ctx.server);
    const dave = await registerNonMember(ctx.server);

    // Alice is the triple's recipient, so the party check passes; no live
    // suggestion can name the non-member dave as payer (exact-match rule).
    const response = await markPaidRaw(ctx.server, alice.cookie, group.id, {
      payerId: dave.id,
      recipientId: alice.id,
      amountKurus: 3000,
    });
    expect(response.status).toBe(409);
    expect(errorCode(response.body)).toBe('SUGGESTION_STALE');

    const view = await readSettlements(ctx.server, alice.cookie, group.id);
    expect(view.settled).toEqual([]);
  });
});
