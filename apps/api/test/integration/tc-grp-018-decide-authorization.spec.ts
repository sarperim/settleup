/**
 * TC-GRP-018 — Approve/reject authorization (decision table)
 * (groups-membership.md §2; FR-GRP-005/006/007 context, UC-GRP-003/004 error
 * side, 03-api-design.md §3 error codes + "Approve/reject semantics" note
 * amended 2026-09-25; interpretation I-2 confirmed).
 *
 * Fixed check order: missing row → non-member → member non-creator → decided.
 * Each row runs from a clean copy of the precondition state
 * (alice creates "Trip"; bob is a member non-creator; carol pends; dave is a
 * registered non-member).
 *
 * Translation note (flagged): the plan's expected-result 4 parenthetical
 * "(alice only)" is inconsistent with its own precondition, which makes bob a
 * member non-creator (needed for row 1's `403`). The faithful invariant is
 * asserted: the member set is unchanged by every failing call and carol is
 * never added.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  api,
  createIntegrationApp,
  CSRF_HEADERS,
  type IntegrationApp,
} from './support/app';
import { truncateAllTables } from './support/truncate';
import {
  createGroup,
  joinAndApprove,
  placeJoinRequest,
  registerUser,
  TEST_PASSWORD,
} from './support/factories';

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

interface User {
  readonly id: string;
  readonly cookie: string;
}

interface DecisionFixture {
  readonly alice: User;
  readonly bob: User;
  readonly carol: User;
  readonly trip: { readonly id: string };
  readonly requestId: string;
}

/**
 * alice creates "Trip"; bob becomes a member non-creator; carol has a pending
 * request. Returns the handles the rows act with.
 */
async function setupDecisionFixture(): Promise<DecisionFixture> {
  const alice = await registerUser(
    ctx.server,
    'alice@test.local',
    TEST_PASSWORD,
    'Alice',
  );
  const bob = await registerUser(
    ctx.server,
    'bob@test.local',
    TEST_PASSWORD,
    'Bob',
  );
  const carol = await registerUser(
    ctx.server,
    'carol@test.local',
    TEST_PASSWORD,
    'Carol',
  );
  const trip = await createGroup(ctx.server, alice.cookie, 'Trip');
  await joinAndApprove(ctx.server, alice.cookie, bob.cookie, trip.joinCode);
  const request = await placeJoinRequest(ctx.server, carol.cookie, trip.joinCode);
  return { alice, bob, carol, trip, requestId: request.id };
}

/** The failing call left the member set unchanged and carol's row PENDING. */
async function expectNoSideEffects(fixture: DecisionFixture): Promise<void> {
  const members = await api(ctx.server)
    .get(`/api/groups/${fixture.trip.id}/members`)
    .set('Cookie', fixture.alice.cookie);
  expect(members.status).toBe(200);

  const ids = members.body.members
    .map((member: { id: string }) => member.id)
    .sort();
  expect(ids).toEqual([fixture.alice.id, fixture.bob.id].sort());
  expect(ids).not.toContain(fixture.carol.id);

  const row = await ctx.prisma.joinRequest.findUnique({
    where: { id: fixture.requestId },
  });
  expect(row?.status).toBe('PENDING');
}

describe('TC-GRP-018 — approve/reject authorization', () => {
  it('row 1: a member non-creator approving → 403 NOT_GROUP_CREATOR, no side effect', async () => {
    const fixture = await setupDecisionFixture();

    const response = await api(ctx.server)
      .post(`/api/join-requests/${fixture.requestId}/approve`)
      .set(CSRF_HEADERS)
      .set('Cookie', fixture.bob.cookie);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('NOT_GROUP_CREATOR');
    await expectNoSideEffects(fixture);
  });

  it('row 2: a registered non-member rejecting → 404 NOT_FOUND, no side effect', async () => {
    const fixture = await setupDecisionFixture();
    const dave = await registerUser(
      ctx.server,
      'dave@test.local',
      TEST_PASSWORD,
      'Dave',
    );

    const response = await api(ctx.server)
      .post(`/api/join-requests/${fixture.requestId}/reject`)
      .set(CSRF_HEADERS)
      .set('Cookie', dave.cookie);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
    await expectNoSideEffects(fixture);
  });

  it('row 3: a nonexistent request id → 404 NOT_FOUND, no side effect', async () => {
    const fixture = await setupDecisionFixture();

    const response = await api(ctx.server)
      .post('/api/join-requests/nonexistent-request-id/approve')
      .set(CSRF_HEADERS)
      .set('Cookie', fixture.alice.cookie);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');

    const row = await ctx.prisma.joinRequest.findUnique({
      where: { id: fixture.requestId },
    });
    expect(row?.status).toBe('PENDING');
  });
});
