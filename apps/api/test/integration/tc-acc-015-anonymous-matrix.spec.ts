/**
 * TC-ACC-015 — Anonymous access to every protected endpoint is rejected
 * (accounts-access.md §2; FR-ACC-009, UC-ACC-006 API aspect, arch. §8.1
 * layer 1, 03-api-design.md §1).
 *
 * The exhaustive anonymous matrix: the complete API surface **minus** the two
 * public routes (`POST /api/auth/register`, `POST /api/auth/login`) is called
 * with no session cookie — all **21** protected endpoints must answer
 * `401 UNAUTHENTICATED` in the §4 error envelope. Dummy ids are permitted
 * throughout: the global `AuthGuard` rejects the caller before any handler,
 * guard or DTO validation resolves the addressed resource.
 *
 * CSRF note: the platform's CSRF middleware runs before Nest routing, so a
 * state-changing call without `X-Requested-With` is rejected with
 * `403 CSRF_HEADER_MISSING` before the `AuthGuard` is reached. This matrix
 * carries the header on POST/PATCH/DELETE so the layer under test is the auth
 * guard (the missing-header case is TC-ACC-014, deliberately not duplicated
 * here).
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
import { TEST_PASSWORD } from './support/factories';

/** A syntactically valid but nonexistent cuid (25 chars, `c`-prefixed). */
const DUMMY_ID = 'clx0000000000000000000000';

type HttpMethod = 'get' | 'post' | 'patch' | 'delete';

interface ProtectedEndpoint {
  readonly label: string;
  readonly method: HttpMethod;
  readonly path: string;
  /** A syntactically valid body for state-changing routes. */
  readonly body?: Record<string, unknown>;
}

const STATE_CHANGING: ReadonlySet<HttpMethod> = new Set([
  'post',
  'patch',
  'delete',
]);

/** A syntactically valid expense body for the create route. */
const EXPENSE_BODY: Record<string, unknown> = {
  description: 'Dummy expense',
  amountKurus: 1000,
  payerId: DUMMY_ID,
  participantIds: [DUMMY_ID],
  splitType: 'EQUAL',
};

/**
 * The complete protected surface — 03-api-design.md §2/§3/§3b/§3c minus the
 * two `@Public()` routes (register, login). Exactly 21 entries; asserted below.
 */
const PROTECTED_ENDPOINTS: readonly ProtectedEndpoint[] = [
  { label: 'POST /api/auth/logout', method: 'post', path: '/api/auth/logout' },
  { label: 'GET /api/auth/me', method: 'get', path: '/api/auth/me' },
  {
    label: 'POST /api/auth/password',
    method: 'post',
    path: '/api/auth/password',
    body: { currentPassword: TEST_PASSWORD, newPassword: 'password-2' },
  },
  {
    label: 'POST /api/groups',
    method: 'post',
    path: '/api/groups',
    body: { name: 'Trip' },
  },
  { label: 'GET /api/groups', method: 'get', path: '/api/groups' },
  {
    label: 'GET /api/groups/:groupId',
    method: 'get',
    path: `/api/groups/${DUMMY_ID}`,
  },
  {
    label: 'GET /api/groups/:groupId/members',
    method: 'get',
    path: `/api/groups/${DUMMY_ID}/members`,
  },
  {
    label: 'GET /api/groups/:groupId/join-requests',
    method: 'get',
    path: `/api/groups/${DUMMY_ID}/join-requests`,
  },
  {
    label: 'POST /api/join-requests',
    method: 'post',
    path: '/api/join-requests',
    body: { code: 'AAAAAAAA' },
  },
  {
    label: 'POST /api/join-requests/:requestId/approve',
    method: 'post',
    path: `/api/join-requests/${DUMMY_ID}/approve`,
  },
  {
    label: 'POST /api/join-requests/:requestId/reject',
    method: 'post',
    path: `/api/join-requests/${DUMMY_ID}/reject`,
  },
  {
    label: 'GET /api/join-info',
    method: 'get',
    path: '/api/join-info?code=AAAAAAAA',
  },
  {
    label: 'POST /api/groups/:groupId/expenses',
    method: 'post',
    path: `/api/groups/${DUMMY_ID}/expenses`,
    body: EXPENSE_BODY,
  },
  {
    label: 'GET /api/groups/:groupId/expenses',
    method: 'get',
    path: `/api/groups/${DUMMY_ID}/expenses`,
  },
  {
    label: 'GET /api/groups/:groupId/expenses/:expenseId',
    method: 'get',
    path: `/api/groups/${DUMMY_ID}/expenses/${DUMMY_ID}`,
  },
  {
    label: 'PATCH /api/groups/:groupId/expenses/:expenseId',
    method: 'patch',
    path: `/api/groups/${DUMMY_ID}/expenses/${DUMMY_ID}`,
    body: { description: 'Edited' },
  },
  {
    label: 'DELETE /api/groups/:groupId/expenses/:expenseId',
    method: 'delete',
    path: `/api/groups/${DUMMY_ID}/expenses/${DUMMY_ID}`,
  },
  {
    label: 'GET /api/groups/:groupId/balances',
    method: 'get',
    path: `/api/groups/${DUMMY_ID}/balances`,
  },
  {
    label: 'GET /api/groups/:groupId/settlements',
    method: 'get',
    path: `/api/groups/${DUMMY_ID}/settlements`,
  },
  {
    label: 'POST /api/groups/:groupId/settlements',
    method: 'post',
    path: `/api/groups/${DUMMY_ID}/settlements`,
    body: { payerId: DUMMY_ID, recipientId: DUMMY_ID, amountKurus: 1000 },
  },
  {
    label: 'POST /api/groups/:groupId/settlements/:settlementId/undo',
    method: 'post',
    path: `/api/groups/${DUMMY_ID}/settlements/${DUMMY_ID}/undo`,
  },
];

