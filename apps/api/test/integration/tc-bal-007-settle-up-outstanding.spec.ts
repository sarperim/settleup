/**
 * TC-BAL-007 — Settle-up view: outstanding plan and (initially empty) settled
 * list (UC-BAL-002 main) (balances-settlement.md §2; FR-BAL-004, FR-BAL-005,
 * FR-BAL-010 read side, UC-BAL-002 main, BR-BAL-004/005/009,
 * 03-api-design.md §3c settlements row, D-ARCH-004).
 *
 * Integration level. The standing value fixture (balances-settlement.md §2):
 * alice logs 9000 kuruş paid by alice with an EXACT split
 * `{alice: 3000, bob: 3000, carol: 3000}` → balances alice +6000, bob −3000,
 * carol −3000, `sumKurus = 0`; the deterministic minimum-transaction plan is
 * bob → alice 3000 and carol → alice 3000 (one creditor, exact debts).
 *
 * The `outstanding` plan is **derived** output — asserted only through this API,
 * never via stored plan rows (strategy G-3 / D-ARCH-004).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  api,
  createIntegrationApp,
  type IntegrationApp,
} from './support/app';
import { createExpense } from './support/factories';
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

describe('TC-BAL-007 — settle-up view: outstanding plan and empty settled list', () => {
  it('returns the deterministic minimum plan and an initially empty settled list', async () => {
    const { alice, bob, carol, group } = await createStandingGroup(ctx.server);

    // Standing value fixture: 9000 kuruş, payer alice, EXACT 3000/3000/3000.
    await createExpense(ctx.server, alice.cookie, group.id, {
      description: 'Group dinner',
      amountKurus: 9000,
      payerId: alice.id,
      participantIds: [alice.id, bob.id, carol.id],
      splitType: 'EXACT',
      exactAmounts: { [alice.id]: 3000, [bob.id]: 3000, [carol.id]: 3000 },
    });

    // GET .../settlements as carol — any member may read the derived view.
    const response = await api(ctx.server)
      .get(`/api/groups/${group.id}/settlements`)
      .set('Cookie', carol.cookie);

    expect(response.status).toBe(200);

    // The response carries exactly `outstanding` and `settled`.
    expect(Object.keys(response.body).sort()).toEqual([
      'outstanding',
      'settled',
    ]);

    const outstanding = response.body.outstanding as SuggestionEntry[];

    // Exactly 2 entries — the minimum for one creditor and two debtors.
    expect(outstanding).toHaveLength(2);

    // Set comparison: the engine's deterministic order is not contractual here.
    const asTuples = outstanding
      .map((entry) => ({
        payer: entry.payer.id,
        recipient: entry.recipient.id,
        amountKurus: entry.amountKurus,
      }))
      .sort((a, b) => a.payer.localeCompare(b.payer));

    expect(asTuples).toEqual(
      [
        { payer: bob.id, recipient: alice.id, amountKurus: 3000 },
        { payer: carol.id, recipient: alice.id, amountKurus: 3000 },
      ].sort((a, b) => a.payer.localeCompare(b.payer)),
    );

    // `payer`/`recipient` expose `{ id, displayName }` only — never email.
    for (const entry of outstanding) {
      expect(Object.keys(entry.payer).sort()).toEqual(['displayName', 'id']);
      expect(Object.keys(entry.recipient).sort()).toEqual(['displayName', 'id']);
      expect(JSON.stringify(entry)).not.toContain('@');
    }

    const names: Record<string, string> = {};
    for (const entry of outstanding) {
      names[entry.payer.id] = entry.payer.displayName;
      names[entry.recipient.id] = entry.recipient.displayName;
    }
    expect(names[bob.id]).toBe('Bob');
    expect(names[carol.id]).toBe('Carol');
    expect(names[alice.id]).toBe('Alice');

    // No zero-balance member appears — every member here is nonzero anyway.
    expect(asTuples.map((entry) => entry.payer)).not.toContain(alice.id);

    // The settled facts list starts empty.
    expect(response.body.settled).toEqual([]);
  });
});
