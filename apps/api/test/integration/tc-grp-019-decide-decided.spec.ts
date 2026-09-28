/**
 * TC-GRP-019 — Deciding an already-decided request
 * (groups-membership.md §2; 02-data-model.md §5.3 JoinRequest state machine,
 * UC-GRP-003/004 preconditions, 03-api-design.md §3 "Approve/reject semantics"
 * note amended 2026-09-25; interpretation I-1 confirmed).
 *
 * A decided (non-PENDING) request is outside these routes' domain → 404, no
 * state change. Row c (specified by the amendment): a member non-creator acting
 * on a decided request gets 403 — authorization precedes request-state.
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

interface DecidedFixture {
  readonly alice: User;
  readonly bob: User;
  readonly trip: { readonly id: string };
  readonly requestId: string;
}

/** alice creates "Trip"; bob's request is placed and decided by `decision`. */
async function setupDecidedFixture(
  decision: 'approve' | 'reject',
): Promise<DecidedFixture> {
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
  const trip = await createGroup(ctx.server, alice.cookie, 'Trip');
  const request = await placeJoinRequest(ctx.server, bob.cookie, trip.joinCode);

  const decided = await api(ctx.server)
    .post(`/api/join-requests/${request.id}/${decision}`)
    .set(CSRF_HEADERS)
    .set('Cookie', alice.cookie);
  expect(decided.status).toBe(200);

  return { alice, bob, trip, requestId: request.id };
}

async function memberIds(groupId: string, cookie: string): Promise<string[]> {
  const members = await api(ctx.server)
    .get(`/api/groups/${groupId}/members`)
    .set('Cookie', cookie);
  expect(members.status).toBe(200);
  return members.body.members
    .map((member: { id: string }) => member.id)
    .sort();
}

async function requestStatus(requestId: string): Promise<string | undefined> {
  const row = await ctx.prisma.joinRequest.findUnique({
    where: { id: requestId },
  });
  return row?.status;
}

describe('TC-GRP-019 — deciding an already-decided request', () => {
  it('row a: approving or rejecting an APPROVED request → 404, no state change', async () => {
    const fixture = await setupDecidedFixture('approve');

    const approveAgain = await api(ctx.server)
      .post(`/api/join-requests/${fixture.requestId}/approve`)
      .set(CSRF_HEADERS)
      .set('Cookie', fixture.alice.cookie);
    expect(approveAgain.status).toBe(404);
    expect(approveAgain.body.error.code).toBe('NOT_FOUND');

    const rejectApproved = await api(ctx.server)
      .post(`/api/join-requests/${fixture.requestId}/reject`)
      .set(CSRF_HEADERS)
      .set('Cookie', fixture.alice.cookie);
    expect(rejectApproved.status).toBe(404);
    expect(rejectApproved.body.error.code).toBe('NOT_FOUND');

    expect(await requestStatus(fixture.requestId)).toBe('APPROVED');
    // Approving twice never duplicates membership.
    expect(await memberIds(fixture.trip.id, fixture.alice.cookie)).toEqual(
      [fixture.alice.id, fixture.bob.id].sort(),
    );
  });

  it('row b: rejecting or approving a REJECTED request → 404, no state change', async () => {
    const fixture = await setupDecidedFixture('reject');

    const rejectAgain = await api(ctx.server)
      .post(`/api/join-requests/${fixture.requestId}/reject`)
      .set(CSRF_HEADERS)
      .set('Cookie', fixture.alice.cookie);
    expect(rejectAgain.status).toBe(404);
    expect(rejectAgain.body.error.code).toBe('NOT_FOUND');

    const approveRejected = await api(ctx.server)
      .post(`/api/join-requests/${fixture.requestId}/approve`)
      .set(CSRF_HEADERS)
      .set('Cookie', fixture.alice.cookie);
    expect(approveRejected.status).toBe(404);
    expect(approveRejected.body.error.code).toBe('NOT_FOUND');

    expect(await requestStatus(fixture.requestId)).toBe('REJECTED');
    expect(await memberIds(fixture.trip.id, fixture.alice.cookie)).toEqual([
      fixture.alice.id,
    ]);
  });

  it('row c: a member non-creator on a decided request → 403 (authorization precedes state)', async () => {
    // Approving bob's own request makes bob a member non-creator and leaves a
    // decided (APPROVED) request.
    const fixture = await setupDecidedFixture('approve');

    const asMember = await api(ctx.server)
      .post(`/api/join-requests/${fixture.requestId}/approve`)
      .set(CSRF_HEADERS)
      .set('Cookie', fixture.bob.cookie);

    expect(asMember.status).toBe(403);
    expect(asMember.body.error.code).toBe('NOT_GROUP_CREATOR');

    expect(await requestStatus(fixture.requestId)).toBe('APPROVED');
    expect(await memberIds(fixture.trip.id, fixture.alice.cookie)).toEqual(
      [fixture.alice.id, fixture.bob.id].sort(),
    );
  });
});
