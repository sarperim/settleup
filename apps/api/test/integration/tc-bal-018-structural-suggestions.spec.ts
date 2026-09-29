/**
 * TC-BAL-018 — Structural suggestion properties at the API level (random
 * remainder included) (balances-settlement.md §2; FR-BAL-004/005,
 * BR-BAL-004/005/008, strategy T5).
 *
 * Integration level. The fixture uses an **uneven EQUAL split** (alice pays
 * 10000 over alice+bob+carol → a random ±1 kuruş remainder spread) plus a
 * fourth member at exactly 0 balance (dave, a non-participant). Because the
 * remainder draw makes member balances shift between fixtures, only structural
 * properties are asserted — never the specific plan content (strategy T5).
 *
 * All assertions about the outstanding plan go through `GET …/settlements`
 * (strategy G-3 / D-ARCH-004 — no stored plan rows).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  api,
  createIntegrationApp,
  type IntegrationApp,
} from './support/app';
import {
  createExpense,
  joinAndApprove,
  registerUser,
  TEST_PASSWORD,
} from './support/factories';
import { createStandingGroup } from './support/standing-group';
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

interface UserRef {
  id: string;
  displayName: string;
}

interface SuggestionEntry {
  payer: UserRef;
  recipient: UserRef;
  amountKurus: number;
}

interface BalanceEntry {
  member: { id: string; displayName: string };
  balanceKurus: number;
}

describe('TC-BAL-018 — structural suggestion properties (random remainder)', () => {
  it('is deterministic, zero-balancing, minimal-bounded and excludes zero-balance members', async () => {
    const { alice, bob, carol, group } = await createStandingGroup(ctx.server);

    // A fourth member at exactly 0 balance: dave never participates.
    const dave = await registerUser(
      ctx.server,
      'dave@test.local',
      TEST_PASSWORD,
      'Dave',
    );
    await joinAndApprove(ctx.server, alice.cookie, dave.cookie, group.joinCode);

    // Random-remainder fixture: 10000 EQUAL over alice+bob+carol (10/3 →
    // 3333 base with a single +1 kuruş spread drawn at random).
    await createExpense(ctx.server, alice.cookie, group.id, {
      description: 'Random remainder dinner',
      amountKurus: 10000,
      payerId: alice.id,
      participantIds: [alice.id, bob.id, carol.id],
      splitType: 'EQUAL',
    });

    // Two reads of the derived plan.
    const first = await api(ctx.server)
      .get(`/api/groups/${group.id}/settlements`)
      .set('Cookie', bob.cookie);
    const second = await api(ctx.server)
      .get(`/api/groups/${group.id}/settlements`)
      .set('Cookie', bob.cookie);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const firstOutstanding = first.body.outstanding as SuggestionEntry[];
    const secondOutstanding = second.body.outstanding as SuggestionEntry[];

    // 1. The two reads return identical outstanding (deterministic engine).
    expect(JSON.stringify(secondOutstanding)).toBe(
      JSON.stringify(firstOutstanding),
    );

    // Current balances, from the balances endpoint.
    const balancesResponse = await api(ctx.server)
      .get(`/api/groups/${group.id}/balances`)
      .set('Cookie', bob.cookie);
    expect(balancesResponse.status).toBe(200);
    const balances = balancesResponse.body.balances as BalanceEntry[];

    // Four members; dave is at exactly 0.
    expect(balances).toHaveLength(4);
    expect(balancesResponse.body.sumKurus).toBe(0);
    const balanceById = new Map(
      balances.map((entry) => [entry.member.id, entry.balanceKurus]),
    );
    expect(balanceById.get(dave.id)).toBe(0);

    // 2. Structural properties of the plan.
    // At most (members − 1) payments.
    expect(firstOutstanding.length).toBeLessThanOrEqual(balances.length - 1);

    for (const entry of firstOutstanding) {
      // References expose `{ id, displayName }` only — never email.
      expect(Object.keys(entry.payer).sort()).toEqual(['displayName', 'id']);
      expect(Object.keys(entry.recipient).sort()).toEqual(['displayName', 'id']);
      expect(JSON.stringify(entry)).not.toContain('@');
      // Every amount is strictly positive.
      expect(Number.isInteger(entry.amountKurus)).toBe(true);
      expect(entry.amountKurus).toBeGreaterThan(0);
      // The zero-balance member appears in no suggestion (BR-BAL-005).
      expect(entry.payer.id).not.toBe(dave.id);
      expect(entry.recipient.id).not.toBe(dave.id);
    }

    // Applying the plan to the balances zeroes every member (test-side).
    const applied = new Map(balanceById);
    for (const entry of firstOutstanding) {
      applied.set(entry.payer.id, applied.get(entry.payer.id)! + entry.amountKurus);
      applied.set(
        entry.recipient.id,
        applied.get(entry.recipient.id)! - entry.amountKurus,
      );
    }
    for (const entry of balances) {
      expect(applied.get(entry.member.id)).toBe(0);
    }

    // Referenced ids are real members.
    const memberIds = new Set(balances.map((entry) => entry.member.id));
    for (const entry of firstOutstanding) {
      expect(memberIds.has(entry.payer.id)).toBe(true);
      expect(memberIds.has(entry.recipient.id)).toBe(true);
    }

    // Settled facts list is empty in this fixture.
    expect(first.body.settled).toEqual([]);
  });
});
