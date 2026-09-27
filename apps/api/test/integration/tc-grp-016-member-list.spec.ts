/**
 * TC-GRP-016 — Member list shape and set semantics
 * (groups-membership.md §2; FR-GRP-010, UC-GRP-005 main, FR-ACC-008 API side,
 * 03-api-design.md §3 members row shape).
 *
 * Integration level. Bob's and carol's memberships are read-path fixtures
 * (strategy §5).
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

describe('TC-GRP-016 — member list shape and set semantics', () => {
  it('returns every member with display names, a single creator marker, and no email', async () => {
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
    await seedMembership(ctx.prisma, group.id, carol.id, false);

    // Any member may read the list.
    const members = await api(ctx.server)
      .get(`/api/groups/${group.id}/members`)
      .set('Cookie', bob.cookie);

    expect(members.status).toBe(200);
    expect(members.body.members).toHaveLength(3);

    for (const member of members.body.members) {
      expect(typeof member.id).toBe('string');
      expect(typeof member.displayName).toBe('string');
      expect(typeof member.isCreator).toBe('boolean');
      expect(typeof member.joinedAt).toBe('string');
    }

    const creators = members.body.members.filter(
      (member: { isCreator: boolean }) => member.isCreator,
    );
    expect(creators).toHaveLength(1);
    expect(creators[0].id).toBe(alice.id);

    const displayNames = members.body.members
      .map((member: { displayName: string }) => member.displayName)
      .sort();
    expect(displayNames).toEqual(['Alice', 'Bob', 'Carol']);

    // FR-ACC-008: no email appears anywhere in the body.
    const serialized = JSON.stringify(members.body);
    expect(serialized).not.toContain('@test.local');
    expect(serialized).not.toContain('alice@');
    expect(serialized).not.toContain('bob@');
    expect(serialized).not.toContain('carol@');
  });
});
