/**
 * TC-GRP-007 — Join-info resolves a valid code to the group's name only
 * (groups-membership.md §2; UC-GRP-002 steps 1–2, 03-api-design.md §3 join-info
 * row, FR-GRP-004 context, BR-GRP-003).
 *
 * Integration level: the real app in-process over supertest against a real
 * PostgreSQL, every table truncated before the test (strategy §2/§3).
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

describe('TC-GRP-007 — join-info returns the group name and nothing else', () => {
  it('resolves a valid code to exactly { groupId, groupName } for a non-member code holder', async () => {
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
    const trip = await createGroup(ctx.server, alice.cookie, 'Trip');

    // Step: GET /api/join-info?code=<Trip's code> as carol (non-member).
    const response = await api(ctx.server)
      .get('/api/join-info')
      .query({ code: trip.joinCode })
      .set('Cookie', carol.cookie);

    expect(response.status).toBe(200);
    // The body's keys are EXACTLY { groupId, groupName } — no member list, no
    // balances, no join code, no email addresses (FR-ACC-008).
    expect(Object.keys(response.body).sort()).toEqual(['groupId', 'groupName']);
    expect(response.body.groupId).toBe(trip.id);
    expect(response.body.groupName).toBe('Trip');
  });
});
