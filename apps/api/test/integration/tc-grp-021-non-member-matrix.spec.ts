/**
 * TC-GRP-021 — SC-006 authorization matrix: every group-scoped route denies
 * non-members with existence hiding
 * (groups-membership.md §2; FR-GRP-008, BR-GRP-009, NFR-GRP-001, SC-006,
 * UC-GRP-006 main, arch. §8.1 layer 2, 03-api-design.md §1 existence hiding).
 *
 * Two non-member subclasses of a real, data-bearing group G are exercised
 * against **all 12** group-scoped routes: `carol` (registered, no memberships)
 * and `dave` (registered, member of a *different* group). Every route — read
 * **and** modify — must answer `404 NOT_FOUND` on G's real id, and the response
 * on G must be byte-for-byte indistinguishable (status, `error.code`,
 * `error.message`) from the response on a nonexistent group id, so a non-member
 * cannot tell an existing group from a missing one. Dummy sub-ids are permitted
 * because the `GroupMemberGuard` resolves membership on `:groupId` first.
 *
 * The anonymous half of the matrix is TC-ACC-015 (all 21 endpoints → 401) and
 * is deliberately not duplicated here.
 *
 * Integration level: the real app in-process over supertest against a real
 * PostgreSQL, every table truncated before each test.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Response } from 'supertest';
import {
  api,
  createIntegrationApp,
  CSRF_HEADERS,
  type IntegrationApp,
} from './support/app';
import { truncateAllTables } from './support/truncate';
import {
  createExpense,
  createGroup,
  joinAndApprove,
  registerUser,
  TEST_PASSWORD,
  type CreatedExpense,
  type RegisteredUser,
} from './support/factories';

/** A syntactically valid but nonexistent cuid (25 chars, `c`-prefixed). */
const NONEXISTENT_ID = 'clx0000000000000000000000';

type HttpMethod = 'get' | 'post' | 'patch' | 'delete';

const STATE_CHANGING: ReadonlySet<HttpMethod> = new Set([
  'post',
  'patch',
  'delete',
]);

interface GroupScopedRoute {
  readonly label: string;
  readonly method: HttpMethod;
  /** The route path for a given `:groupId`. */
  readonly path: (groupId: string) => string;
  /** A syntactically valid body for state-changing routes. */
  readonly body?: Record<string, unknown>;
}

/** The 12 group-scoped routes of C3/C4/C5 (03-api-design.md §3/§3b/§3c). */
const GROUP_SCOPED_ROUTES: readonly GroupScopedRoute[] = [
  {
    label: 'GET /api/groups/:groupId',
    method: 'get',
    path: (g) => `/api/groups/${g}`,
  },
  {
    label: 'GET /api/groups/:groupId/members',
    method: 'get',
    path: (g) => `/api/groups/${g}/members`,
  },
  {
    label: 'GET /api/groups/:groupId/join-requests',
    method: 'get',
    path: (g) => `/api/groups/${g}/join-requests`,
  },
  {
    label: 'POST /api/groups/:groupId/expenses',
    method: 'post',
    path: (g) => `/api/groups/${g}/expenses`,
    body: {
      description: 'Dummy expense',
      amountKurus: 1000,
      payerId: NONEXISTENT_ID,
      participantIds: [NONEXISTENT_ID],
      splitType: 'EQUAL',
    },
  },
  {
    label: 'GET /api/groups/:groupId/expenses',
    method: 'get',
    path: (g) => `/api/groups/${g}/expenses`,
  },
  {
    label: 'GET /api/groups/:groupId/expenses/:expenseId',
    method: 'get',
    path: (g) => `/api/groups/${g}/expenses/${NONEXISTENT_ID}`,
  },
  {
    label: 'PATCH /api/groups/:groupId/expenses/:expenseId',
    method: 'patch',
    path: (g) => `/api/groups/${g}/expenses/${NONEXISTENT_ID}`,
    body: { description: 'Edited' },
  },
  {
    label: 'DELETE /api/groups/:groupId/expenses/:expenseId',
    method: 'delete',
    path: (g) => `/api/groups/${g}/expenses/${NONEXISTENT_ID}`,
  },
  {
    label: 'GET /api/groups/:groupId/balances',
    method: 'get',
    path: (g) => `/api/groups/${g}/balances`,
  },
  {
    label: 'GET /api/groups/:groupId/settlements',
    method: 'get',
    path: (g) => `/api/groups/${g}/settlements`,
  },
  {
    label: 'POST /api/groups/:groupId/settlements',
    method: 'post',
    path: (g) => `/api/groups/${g}/settlements`,
    body: {
      payerId: NONEXISTENT_ID,
      recipientId: NONEXISTENT_ID,
      amountKurus: 1000,
    },
  },
  {
    label: 'POST /api/groups/:groupId/settlements/:settlementId/undo',
    method: 'post',
    path: (g) => `/api/groups/${g}/settlements/${NONEXISTENT_ID}/undo`,
  },
];

/**
 * The TC-GRP-021 precondition fixture: alice creates G and approves bob; one
 * expense lives in G (payer alice, EQUAL alice+bob, so read routes carry real
 * data). carol is registered with no memberships; dave owns a different group.
 */
interface NonMemberFixture {
  readonly alice: RegisteredUser;
  readonly bob: RegisteredUser;
  readonly carol: RegisteredUser;
  readonly dave: RegisteredUser;
  readonly group: { readonly id: string; readonly joinCode: string };
  readonly expense: CreatedExpense;
}

