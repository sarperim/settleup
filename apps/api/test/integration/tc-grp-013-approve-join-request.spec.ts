/**
 * TC-GRP-013 — Approve a pending join request establishes membership
 * (groups-membership.md §2; FR-GRP-006, UC-GRP-003 main, BR-GRP-004,
 * 03-api-design.md §3 approve row).
 *
 * Integration level. The pending request is placed through the public API
 * (`placeJoinRequest`).
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

describe('TC-GRP-013 — approving a pending join request establishes membership', () => {
  it('closes the request as APPROVED, adds bob as a member, and empties the pending list', async () => {
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

    // 1. POST .../approve as the creator.
    const approve = await api(ctx.server)
      .post(`/api/join-requests/${request.id}/approve`)
      .set(CSRF_HEADERS)
      .set('Cookie', alice.cookie);

    expect(approve.status).toBe(200);
    expect(Object.keys(approve.body)).toEqual(['joinRequest']);
    expect(approve.body.joinRequest.status).toBe('APPROVED');
    // `decidedAt` is exposed and set on approval (02 §4).
    expect(typeof approve.body.joinRequest.decidedAt).toBe('string');

    // 2. The member list now holds exactly alice (creator) and bob.
    const members = await api(ctx.server)
      .get(`/api/groups/${trip.id}/members`)
      .set('Cookie', alice.cookie);

    expect(members.status).toBe(200);
    expect(members.body.members).toHaveLength(2);

    const bobMember = members.body.members.find(
      (member: { id: string }) => member.id === bob.id,
    );
    expect(bobMember).toMatchObject({
      id: bob.id,
      displayName: 'Bob',
      isCreator: false,
    });
    expect(typeof bobMember.joinedAt).toBe('string');

    const aliceMember = members.body.members.find(
      (member: { id: string }) => member.id === alice.id,
    );
    expect(aliceMember.isCreator).toBe(true);

    // 3. Bob's overview now contains "Trip".
    const overview = await api(ctx.server)
      .get('/api/groups')
      .set('Cookie', bob.cookie);

    expect(overview.status).toBe(200);
    const names = overview.body.groups.map(
      (group: { name: string }) => group.name,
    );
    expect(names).toContain('Trip');

    // 4. The approved request is no longer pending.
    const pending = await api(ctx.server)
      .get(`/api/groups/${trip.id}/join-requests`)
      .set('Cookie', alice.cookie);

    expect(pending.status).toBe(200);
    expect(pending.body).toEqual({ requests: [] });
  });
});
