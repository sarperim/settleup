/**
 * TC-GRP-009 — Place a join request with a valid code
 * (groups-membership.md §2; FR-GRP-003, UC-GRP-002 main, BR-GRP-003).
 *
 * Translation note (flagged deviation — planning defect P-2): step 2 of the TC
 * reads `GET /api/groups/:groupId/join-requests`, but that creator-only list
 * route is owned by **TKT-groups-003** (it depends on this ticket, and this
 * ticket's declared scope is only `GET /api/join-info` + `POST
 * /api/join-requests`). Implementing it here would be scope creep into another
 * ticket, so the "exactly one pending request for bob" fact is asserted by
 * reading the `join_requests` table directly — the documented data model, and
 * the same direct-table-read technique TC-GRP-015 step 3 sanctions. The
 * requester's display-name identity (FR-ACC-008) is asserted on the `POST`
 * response body's `requester` reference instead. When TKT-groups-003 lands the
 * list route, this spec should be strengthened to assert through it.
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

describe('TC-GRP-009 — a valid code places a PENDING join request', () => {
  it('returns 201 { joinRequest } with status PENDING and records exactly one pending row for bob', async () => {
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

    // 1. POST /api/join-requests as bob with { code: "<Trip's code>" }.
    const place = await api(ctx.server)
      .post('/api/join-requests')
      .set(CSRF_HEADERS)
      .set('Cookie', bob.cookie)
      .send({ code: trip.joinCode });

    expect(place.status).toBe(201);
    expect(Object.keys(place.body)).toEqual(['joinRequest']);
    const joinRequest = place.body.joinRequest;
    expect(joinRequest.status).toBe('PENDING');
    expect(joinRequest.groupId).toBe(trip.id);
    // The requester is exposed by display name only — never email (FR-ACC-008).
    expect(joinRequest.requester).toEqual({ id: bob.id, displayName: 'Bob' });

    // 2. The pending list (direct table read — see the deviation note above)
    //    contains exactly one request, referencing bob.
    const rows = await ctx.prisma.joinRequest.findMany({
      where: { groupId: trip.id },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.userId).toBe(bob.id);
    expect(rows[0]?.status).toBe('PENDING');
  });
});
