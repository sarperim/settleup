/**
 * TC-GRP-025 — Groups, memberships, and join requests persist through the
 * exercised lifecycle (groups-membership.md §2; NFR-GRP-002, BR-GRP-007/008,
 * 02-data-model.md §1 principle 4).
 *
 * Runs the full lifecycle through the API — create, request, reject,
 * re-request, approve, and a final pending request — then reads the `groups`,
 * `memberships`, and `join_requests` tables directly. Nothing is deleted at any
 * point: the rejected request's row is reused (flipped) rather than replaced,
 * and both memberships survive.
 *
 * Integration level. Every write is driven through the public API.
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

describe('TC-GRP-025 — groups, memberships, and join requests persist through the lifecycle', () => {
  it('retains every row through create → request → reject → re-request → approve → pending', async () => {
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

    // 1. The full lifecycle.
    const trip = await createGroup(ctx.server, alice.cookie, 'Trip');

    const bobRequest = await placeJoinRequest(
      ctx.server,
      bob.cookie,
      trip.joinCode,
    );

    const reject = await api(ctx.server)
      .post(`/api/join-requests/${bobRequest.id}/reject`)
      .set(CSRF_HEADERS)
      .set('Cookie', alice.cookie);
    expect(reject.status).toBe(200);
    expect(reject.body.joinRequest.status).toBe('REJECTED');
    expect(typeof reject.body.joinRequest.decidedAt).toBe('string');

    // Bob re-requests: the same row flips back to PENDING, `decidedAt` cleared.
    const reRequest = await placeJoinRequest(
      ctx.server,
      bob.cookie,
      trip.joinCode,
    );
    expect(reRequest.id).toBe(bobRequest.id);
    expect(reRequest.status).toBe('PENDING');

    const approve = await api(ctx.server)
      .post(`/api/join-requests/${bobRequest.id}/approve`)
      .set(CSRF_HEADERS)
      .set('Cookie', alice.cookie);
    expect(approve.status).toBe(200);
    expect(approve.body.joinRequest.status).toBe('APPROVED');
    expect(typeof approve.body.joinRequest.decidedAt).toBe('string');

    // Carol leaves a pending row.
    const carolRequest = await placeJoinRequest(
      ctx.server,
      carol.cookie,
      trip.joinCode,
    );
    expect(carolRequest.status).toBe('PENDING');

    // 2. As alice: the group, its members, and the (pending-only) request list.
    const detail = await api(ctx.server)
      .get(`/api/groups/${trip.id}`)
      .set('Cookie', alice.cookie);

    expect(detail.status).toBe(200);
    expect(detail.body.group.id).toBe(trip.id);
    expect(detail.body.group.name).toBe('Trip');

    const members = await api(ctx.server)
      .get(`/api/groups/${trip.id}/members`)
      .set('Cookie', alice.cookie);

    expect(members.status).toBe(200);
    const memberIds = members.body.members
      .map((member: { id: string }) => member.id)
      .sort();
    expect(memberIds).toEqual([alice.id, bob.id].sort());

    const pending = await api(ctx.server)
      .get(`/api/groups/${trip.id}/join-requests`)
      .set('Cookie', alice.cookie);

    expect(pending.status).toBe(200);
    expect(pending.body.requests).toHaveLength(1);
    expect(pending.body.requests[0].requester.id).toBe(carol.id);
    expect(pending.body.requests[0].status).toBe('PENDING');

    // 3. Direct table reads — the rows survive, nothing was deleted.
    const groupRows = await ctx.prisma.group.findMany();
    expect(groupRows).toHaveLength(1);
    expect(groupRows[0]?.id).toBe(trip.id);
    expect(groupRows[0]?.name).toBe('Trip');

    const membershipRows = await ctx.prisma.membership.findMany();
    expect(membershipRows).toHaveLength(2);
    const aliceMembership = membershipRows.find(
      (row) => row.userId === alice.id,
    );
    const bobMembership = membershipRows.find((row) => row.userId === bob.id);
    expect(aliceMembership?.isCreator).toBe(true);
    expect(bobMembership?.isCreator).toBe(false);

    const requestRows = await ctx.prisma.joinRequest.findMany();
    expect(requestRows).toHaveLength(2);

    // Bob's original row was flipped (same id), not replaced or deleted.
    const bobRow = requestRows.find((row) => row.id === bobRequest.id);
    expect(bobRow?.userId).toBe(bob.id);
    expect(bobRow?.status).toBe('APPROVED');
    expect(bobRow?.decidedAt).not.toBeNull();

    const carolRow = requestRows.find((row) => row.userId === carol.id);
    expect(carolRow?.status).toBe('PENDING');
    expect(carolRow?.decidedAt).toBeNull();
  });
});
