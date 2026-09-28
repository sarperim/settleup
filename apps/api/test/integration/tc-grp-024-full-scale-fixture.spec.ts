/**
 * TC-GRP-024 — Full-scale fixture: 8 users, 5 groups, 8-member group
 * (groups-membership.md §2; NFR-GRP-004, NFR-ACC-005 cross-domain promise,
 * project brief §7 expected scale).
 *
 * Builds the brief's maximum expected scale entirely through the public API —
 * 8 identities, 5 concurrent groups, one group at the 8-member ceiling — then
 * asserts every member list matches its fixture set and every user's overview
 * lists exactly their fixture groups.
 *
 * Integration level. All groups and memberships are established through the
 * public API factories.
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
  registerUser,
  TEST_PASSWORD,
  type CreatedGroup,
  type RegisteredUser,
} from './support/factories';

const IDENTITIES = [
  'alice',
  'bob',
  'carol',
  'dave',
  'erin',
  'frank',
  'grace',
  'heidi',
] as const;

type Identity = (typeof IDENTITIES)[number];

const DISPLAY_NAMES: Record<Identity, string> = {
  alice: 'Alice',
  bob: 'Bob',
  carol: 'Carol',
  dave: 'Dave',
  erin: 'Erin',
  frank: 'Frank',
  grace: 'Grace',
  heidi: 'Heidi',
};

interface GroupFixture {
  readonly name: string;
  readonly creator: Identity;
  readonly members: readonly Identity[];
}

const GROUP_FIXTURES: readonly GroupFixture[] = [
  {
    name: 'Trip',
    creator: 'alice',
    members: ['alice', 'bob', 'carol', 'dave', 'erin', 'frank', 'grace', 'heidi'],
  },
  { name: 'Dinner', creator: 'alice', members: ['alice', 'bob', 'carol'] },
  { name: 'Concert', creator: 'dave', members: ['dave', 'erin', 'frank'] },
  { name: 'Movie', creator: 'grace', members: ['grace', 'heidi', 'alice'] },
  { name: 'Picnic', creator: 'bob', members: ['bob', 'dave', 'frank', 'heidi'] },
];

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

describe('TC-GRP-024 — full-scale fixture: 8 users, 5 groups, 8-member group', () => {
  it('serves every member list and overview correctly at the brief’s maximum scale', async () => {
    // Register the 8 fixed identities.
    const users = {} as Record<Identity, RegisteredUser>;
    for (const identity of IDENTITIES) {
      users[identity] = await registerUser(
        ctx.server,
        `${identity}@test.local`,
        TEST_PASSWORD,
        DISPLAY_NAMES[identity],
      );
    }

    // Build the 5 groups and their memberships through the API.
    const groups = {} as Record<string, CreatedGroup>;
    for (const fixture of GROUP_FIXTURES) {
      const creator = users[fixture.creator];
      const group = await createGroup(ctx.server, creator.cookie, fixture.name);
      for (const member of fixture.members) {
        if (member === fixture.creator) {
          continue;
        }
        await joinAndApprove(
          ctx.server,
          creator.cookie,
          users[member].cookie,
          group.joinCode,
        );
      }
      groups[fixture.name] = group;
    }

    // Every member list matches its fixture set exactly, with exactly one
    // creator marker — the designated creator.
    for (const fixture of GROUP_FIXTURES) {
      const group = groups[fixture.name];
      const response = await api(ctx.server)
        .get(`/api/groups/${group.id}/members`)
        .set('Cookie', users[fixture.creator].cookie);

      expect(response.status).toBe(200);

      const actualIds = response.body.members
        .map((member: { id: string }) => member.id)
        .sort();
      const expectedIds = fixture.members
        .map((identity) => users[identity].id)
        .sort();
      expect(actualIds).toEqual(expectedIds);

      const creators = response.body.members.filter(
        (member: { isCreator: boolean }) => member.isCreator,
      );
      expect(creators).toHaveLength(1);
      expect(creators[0].id).toBe(users[fixture.creator].id);
    }

    // The 8-member ceiling is exercised exactly.
    const trip = groups['Trip'];
    const tripMembers = await api(ctx.server)
      .get(`/api/groups/${trip.id}/members`)
      .set('Cookie', users.alice.cookie);
    expect(tripMembers.body.members).toHaveLength(8);

    // Every user's overview lists exactly their fixture groups.
    for (const identity of IDENTITIES) {
      const response = await api(ctx.server)
        .get('/api/groups')
        .set('Cookie', users[identity].cookie);

      expect(response.status).toBe(200);

      const actualNames = response.body.groups
        .map((group: { name: string }) => group.name)
        .sort();
      const expectedNames = GROUP_FIXTURES.filter((fixture) =>
        fixture.members.includes(identity),
      )
        .map((fixture) => fixture.name)
        .sort();
      expect(actualNames).toEqual(expectedNames);
    }
  }, 30_000);
});
