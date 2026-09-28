/**
 * TC-GRP-023 — A user holds memberships in multiple groups simultaneously
 * (groups-membership.md §2; FR-GRP-009, BR-GRP-006, NFR-GRP-004).
 *
 * Alice creates group A; bob creates group B. Alice is not a member of B until
 * bob approves her request. She then holds both memberships at once: creator of
 * A and approved member of B — the two are independent (joining B does not
 * affect A's member list or alice's creator status in A).
 *
 * Integration level. All memberships are established through the public API.
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

describe('TC-GRP-023 — a user holds memberships in multiple groups simultaneously', () => {
  it('lets alice be creator of A and approved member of B at the same time', async () => {
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

    const groupA = await createGroup(ctx.server, alice.cookie, 'A');
    const groupB = await createGroup(ctx.server, bob.cookie, 'B');

    // 1. Alice resolves B's code, places a request, and bob approves.
    const info = await api(ctx.server)
      .get('/api/join-info')
      .set('Cookie', alice.cookie)
      .query({ code: groupB.joinCode });

    expect(info.status).toBe(200);
    expect(info.body).toEqual({
      groupId: groupB.id,
      groupName: 'B',
    });

    const request = await placeJoinRequest(
      ctx.server,
      alice.cookie,
      groupB.joinCode,
    );
    const approve = await api(ctx.server)
      .post(`/api/join-requests/${request.id}/approve`)
      .set(CSRF_HEADERS)
      .set('Cookie', bob.cookie);

    expect(approve.status).toBe(200);
    expect(approve.body.joinRequest.status).toBe('APPROVED');

    // 2. Alice's overview now lists exactly the two groups, A and B.
    const overview = await api(ctx.server)
      .get('/api/groups')
      .set('Cookie', alice.cookie);

    expect(overview.status).toBe(200);
    expect(overview.body.groups).toHaveLength(2);
    const names = overview.body.groups
      .map((group: { name: string }) => group.name)
      .sort();
    expect(names).toEqual(['A', 'B']);
    const ids = overview.body.groups
      .map((group: { id: string }) => group.id)
      .sort();
    expect(ids).toEqual([groupA.id, groupB.id].sort());

    // 3. Alice appears in both member lists with the right creator marker.
    const membersA = await api(ctx.server)
      .get(`/api/groups/${groupA.id}/members`)
      .set('Cookie', alice.cookie);

    expect(membersA.status).toBe(200);
    const aliceInA = membersA.body.members.find(
      (member: { id: string }) => member.id === alice.id,
    );
    expect(aliceInA).toMatchObject({
      id: alice.id,
      displayName: 'Alice',
      isCreator: true,
    });

    const membersB = await api(ctx.server)
      .get(`/api/groups/${groupB.id}/members`)
      .set('Cookie', alice.cookie);

    expect(membersB.status).toBe(200);
    const aliceInB = membersB.body.members.find(
      (member: { id: string }) => member.id === alice.id,
    );
    expect(aliceInB).toMatchObject({
      id: alice.id,
      displayName: 'Alice',
      isCreator: false,
    });

    // Memberships are independent: A still holds exactly alice as its creator;
    // joining B did not add anyone to A or change alice's creator status.
    expect(membersA.body.members).toHaveLength(1);
    expect(membersA.body.members[0].isCreator).toBe(true);
    expect(membersA.body.members[0].id).toBe(alice.id);
  });
});
