/**
 * TC-GRP-022 — CSRF header required on all Groups-domain state-changing routes
 * (groups-membership.md §2; 03-api-design.md §1, 01-system-architecture.md §8.2).
 *
 * Every state-changing request must carry `X-Requested-With: XMLHttpRequest`.
 * Calling any of the four Groups-domain state-changers — create group, place
 * join request, approve, reject — without it is rejected with
 * `403 CSRF_HEADER_MISSING` **before** the handler runs, so no side effect may
 * occur: no group created, no join request placed, and the pending request
 * remains `PENDING`.
 *
 * Integration level: the real app in-process over supertest against a real
 * PostgreSQL, every table truncated before each test.
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

describe('TC-GRP-022 — CSRF header required on all Groups-domain state-changing routes', () => {
  it('rejects header-less create/place/approve/reject with 403 and causes no side effect', async () => {
    const alice = await registerUser(
      ctx.server,
      'alice@test.local',
      TEST_PASSWORD,
      'Alice',
    );
    const carol = await registerUser(
      ctx.server,
      'carol@test.local',
      TEST_PASSWORD,
      'Carol',
    );

    // Preconditions: alice created "Trip"; carol has a pending request in it.
    const trip = await createGroup(ctx.server, alice.cookie, 'Trip');
    const pending = await placeJoinRequest(
      ctx.server,
      carol.cookie,
      trip.joinCode,
    );

    // Baseline side-effect state.
    const overviewBefore = await api(ctx.server)
      .get('/api/groups')
      .set('Cookie', alice.cookie);
    expect(overviewBefore.status).toBe(200);
    expect(overviewBefore.body.groups).toHaveLength(1);
    await expect(ctx.prisma.group.count()).resolves.toBe(1);
    await expect(ctx.prisma.joinRequest.count()).resolves.toBe(1);
    await expect(ctx.prisma.membership.count()).resolves.toBe(1);

    // The four state-changing calls, all without the CSRF header but with
    // otherwise valid input. Each is awaited before the next is built so the
    // shared in-process server is never torn down under a pending request.
    const createResponse = await api(ctx.server)
      .post('/api/groups')
      .set('Cookie', alice.cookie)
      .send({ name: 'Another' });
    expect(createResponse.status).toBe(403);
    expect(createResponse.body.error.code).toBe('CSRF_HEADER_MISSING');

    const placeResponse = await api(ctx.server)
      .post('/api/join-requests')
      .set('Cookie', carol.cookie)
      .send({ code: trip.joinCode });
    expect(placeResponse.status).toBe(403);
    expect(placeResponse.body.error.code).toBe('CSRF_HEADER_MISSING');

    const approveResponse = await api(ctx.server)
      .post(`/api/join-requests/${pending.id}/approve`)
      .set('Cookie', alice.cookie);
    expect(approveResponse.status).toBe(403);
    expect(approveResponse.body.error.code).toBe('CSRF_HEADER_MISSING');

    const rejectResponse = await api(ctx.server)
      .post(`/api/join-requests/${pending.id}/reject`)
      .set('Cookie', alice.cookie);
    expect(rejectResponse.status).toBe(403);
    expect(rejectResponse.body.error.code).toBe('CSRF_HEADER_MISSING');

    // No side effect: no group created — alice's overview is unchanged.
    const overviewAfter = await api(ctx.server)
      .get('/api/groups')
      .set('Cookie', alice.cookie);
    expect(overviewAfter.status).toBe(200);
    expect(overviewAfter.body.groups).toHaveLength(1);
    expect(overviewAfter.body.groups[0].name).toBe('Trip');
    await expect(ctx.prisma.group.count()).resolves.toBe(1);

    // No side effect: no new join request was placed.
    await expect(ctx.prisma.joinRequest.count()).resolves.toBe(1);

    // No side effect: the pending request remains PENDING and undecided.
    const requestRow = await ctx.prisma.joinRequest.findUnique({
      where: { id: pending.id },
    });
    expect(requestRow?.status).toBe('PENDING');
    expect(requestRow?.decidedAt).toBeNull();

    // No side effect: the approve attempt added no membership.
    await expect(ctx.prisma.membership.count()).resolves.toBe(1);
  });
});
