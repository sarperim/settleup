/**
 * TC-ACC-018 — Group-scoped payloads never expose email addresses
 * (testing/accounts-access.md §2; FR-ACC-008, BR-ACC-003, 03-api-design.md §1
 * identity-exposure rule, §2/§3/§3b/§3c).
 *
 * Integration level. The fixture is assembled from the strategy §5 factories
 * only (which drive the public API): alice is the group creator, bob an
 * approved member, carol a **pending** join requester (not a member), and one
 * expense is logged by alice splitting alice + bob. As alice (the creator, who
 * can read every one of the seven routes, including the creator-only pending
 * list), each group-scoped read is exercised and its payload asserted:
 *
 *   (a) no member's raw email address appears anywhere in the body;
 *   (b) every user reference carries a `displayName`;
 *   (c) the three members are distinguishable by their display names.
 *
 * The seven routes are the group-scoped read surface across all domains
 * (Accounts/Groups/Expenses/Balances): `GET /api/groups/:groupId`,
 * `…/members`, `…/join-requests`, `…/expenses`, `…/expenses/:expenseId`,
 * `…/balances`, `…/settlements`.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  api,
  createIntegrationApp,
  type IntegrationApp,
} from './support/app';
import { truncateAllTables } from './support/truncate';
import {
  createExpense,
  createGroup,
  joinAndApprove,
  placeJoinRequest,
  registerUser,
  TEST_PASSWORD,
  type RegisteredUser,
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

/** A user reference discovered in a response payload. */
interface DiscoveredRef {
  readonly path: string;
  readonly value: Record<string, unknown>;
}

/** A raw user id leaked outside a `{ id, displayName }` reference. */
interface BareUserId {
  readonly path: string;
  readonly id: string;
}

interface RefScan {
  readonly refs: DiscoveredRef[];
  readonly bareIds: BareUserId[];
}

/**
 * Walk a JSON value and classify every occurrence of a known user id:
 *   - an object whose `id` is a known user id is a **user reference**;
 *   - a known user id appearing anywhere else is a **bare** leak.
 *
 * The distinction matters: (b) requires every user reference to carry
 * `displayName`, and a bare id (`{ userId: alice.id }`) is a leak that carries
 * none by construction.
 */
function scanUserRefs(
  value: unknown,
  userIds: ReadonlySet<string>,
): RefScan {
  const refs: DiscoveredRef[] = [];
  const bareIds: BareUserId[] = [];

  const walk = (node: unknown, path: string, isRefOwnId: boolean): void => {
    if (typeof node === 'string') {
      if (userIds.has(node) && !isRefOwnId) {
        bareIds.push({ path, id: node });
      }
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((child, index) => walk(child, `${path}[${index}]`, false));
      return;
    }
    if (node !== null && typeof node === 'object') {
      const record = node as Record<string, unknown>;
      const id = record.id;
      const isRef = typeof id === 'string' && userIds.has(id);
      if (isRef) {
        refs.push({ path, value: record });
      }
      for (const [key, child] of Object.entries(record)) {
        walk(child, `${path}.${key}`, isRef && key === 'id');
      }
    }
  };

  walk(value, '$', false);
  return { refs, bareIds };
}

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