/** The only keys §4 permits anywhere in an error body. */
const ENVELOPE_KEYS = ['code', 'details', 'message'];

/**
 * Assert the whole error body is exactly the §4 envelope carrying `code`.
 * A missing/extra key, a non-string code/message, or an embedded stack trace
 * fails the test.
 */
function expectErrorEnvelope(response: Response, code: string): void {
  expect(Object.keys(response.body)).toEqual(['error']);

  const errorKeys = Object.keys(response.body.error);
  for (const key of errorKeys) {
    expect(ENVELOPE_KEYS).toContain(key);
  }
  expect(errorKeys).toContain('code');
  expect(errorKeys).toContain('message');

  expect(response.body.error.code).toBe(code);
  expect(typeof response.body.error.message).toBe('string');
  expect(response.body.error.message.length).toBeGreaterThan(0);

  expect(response.text).not.toMatch(/stack/i);
  expect(response.text).not.toContain(' at ');
}

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

/** Fire one anonymous call (CSRF header on state-changing methods). */
function anonymousCall(endpoint: ProtectedEndpoint): Promise<Response> {
  const agent = api(ctx.server);
  const request =
    endpoint.method === 'get'
      ? agent.get(endpoint.path)
      : endpoint.method === 'post'
        ? agent.post(endpoint.path)
        : endpoint.method === 'patch'
          ? agent.patch(endpoint.path)
          : agent.delete(endpoint.path);

  const withCsrf = STATE_CHANGING.has(endpoint.method)
    ? request.set(CSRF_HEADERS)
    : request;

  return endpoint.body === undefined ? withCsrf : withCsrf.send(endpoint.body);
}

describe('TC-ACC-015 — anonymous access to every protected endpoint is rejected', () => {
  it('enumerates the complete API surface minus register/login (21 endpoints)', () => {
    expect(PROTECTED_ENDPOINTS).toHaveLength(21);
  });

  it.each(PROTECTED_ENDPOINTS)(
    '$label → 401 UNAUTHENTICATED in the §4 envelope',
    async (endpoint) => {
      const response = await anonymousCall(endpoint);

      expect(response.status).toBe(401);
      expectErrorEnvelope(response, 'UNAUTHENTICATED');
      expect(response.body.error.details).toBeUndefined();
    },
  );

  it('creates nothing when every protected endpoint is probed anonymously', async () => {
    for (const endpoint of PROTECTED_ENDPOINTS) {
      const response = await anonymousCall(endpoint);
      expect(response.status).toBe(401);
    }

    await expect(ctx.prisma.user.count()).resolves.toBe(0);
    await expect(ctx.prisma.session.count()).resolves.toBe(0);
    await expect(ctx.prisma.group.count()).resolves.toBe(0);
    await expect(ctx.prisma.joinRequest.count()).resolves.toBe(0);
    await expect(ctx.prisma.membership.count()).resolves.toBe(0);
    await expect(ctx.prisma.expense.count()).resolves.toBe(0);
  });
});
