/**
 * TC-ACC-005 — Login with matching credentials opens a session
 * (accounts-access.md §2; FR-ACC-003, UC-ACC-002 main, BR-ACC-004, ASM-004).
 *
 * Integration level: the real app in-process over supertest against a real
 * PostgreSQL, every table truncated (and the in-memory login-throttle counters
 * reset) before each test.
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
  findSetCookie,
  registerUser,
  sessionCookiePair,
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
  ctx.resetLoginThrottle();
});

describe('TC-ACC-005 — login opens an authenticated session', () => {
  it('returns 200 { user } with the session cookie and authenticates /api/auth/me', async () => {
    const alice = await registerUser(
      ctx.server,
      'alice@test.local',
      TEST_PASSWORD,
      'Alice',
    );

    const login = await api(ctx.server)
      .post('/api/auth/login')
      .set(CSRF_HEADERS)
      .send({ email: 'alice@test.local', password: TEST_PASSWORD });

    expect(login.status).toBe(200);
    expect(Object.keys(login.body)).toEqual(['user']);
    expect(login.body.user.displayName).toBe('Alice');
    expect(login.body.user.id).toBe(alice.id);

    expect(
      findSetCookie(login.headers['set-cookie'], 'settleup_session'),
    ).toBeDefined();
    const cookie = sessionCookiePair(login.headers['set-cookie']);

    const me = await api(ctx.server).get('/api/auth/me').set('Cookie', cookie);
    expect(me.status).toBe(200);
    expect(me.body.user.id).toBe(alice.id);
  });
});
