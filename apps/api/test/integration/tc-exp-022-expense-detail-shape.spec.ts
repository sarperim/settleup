/**
 * TC-EXP-022 — Expense detail shape: shares, identities, timestamps
 * (expense-tracking.md §2; FR-EXP-011, UC-EXP-004 main step 2, BR-EXP-008,
 * FR-ACC-008 positive expense payload, 03-api-design.md §3b detail row).
 *
 * Integration level. The unedited expense is logged through the public API; the
 * edited EXACT expense is seeded directly via Prisma because the edit route
 * (TKT-exp-004) does not exist yet and strategy §5 permits direct Prisma
 * seeding for read-path fixtures. Until then `editedAt` can only be produced
 * through the store.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  api,
  createIntegrationApp,
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

/** The exact set of keys every detail payload carries (plus `editedAt`). */
const BASE_KEYS = [
  'id',
  'description',
  'amountKurus',
  'splitType',
  'payer',
  'logger',
  'shares',
  'createdAt',
] as const;

describe('TC-EXP-022 — expense detail shape', () => {
  it('exposes shares, display-name identities and server timestamps', async () => {
    const { alice, bob, carol, group } = await createStandingGroup(ctx.server);

    // An EQUAL expense via the API: alice payer, three participants.
    const equal = await createExpense(ctx.server, alice.cookie, group.id, {
      description: 'Dinner',
      amountKurus: 9000,
      payerId: alice.id,
      participantIds: [alice.id, bob.id, carol.id],
      splitType: 'EQUAL',
    });

    // An edited EXACT expense seeded directly (read-path fixture, strategy §5):
    // `editedAt` is store-owned until the edit route lands.
    const editedAt = new Date(Date.now() + 60_000);
    const edited = await ctx.prisma.expense.create({
      data: {
        groupId: group.id,
        description: 'Tickets',
        amountKurus: 5000,
        payerId: bob.id,
        splitType: 'EXACT',
        loggerId: alice.id,
        editedAt,
        shares: {
          create: [
            { participantId: alice.id, shareKurus: 0 },
            { participantId: bob.id, shareKurus: 2500 },
            { participantId: carol.id, shareKurus: 2500 },
          ],
        },
      },
    });

    // ── Unedited expense ────────────────────────────────────────────────
    const equalResponse = await api(ctx.server)
      .get(`/api/groups/${group.id}/expenses/${equal.id}`)
      .set('Cookie', bob.cookie);

    expect(equalResponse.status).toBe(200);
    expect(Object.keys(equalResponse.body)).toEqual(['expense']);

    const equalView = equalResponse.body.expense;
    expect(Object.keys(equalView).sort()).toEqual([...BASE_KEYS].sort());
    expect('editedAt' in equalView).toBe(false);

    expect(equalView.description).toBe('Dinner');
    expect(equalView.amountKurus).toBe(9000);
    expect(equalView.splitType).toBe('EQUAL');
    expect(typeof equalView.createdAt).toBe('string');
    expect(Number.isNaN(Date.parse(equalView.createdAt))).toBe(false);

    // Identity references expose `displayName` only.
    expect(equalView.payer).toMatchObject({
      id: alice.id,
      displayName: 'Alice',
    });
    expect(equalView.shares).toHaveLength(3);
    for (const share of equalView.shares) {
      expect(typeof share.participant.displayName).toBe('string');
      expect(share.participant.displayName.length).toBeGreaterThan(0);
    }
    expect(
      Object.fromEntries(
        equalView.shares.map(
          (share: { participant: { id: string }; shareKurus: number }) => [
            share.participant.id,
            share.shareKurus,
          ],
        ),
      ),
    ).toEqual({ [alice.id]: 3000, [bob.id]: 3000, [carol.id]: 3000 });

    // ── Edited expense ──────────────────────────────────────────────────
    const editedResponse = await api(ctx.server)
      .get(`/api/groups/${group.id}/expenses/${edited.id}`)
      .set('Cookie', bob.cookie);

    expect(editedResponse.status).toBe(200);
    const editedView = editedResponse.body.expense;

    expect(Object.keys(editedView).sort()).toEqual(
      [...BASE_KEYS, 'editedAt'].sort(),
    );
    expect(editedView.splitType).toBe('EXACT');
    expect(editedView.amountKurus).toBe(5000);
    expect(editedView.payer).toMatchObject({
      id: bob.id,
      displayName: 'Bob',
    });
    expect(editedView.logger).toMatchObject({
      id: alice.id,
      displayName: 'Alice',
    });

    // `editedAt` is present, a parsed timestamp not earlier than `createdAt`.
    expect(typeof editedView.editedAt).toBe('string');
    expect(Number.isNaN(Date.parse(editedView.editedAt))).toBe(false);
    expect(Date.parse(editedView.editedAt)).toBeGreaterThanOrEqual(
      Date.parse(editedView.createdAt),
    );

    // Shares are re-read from the store as the permanent record; zero-kuruş
    // EXACT participation is preserved.
    expect(
      Object.fromEntries(
        editedView.shares.map(
          (share: { participant: { id: string }; shareKurus: number }) => [
            share.participant.id,
            share.shareKurus,
          ],
        ),
      ),
    ).toEqual({ [alice.id]: 0, [bob.id]: 2500, [carol.id]: 2500 });

    // No email and no user-settable date field anywhere in the payload
    // (FR-ACC-008, BR-EXP-008).
    const serialized = JSON.stringify(editedResponse.body);
    expect(serialized).not.toContain('@');
    expect(serialized).not.toContain('email');
  });
});
