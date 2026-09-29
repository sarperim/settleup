/**
 * TC-EXP-023 — Zero-sum holds after every expense operation (SC-005, expense
 * parameters) (expense-tracking.md §2; SC-005, NFR-EXP-003, OBJ-004,
 * FR-EXP-012 postcondition, UC-EXP-001/002/003 postconditions).
 *
 * Integration level, parameterized: after **every** operation of the expense
 * matrix — create (equal even, equal uneven, exact, zero amount, single
 * participant), edit (description-only, amount, participants, splitType,
 * payer-only — the TC-EXP-015 rows) and delete (unedited and edited) —
 * `GET /api/groups/:groupId/balances` is called and `sumKurus === 0` asserted.
 * The settle/undo half is TC-BAL-016; together they are the full SC-005 matrix.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  api,
  createIntegrationApp,
  CSRF_HEADERS,
  type IntegrationApp,
} from './support/app';
import { createExpense } from './support/factories';
import { createStandingGroup, type StandingGroup } from './support/standing-group';
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

/** Assert `sumKurus === 0` (and the actual entries sum to 0) for the group. */
async function expectZeroSum(
  group: StandingGroup,
  cookie: string,
): Promise<void> {
  const response = await api(ctx.server)
    .get(`/api/groups/${group.group.id}/balances`)
    .set('Cookie', cookie);

  expect(response.status).toBe(200);
  expect(response.body.sumKurus).toBe(0);
  const total = (
    response.body.balances as ReadonlyArray<{ balanceKurus: number }>
  ).reduce((sum, entry) => sum + entry.balanceKurus, 0);
  expect(total).toBe(0);
}

describe('TC-EXP-023 — zero-sum after every expense operation (SC-005)', () => {
  it('holds after each create, edit and delete parameter', async () => {
    const fixture = await createStandingGroup(ctx.server);
    const { alice, bob, carol, group } = fixture;

    // --- 1. create --------------------------------------------------------
    // equal, evenly dividing
    await createExpense(ctx.server, alice.cookie, group.id, {
      description: 'Equal even',
      amountKurus: 9000,
      payerId: alice.id,
      participantIds: [alice.id, bob.id, carol.id],
      splitType: 'EQUAL',
    });
    await expectZeroSum(fixture, alice.cookie);

    // equal, uneven (random remainder spread)
    await createExpense(ctx.server, alice.cookie, group.id, {
      description: 'Equal uneven',
      amountKurus: 10000,
      payerId: alice.id,
      participantIds: [alice.id, bob.id, carol.id],
      splitType: 'EQUAL',
    });
    await expectZeroSum(fixture, alice.cookie);

    // exact, with a zero share and a payer who is not the logger
    await createExpense(ctx.server, alice.cookie, group.id, {
      description: 'Exact',
      amountKurus: 5000,
      payerId: bob.id,
      participantIds: [alice.id, bob.id, carol.id],
      splitType: 'EXACT',
      exactAmounts: { [alice.id]: 0, [bob.id]: 2500, [carol.id]: 2500 },
    });
    await expectZeroSum(fixture, alice.cookie);

    // zero amount
    await createExpense(ctx.server, alice.cookie, group.id, {
      description: 'Zero',
      amountKurus: 0,
      payerId: alice.id,
      participantIds: [alice.id],
      splitType: 'EQUAL',
    });
    await expectZeroSum(fixture, alice.cookie);

    // single participant, payer outside the split
    await createExpense(ctx.server, alice.cookie, group.id, {
      description: 'Single',
      amountKurus: 10000,
      payerId: alice.id,
      participantIds: [bob.id],
      splitType: 'EQUAL',
    });
    await expectZeroSum(fixture, alice.cookie);

    // --- 2. edit (the TC-EXP-015 rows; a fresh base per row) --------------
    const createBase = () =>
      createExpense(ctx.server, alice.cookie, group.id, {
        description: 'Base',
        amountKurus: 9000,
        payerId: alice.id,
        participantIds: [alice.id, bob.id, carol.id],
        splitType: 'EQUAL',
      });
    const patch = (expenseId: string, body: Record<string, unknown>) =>
      api(ctx.server)
        .patch(`/api/groups/${group.id}/expenses/${expenseId}`)
        .set(CSRF_HEADERS)
        .set('Cookie', alice.cookie)
        .send(body);

    // a. description-only (no recompute trigger)
    let base = await createBase();
    expect((await patch(base.id, { description: 'Dinner 2' })).status).toBe(200);
    await expectZeroSum(fixture, alice.cookie);

    // b. amount
    base = await createBase();
    expect((await patch(base.id, { amountKurus: 12000 })).status).toBe(200);
    await expectZeroSum(fixture, alice.cookie);

    // c. participants
    base = await createBase();
    expect(
      (await patch(base.id, { participantIds: [alice.id, bob.id] })).status,
    ).toBe(200);
    await expectZeroSum(fixture, alice.cookie);

    // d. splitType EQUAL → EXACT with explicit exactAmounts
    base = await createBase();
    expect(
      (
        await patch(base.id, {
          splitType: 'EXACT',
          exactAmounts: { [alice.id]: 9000, [bob.id]: 0, [carol.id]: 0 },
        })
      ).status,
    ).toBe(200);
    await expectZeroSum(fixture, alice.cookie);

    // e. payer-only (no recompute trigger)
    base = await createBase();
    expect((await patch(base.id, { payerId: bob.id })).status).toBe(200);
    await expectZeroSum(fixture, alice.cookie);

    // --- 3. delete (unedited and edited) ----------------------------------
    const unedited = await createBase();
    const edited = await createBase();
    expect((await patch(edited.id, { description: 'Edited' })).status).toBe(200);
    await expectZeroSum(fixture, alice.cookie);

    const deleteExpense = (expenseId: string) =>
      api(ctx.server)
        .delete(`/api/groups/${group.id}/expenses/${expenseId}`)
        .set(CSRF_HEADERS)
        .set('Cookie', alice.cookie);

    expect((await deleteExpense(unedited.id)).status).toBe(204);
    await expectZeroSum(fixture, alice.cookie);

    expect((await deleteExpense(edited.id)).status).toBe(204);
    await expectZeroSum(fixture, alice.cookie);
  });
});
