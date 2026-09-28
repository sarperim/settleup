/**
 * TC-GRP-017 — Pending-request list is creator-only
 * (groups-membership.md §2; FR-GRP-005, 03-api-design.md §3 join-requests row,
 * 01-system-architecture.md §8.1 layer 3).
 *
 * Integration level. Bob becomes a member non-creator via the `joinAndApprove`
 * factory; carol places a pending request.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  api,
  createIntegrationApp,
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

describe('TC-GRP-017 — the pending-request list is creator-only', () => {
  it('returns the pending request to the creator and 403 NOT_GROUP_CREATOR to a member', async () => {
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

    // A member non-creator (bob) and a pending requester (carol).
    await joinAndApprove(ctx.server, alice.cookie, bob.cookie, trip.joinCode);
    await placeJoinRequest(ctx.server, carol.cookie, trip.joinCode);

    // 1. The creator sees exactly one pending request, referencing carol by
    //    display name only (FR-ACC-008).
    const asCreator = await api(ctx.server)
      .get(`/api/groups/${trip.id}/join-requests`)
      .set('Cookie', alice.cookie);

    expect(asCreator.status).toBe(200);
    expect(asCreator.body.requests).toHaveLength(1);
    expect(asCreator.body.requests[0].requester).toEqual({
      id: carol.id,
      displayName: 'Carol',
    });
    expect(JSON.stringify(asCreator.body)).not.toContain('@test.local');

    // 2. A member who is not the creator is rejected.
    const asMember = await api(ctx.server)
      .get(`/api/groups/${trip.id}/join-requests`)
      .set('Cookie', bob.cookie);

    expect(asMember.status).toBe(403);
    expect(asMember.body.error.code).toBe('NOT_GROUP_CREATOR');
  });
});
