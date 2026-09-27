/**
 * TC-ACC-017 — Session row and expiry window (structural)
 * (accounts-access.md §2; ASM-004, arch. §8.1 server-side sessions, sliding
 * 30-day expiry).
 *
 * The 30-day wall-clock rollover itself is not automated (strategy G-6); the
 * window is asserted structurally.
 *
 * Setup note: the plan's precondition is "empty database" and its step 1 is a
 * single login expected to leave "exactly one row for alice". The registration
 * factory necessarily opens its own session, so this test revokes alice's
 * registration session first (via logout) and then performs the single login
 * the case describes — yielding exactly one session row, as the expected result
 * requires.
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

describe('TC-ACC-017 — session row and expiry window', () => {
  it('stores exactly one hashed session row with a ~30-day expiry', async () => {
    const alice = await registerUser(
      ctx.server,
      'alice@test.local',
      TEST_PASSWORD,
      'Alice',
    );
    // Revoke the registration session so the single login below is the only
    // session row (see the setup note above).
    const registrationLogout = await api(ctx.server)
      .post('/api/auth/logout')
      .set(CSRF_HEADERS)
      .set('Cookie', alice.cookie);
    expect(registrationLogout.status).toBe(204);

    const login = await api(ctx.server)
      .post('/api/auth/login')
      .set(CSRF_HEADERS)
      .send({ email: 'alice@test.local', password: TEST_PASSWORD });
    expect(login.status).toBe(200);
    const cookie = sessionCookiePair(login.headers['set-cookie']);
    const rawToken = cookie.slice('settleup_session='.length);

    const rows = await ctx.prisma.session.findMany({
      where: { userId: alice.id },
    });
    expect(rows).toHaveLength(1);
    const session = rows[0]!;

    expect(session.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(session.tokenHash).not.toBe(rawToken);

    const createdAt = session.createdAt.getTime();
    const expiresAt = session.expiresAt.getTime();
    const day = 24 * 60 * 60 * 1000;
    expect(expiresAt).toBeGreaterThanOrEqual(createdAt + 29 * day);
    expect(expiresAt).toBeLessThanOrEqual(createdAt + 31 * day);

    const me = await api(ctx.server).get('/api/auth/me').set('Cookie', cookie);
    expect(me.status).toBe(200);
    expect(me.body.user.id).toBe(alice.id);
  });
});
