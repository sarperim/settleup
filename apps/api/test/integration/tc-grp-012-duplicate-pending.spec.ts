/**
 * TC-GRP-012 — Duplicate pending request is rejected
 * (groups-membership.md §2; FR-GRP-012, UC-GRP-002 A2, 02-data-model.md §4
 * `JoinRequest @@unique(groupId,userId)`).
 *
 * A second request while one is pending yields `409 PENDING_REQUEST_EXISTS` and
 * creates no duplicate row.
 *
 * Translation note (flagged deviation — planning defect P-2): the TC's "the
 * creator's pending list still contains exactly one request" step reads `GET
 * /api/groups/:groupId/join-requests`, owned by **TKT-groups-003**. The
 * structural single-row guarantee is asserted by reading the `join_requests`
 * table directly (documented data model; the technique TC-GRP-015 step 3
 * sanctions), avoiding scope creep into another ticket's route.
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

describe('TC-GRP-012 — a duplicate pending request is rejected', () => {
  it('returns 409 PENDING_REQUEST_EXISTS on the second request and keeps exactly one row', async () => {
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

    const first = await api(ctx.server)
      .post('/api/join-requests')
      .set(CSRF_HEADERS)
      .set('Cookie', bob.cookie)
      .send({ code: trip.joinCode });
    expect(first.status).toBe(201);

    // The same request a second time.
    const second = await api(ctx.server)
      .post('/api/join-requests')
      .set(CSRF_HEADERS)
      .set('Cookie', bob.cookie)
      .send({ code: trip.joinCode });

    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('PENDING_REQUEST_EXISTS');

    // No duplicate row: exactly one pending request for bob remains.
    const rows = await ctx.prisma.joinRequest.findMany({
      where: { groupId: trip.id, userId: bob.id },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('PENDING');
  });
});
