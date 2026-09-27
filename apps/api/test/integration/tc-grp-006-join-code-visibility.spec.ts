/**
 * TC-GRP-006 — Join-code visibility: creator sees it, other members do not;
 * codes distinct across groups (groups-membership.md §2; FR-GRP-002 both
 * aspects, BR-GRP-002, 02-data-model.md §4 `joinCode`, 03-api-design.md §3).
 *
 * Integration level. Bob's membership is a read-path fixture (strategy §5).
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
import { JOIN_CODE_PATTERN } from '../../src/groups/join-code';

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

/** A complete 8-character Crockford code (an exact field value). */
const EXACT_CODE = /^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{8}$/;

/** Every string leaf value in a nested JSON value. */
function stringLeaves(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(stringLeaves);
  }
  if (value !== null && typeof value === 'object') {
    return Object.values(value).flatMap(stringLeaves);
  }
  return [];
}

describe('TC-GRP-006 — join code is creator-only and unique per group', () => {
  it('hides the join code from a non-creator member and issues distinct codes per group', async () => {
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

    const groupA = await createGroup(ctx.server, alice.cookie, 'Trip');
    await seedMembership(ctx.prisma, groupA.id, bob.id, false);
    const groupB = await createGroup(ctx.server, alice.cookie, 'Dinner');

    // 1. Bob (member, not creator) sees the group’s name but no join code.
    const detail = await api(ctx.server)
      .get(`/api/groups/${groupA.id}`)
      .set('Cookie', bob.cookie);

    expect(detail.status).toBe(200);
    expect(detail.body.group.name).toBe('Trip');
    expect(detail.body.group).not.toHaveProperty('joinCode');
    // No join code leaks under any key: the exact code string is absent and no
    // string field is itself an 8-char Crockford code. (The check is on field
    // values, not raw substrings — an opaque cuid can contain an 8-digit run
    // that is not a code.)
    expect(JSON.stringify(detail.body)).not.toContain(groupA.joinCode);
    expect(stringLeaves(detail.body).some((leaf) => EXACT_CODE.test(leaf))).toBe(
      false,
    );

    // 2. A’s and B’s join codes are distinct and both well-formed.
    expect(groupA.joinCode).toMatch(JOIN_CODE_PATTERN);
    expect(groupB.joinCode).toMatch(JOIN_CODE_PATTERN);
    expect(groupA.joinCode).not.toBe(groupB.joinCode);
  });
});
