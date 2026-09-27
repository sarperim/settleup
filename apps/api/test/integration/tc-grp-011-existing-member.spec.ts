/**
 * TC-GRP-011 — Join request by an existing member is rejected
 * (groups-membership.md §2; FR-GRP-013, UC-GRP-002 A1, 02-data-model.md §5.3).
 *
 * Both the creator (a member from creation, BR-GRP-005) and an approved joiner
 * are members, so neither may place a request: `409 ALREADY_MEMBER` and no
 * request row is created.
 *
 * Translation note (flagged deviation — planning defect P-2): the "approved
 * member (factory)" precondition names `joinAndApprove`, which lands with
 * **TKT-groups-003** (it owns the approve route). As in TKT-groups-001's
 * adjudicated read-path seeding (review P-1/A-1), the membership fact is
 * seeded directly for this read/authorization fixture.
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
  seedMembership,
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

describe('TC-GRP-011 — an existing member cannot place a join request', () => {
  it('rejects the creator-self and an approved joiner with 409 ALREADY_MEMBER and no request row', async () => {
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
    await seedMembership(ctx.prisma, trip.id, bob.id, false);

    // 1. The creator requests to join their own group.
    const creator = await api(ctx.server)
      .post('/api/join-requests')
      .set(CSRF_HEADERS)
      .set('Cookie', alice.cookie)
      .send({ code: trip.joinCode });

    expect(creator.status).toBe(409);
    expect(creator.body.error.code).toBe('ALREADY_MEMBER');

    // 2. An approved member requests again.
    const member = await api(ctx.server)
      .post('/api/join-requests')
      .set(CSRF_HEADERS)
      .set('Cookie', bob.cookie)
      .send({ code: trip.joinCode });

    expect(member.status).toBe(409);
    expect(member.body.error.code).toBe('ALREADY_MEMBER');

    // No request row was created for either case.
    expect(await ctx.prisma.joinRequest.count()).toBe(0);
  });
});
