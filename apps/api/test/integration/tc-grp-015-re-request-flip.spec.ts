/**
 * TC-GRP-015 — Re-request after rejection flips the existing row
 * (groups-membership.md §2; FR-GRP-011, BR-GRP-010, UC-GRP-004 postcondition,
 * 02-data-model.md §5.3).
 *
 * Integration level. The re-request flip is implemented in TKT-groups-002's
 * `place()`; its acceptance lands here (ticket refs 02 §5.3).
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

describe('TC-GRP-015 — re-request after rejection flips the existing row to PENDING', () => {
  it('reuses the (groupId, userId) row, clears decidedAt, and keeps a single pending request', async () => {
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

    // Precondition: bob's request was rejected.
    const rejected = await placeJoinRequest(
      ctx.server,
      bob.cookie,
      trip.joinCode,
    );
    const reject = await api(ctx.server)
      .post(`/api/join-requests/${rejected.id}/reject`)
      .set(CSRF_HEADERS)
      .set('Cookie', alice.cookie);
    expect(reject.status).toBe(200);
    expect(reject.body.joinRequest.status).toBe('REJECTED');

    // 1. Re-request with the same code → PENDING, same row reused.
    const again = await api(ctx.server)
      .post('/api/join-requests')
      .set(CSRF_HEADERS)
      .set('Cookie', bob.cookie)
      .send({ code: trip.joinCode });

    expect(again.status).toBe(201);
    expect(again.body.joinRequest.status).toBe('PENDING');
    expect(again.body.joinRequest.id).toBe(rejected.id);

    // 2. Exactly one pending request for bob through the creator's list.
    const pending = await api(ctx.server)
      .get(`/api/groups/${trip.id}/join-requests`)
      .set('Cookie', alice.cookie);

    expect(pending.status).toBe(200);
    expect(pending.body.requests).toHaveLength(1);
    expect(pending.body.requests[0].requester).toEqual({
      id: bob.id,
      displayName: 'Bob',
    });

    // 3. Exactly one row for (Trip, bob); PENDING with decidedAt cleared.
    const rows = await ctx.prisma.joinRequest.findMany({
      where: { groupId: trip.id, userId: bob.id },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('PENDING');
    expect(rows[0]?.decidedAt).toBeNull();
  });
});
