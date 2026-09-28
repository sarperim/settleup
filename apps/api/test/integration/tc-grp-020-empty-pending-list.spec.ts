/**
 * TC-GRP-020 — Empty pending list is a valid state
 * (groups-membership.md §2; FR-GRP-005, UC-GRP-003/004 step 1).
 *
 * Integration level.
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

describe('TC-GRP-020 — an empty pending list is a valid state', () => {
  it('returns 200 { requests: [] } when no join requests exist', async () => {
    const alice = await registerUser(
      ctx.server,
      'alice@test.local',
      TEST_PASSWORD,
      'Alice',
    );
    const trip = await createGroup(ctx.server, alice.cookie, 'Trip');

    const response = await api(ctx.server)
      .get(`/api/groups/${trip.id}/join-requests`)
      .set('Cookie', alice.cookie);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ requests: [] });
  });
});