describe('TC-ACC-018 — group-scoped payloads never expose email addresses', () => {
  it('omits email, carries displayName on every user reference, and keeps the three members distinguishable', async () => {
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

    // alice creates the group; bob is an approved member; carol is a *pending*
    // requester (never approved) — the fixture deliberately keeps a non-member
    // identity in the join-request payload.
    const group = await createGroup(ctx.server, alice.cookie, 'Trip');
    await joinAndApprove(ctx.server, alice.cookie, bob.cookie, group.joinCode);
    await placeJoinRequest(ctx.server, carol.cookie, group.joinCode);

    // One expense: paid by alice, split alice + bob only.
    const expense = await createExpense(ctx.server, alice.cookie, group.id, {
      description: 'Dinner',
      amountKurus: 9000,
      payerId: alice.id,
      participantIds: [alice.id, bob.id],
      splitType: 'EQUAL',
    });

    const members: RegisteredUser[] = [alice, bob, carol];
    const userIds = new Set(members.map((member) => member.id));
    const expectedDisplayNames = new Map<string, string>([
      [alice.id, 'Alice'],
      [bob.id, 'Bob'],
      [carol.id, 'Carol'],
    ]);

    // The seven group-scoped read routes, all as alice (creator + member).
    const reads: Array<{ readonly label: string; readonly body: unknown }> = [];

    const groupDetail = await api(ctx.server)
      .get(`/api/groups/${group.id}`)
      .set('Cookie', alice.cookie);
    expect(groupDetail.status).toBe(200);
    reads.push({ label: 'GET /api/groups/:groupId', body: groupDetail.body });

    const memberList = await api(ctx.server)
      .get(`/api/groups/${group.id}/members`)
      .set('Cookie', alice.cookie);
    expect(memberList.status).toBe(200);
    reads.push({ label: 'GET …/members', body: memberList.body });

    const joinRequests = await api(ctx.server)
      .get(`/api/groups/${group.id}/join-requests`)
      .set('Cookie', alice.cookie);
    expect(joinRequests.status).toBe(200);
    reads.push({ label: 'GET …/join-requests', body: joinRequests.body });

    const expenseList = await api(ctx.server)
      .get(`/api/groups/${group.id}/expenses`)
      .set('Cookie', alice.cookie);
    expect(expenseList.status).toBe(200);
    reads.push({ label: 'GET …/expenses', body: expenseList.body });

    const expenseDetail = await api(ctx.server)
      .get(`/api/groups/${group.id}/expenses/${expense.id}`)
      .set('Cookie', alice.cookie);
    expect(expenseDetail.status).toBe(200);
    reads.push({ label: 'GET …/expenses/:expenseId', body: expenseDetail.body });

    const balances = await api(ctx.server)
      .get(`/api/groups/${group.id}/balances`)
      .set('Cookie', alice.cookie);
    expect(balances.status).toBe(200);
    reads.push({ label: 'GET …/balances', body: balances.body });

    const settlements = await api(ctx.server)
      .get(`/api/groups/${group.id}/settlements`)
      .set('Cookie', alice.cookie);
    expect(settlements.status).toBe(200);
    reads.push({ label: 'GET …/settlements', body: settlements.body });

    expect(reads).toHaveLength(7);

    const seenIds = new Set<string>();
    const seenNames = new Set<string>();

    for (const { label, body } of reads) {
      // (a) No member's raw email address appears anywhere in the body.
      const serialized = JSON.stringify(body);
      for (const { email } of members) {
        expect(serialized, `${label} exposes ${email}`).not.toContain(email);
      }
      // Belt-and-suspenders: no `@`-bearing string leak beyond the exact emails.
      expect(
        stringLeaves(body).filter((leaf) => leaf.includes('@')),
        `${label} exposes an @-bearing string`,
      ).toEqual([]);

      // (b) Every user reference carries `displayName`; no bare user id leaks.
      const { refs, bareIds } = scanUserRefs(body, userIds);
      expect(
        refs.length,
        `${label} carries no user reference (vacuous check)`,
      ).toBeGreaterThan(0);
      expect(bareIds, `${label} leaks a bare user id`).toEqual([]);

      for (const { path, value } of refs) {
        const id = value.id as string;
        expect(
          typeof value.displayName,
          `${label} ${path} has no displayName`,
        ).toBe('string');
        const displayName = value.displayName as string;
        expect(
          displayName.length,
          `${label} ${path} has an empty displayName`,
        ).toBeGreaterThan(0);
        // The reference is `{ id, displayName }` only — no email-bearing key.
        expect(Object.keys(value)).not.toContain('email');
        expect(serialized, `${label} ${path} carries an @`).not.toContain('@');
        // (c) Every reference uses the member's canonical, distinguishable name.
        expect(value.displayName, `${label} ${path} displayName`).toBe(
          expectedDisplayNames.get(id),
        );
        seenIds.add(id);
        seenNames.add(displayName);
      }
    }

    // (c) Across the whole payload matrix the three members are all referenced
    //     and are distinguishable by display name.
    expect([...seenIds].sort()).toEqual(
      [alice.id, bob.id, carol.id].sort(),
    );
    expect([...seenNames].sort()).toEqual(['Alice', 'Bob', 'Carol']);
    expect(seenNames.size).toBe(3);
  });
});
