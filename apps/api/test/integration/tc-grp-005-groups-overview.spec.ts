/**
 * TC-GRP-005 — Groups overview lists exactly the caller's memberships
 * (groups-membership.md §2; FR-GRP-009 read side, UC-ACC-002 step 3,
 * BR-GRP-006).
 *
 * Integration level. Bob's membership is a read-path fixture seeded directly at
 * the documented data model (strategy §5) — the API-driven `joinAndApprove`
 * factory lands with TKT-groups-003, which owns the approve route.
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

describe('TC-GRP-005 — overview is exactly the caller’s memberships', () => {
  it('returns an empty list for a membership-less caller and the joined group for a member', async () => {
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

    const group = await createGroup(ctx.server, alice.cookie, 'Trip');
    await seedMembership(ctx.prisma, group.id, bob.id, false);

    // 1. A freshly registered user with no memberships gets a valid empty list.
    const empty = await api(ctx.server)
      .get('/api/groups')
      .set('Cookie', carol.cookie);

    expect(empty.status).toBe(200);
    expect(empty.body.groups).toEqual([]);

    // 2. Bob sees exactly the one group he is a member of, with id and name.
    const overview = await api(ctx.server)
      .get('/api/groups')
      .set('Cookie', bob.cookie);

    expect(overview.status).toBe(200);
    expect(overview.body.groups).toHaveLength(1);
    const [entry] = overview.body.groups;
    expect(entry.id).toBe(group.id);
    expect(entry.name).toBe('Trip');
  });
});