async function buildNonMemberFixture(): Promise<NonMemberFixture> {
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
  const dave = await registerUser(
    ctx.server,
    'dave@test.local',
    TEST_PASSWORD,
    'Dave',
  );

  const group = await createGroup(ctx.server, alice.cookie, 'Trip');
  await joinAndApprove(ctx.server, alice.cookie, bob.cookie, group.joinCode);

  const expense = await createExpense(ctx.server, alice.cookie, group.id, {
    description: 'Group dinner',
    amountKurus: 2000,
    payerId: alice.id,
    participantIds: [alice.id, bob.id],
    splitType: 'EQUAL',
  });

  // dave is a member of his own group — the "member of another group" subclass.
  await createGroup(ctx.server, dave.cookie, 'Dave solo');

  return { alice, bob, carol, dave, group, expense };
}

async function callRoute(
  caller: RegisteredUser,
  route: GroupScopedRoute,
  groupId: string,
): Promise<Response> {
  const agent = api(ctx.server);
  const request =
    route.method === 'get'
      ? agent.get(route.path(groupId))
      : route.method === 'post'
        ? agent.post(route.path(groupId))
        : route.method === 'patch'
          ? agent.patch(route.path(groupId))
          : agent.delete(route.path(groupId));

  const withCookie = request.set('Cookie', caller.cookie);
  const withCsrf = STATE_CHANGING.has(route.method)
    ? withCookie.set(CSRF_HEADERS)
    : withCookie;

  return route.body === undefined ? withCsrf : withCsrf.send(route.body);
}

/** The observable group facts the no-side-effect check compares. */
interface GroupFacts {
  readonly memberIds: readonly string[];
  readonly expenses: readonly CreatedExpense[];
  readonly sumKurus: number;
}

async function readGroupFacts(): Promise<GroupFacts> {
  const groupId = fixture.group.id;
  const members = await api(ctx.server)
    .get(`/api/groups/${groupId}/members`)
    .set('Cookie', fixture.alice.cookie);
  const expenses = await api(ctx.server)
    .get(`/api/groups/${groupId}/expenses`)
    .set('Cookie', fixture.alice.cookie);
  const balances = await api(ctx.server)
    .get(`/api/groups/${groupId}/balances`)
    .set('Cookie', fixture.alice.cookie);

  expect(members.status).toBe(200);
  expect(expenses.status).toBe(200);
  expect(balances.status).toBe(200);

  return {
    memberIds: (members.body as { members: Array<{ id: string }> }).members.map(
      (member) => member.id,
    ),
    expenses: (expenses.body as { expenses: CreatedExpense[] }).expenses,
    sumKurus: (balances.body as { sumKurus: number }).sumKurus,
  };
}

let ctx: IntegrationApp;
let fixture: NonMemberFixture;

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
  fixture = await buildNonMemberFixture();
});

describe('TC-GRP-021 — every group-scoped route denies non-members with existence hiding', () => {
  it('enumerates all 12 group-scoped routes', () => {
    expect(GROUP_SCOPED_ROUTES).toHaveLength(12);
  });

  it('carol (no memberships) is denied identically on G and a missing group', async () => {
    for (const route of GROUP_SCOPED_ROUTES) {
      const real = await callRoute(fixture.carol, route, fixture.group.id);
      const missing = await callRoute(
        fixture.carol,
        route,
        NONEXISTENT_ID,
      );

      expect(real.status).toBe(404);
      expect(missing.status).toBe(404);
      expect(real.status).toBe(missing.status);
      expect(real.body.error.code).toBe('NOT_FOUND');
      expect(missing.body.error.code).toBe('NOT_FOUND');
      expect(real.body.error.code).toBe(missing.body.error.code);
      expect(real.body.error.message).toBe(missing.body.error.message);
    }
  });

  it('dave (member of another group) is denied identically on G and a missing group', async () => {
    for (const route of GROUP_SCOPED_ROUTES) {
      const real = await callRoute(fixture.dave, route, fixture.group.id);
      const missing = await callRoute(fixture.dave, route, NONEXISTENT_ID);

      expect(real.status).toBe(404);
      expect(missing.status).toBe(404);
      expect(real.status).toBe(missing.status);
      expect(real.body.error.code).toBe('NOT_FOUND');
      expect(missing.body.error.code).toBe('NOT_FOUND');
      expect(real.body.error.code).toBe(missing.body.error.code);
      expect(real.body.error.message).toBe(missing.body.error.message);
    }
  });

  it('leaves the group unchanged after every denied attempt', async () => {
    const before = await readGroupFacts();

    for (const route of GROUP_SCOPED_ROUTES) {
      for (const caller of [fixture.carol, fixture.dave]) {
        const response = await callRoute(caller, route, fixture.group.id);
        expect(response.status).toBe(404);
      }
    }

    const after = await readGroupFacts();

    // Members are still exactly {alice, bob} — no write attempt added one.
    expect([...after.memberIds].sort()).toEqual(
      [fixture.alice.id, fixture.bob.id].sort(),
    );
    // The ledger is untouched (still exactly the one seeded expense).
    expect(after.expenses).toEqual(before.expenses);
    expect(after.expenses).toHaveLength(1);
    // The derived balances sum to zero — the denied writes created nothing.
    expect(after.sumKurus).toBe(0);
  });
});
