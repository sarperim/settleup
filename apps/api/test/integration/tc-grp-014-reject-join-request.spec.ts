/**
 * TC-GRP-014 — Reject a pending join request closes it without membership
 * (groups-membership.md §2; FR-GRP-007, UC-GRP-004 main, BR-GRP-004,
 * 03-api-design.md §3 reject row).
 *
 * Integration level. The pending request is placed through the public API.
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

describe('TC-GRP-014 — rejecting a pending join request closes it without membership', () => {
  it('closes the request as REJECTED, adds no member, and empties the pending list', async () => {
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

    // 1. POST .../reject as the creator.
    const reject = await api(ctx.server)
      .post(`/api/join-requests/${request.id}/reject`)
      .set(CSRF_HEADERS)
      .set('Cookie', alice.cookie);

    expect(reject.status).toBe(200);
    expect(Object.keys(reject.body)).toEqual(['joinRequest']);
    expect(reject.body.joinRequest.status).toBe('REJECTED');
    expect(typeof reject.body.joinRequest.decidedAt).toBe('string');

    // 2. The member list is unchanged — bob was not added.
    const members = await api(ctx.server)
      .get(`/api/groups/${trip.id}/members`)
      .set('Cookie', alice.cookie);

    expect(members.status).toBe(200);
    expect(members.body.members).toHaveLength(1);
    expect(members.body.members[0].id).toBe(alice.id);

    // 3. Bob's overview does not contain "Trip".
    const overview = await api(ctx.server)
      .get('/api/groups')
      .set('Cookie', bob.cookie);

    expect(overview.status).toBe(200);
    const names = overview.body.groups.map(
      (group: { name: string }) => group.name,
    );
    expect(names).not.toContain('Trip');

    // 4. The rejected request is no longer pending.
    const pending = await api(ctx.server)
      .get(`/api/groups/${trip.id}/join-requests`)
      .set('Cookie', alice.cookie);

    expect(pending.status).toBe(200);
    expect(pending.body).toEqual({ requests: [] });
  });
});
