/**
 * TC-GRP-003 — Create a group: creator membership, join code issued and visible
 * (groups-membership.md §2; FR-GRP-001, FR-GRP-002, UC-GRP-001 main steps 2–3,
 * BR-GRP-001, BR-GRP-002, BR-GRP-005).
 *
 * Integration level: the real app in-process over supertest against a real
 * PostgreSQL, every table truncated before the test (strategy §2/§3).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  api,
  createIntegrationApp,
  CSRF_HEADERS,
  type IntegrationApp,
} from './support/app';
import { truncateAllTables } from './support/truncate';
import { registerUser, TEST_PASSWORD } from './support/factories';
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

describe('TC-GRP-003 — create group establishes the creator membership and issues a join code', () => {
  it('creates the group, returns its join code, and exposes both on the creator’s reads', async () => {
    const alice = await registerUser(
      ctx.server,
      'alice@test.local',
      TEST_PASSWORD,
      'Alice',
    );

    // 1. POST /api/groups as alice with { name: "Trip" }.
    const create = await api(ctx.server)
      .post('/api/groups')
      .set(CSRF_HEADERS)
      .set('Cookie', alice.cookie)
      .send({ name: 'Trip' });

    expect(create.status).toBe(201);
    expect(Object.keys(create.body)).toEqual(['group']);
    const group = create.body.group;
    expect(group.name).toBe('Trip');
    expect(typeof group.id).toBe('string');
    expect(group.id.length).toBeGreaterThan(0);
    expect(group.joinCode).toMatch(JOIN_CODE_PATTERN);

    // 2. The creator sees the same join code on the group detail read.
    const detail = await api(ctx.server)
      .get(`/api/groups/${group.id}`)
      .set('Cookie', alice.cookie);

    expect(detail.status).toBe(200);
    expect(detail.body.group.id).toBe(group.id);
    expect(detail.body.group.name).toBe('Trip');
    expect(detail.body.group.joinCode).toBe(group.joinCode);

    // 3. Exactly one member: alice, the creator (BR-GRP-005 atomic insert).
    const members = await api(ctx.server)
      .get(`/api/groups/${group.id}/members`)
      .set('Cookie', alice.cookie);

    expect(members.status).toBe(200);
    expect(members.body.members).toHaveLength(1);
    const [member] = members.body.members;
    expect(member.id).toBe(alice.id);
    expect(member.displayName).toBe('Alice');
    expect(member.isCreator).toBe(true);
  });
});
