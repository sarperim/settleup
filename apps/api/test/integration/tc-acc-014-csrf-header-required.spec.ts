/**
 * TC-ACC-014 — CSRF header required on all state-changing auth routes
 * (accounts-access.md §2; API §1, arch. §8.2).
 *
 * Every state-changing request must carry `X-Requested-With: XMLHttpRequest`.
 * Calling any of the four auth state-changers without it is rejected with
 * `403 CSRF_HEADER_MISSING` **before** the handler runs, so no side effect
 * may occur: no account, no session, no revocation, no password change.
 *
 * Integration level: the real app in-process over supertest against a real
 * PostgreSQL, every table truncated (and the login-throttle counters reset)
 * before each test.
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

const NEW_PASSWORD = 'password-2';

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

describe('TC-ACC-014 — CSRF header required on all state-changing auth routes', () => {
  it('rejects header-less register with 403 and creates no account or session', async () => {
    const response = await api(ctx.server)
      .post('/api/auth/register')
      .send({
        email: 'alice@test.local',
        password: TEST_PASSWORD,
        displayName: 'Alice',
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('CSRF_HEADER_MISSING');
    expect(response.headers['set-cookie']).toBeUndefined();

    // No side effect: neither an account nor a session was created, so the
    // would-be credentials cannot authenticate.
    await expect(ctx.prisma.user.count()).resolves.toBe(0);
    await expect(ctx.prisma.session.count()).resolves.toBe(0);

    const login = await api(ctx.server)
      .post('/api/auth/login')
      .set(CSRF_HEADERS)
      .send({ email: 'alice@test.local', password: TEST_PASSWORD });
    expect(login.status).toBe(401);
    expect(login.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects header-less login with 403 and opens no new session', async () => {
    const alice = await registerUser(
      ctx.server,
      'alice@test.local',
      TEST_PASSWORD,
      'Alice',
    );
    const sessionsBefore = await ctx.prisma.session.count();

    const response = await api(ctx.server)
      .post('/api/auth/login')
      .send({ email: 'alice@test.local', password: TEST_PASSWORD });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('CSRF_HEADER_MISSING');
    expect(response.headers['set-cookie']).toBeUndefined();

    // No side effect: no second session row; the registration session stands.
    await expect(ctx.prisma.session.count()).resolves.toBe(sessionsBefore);
    const me = await api(ctx.server)
      .get('/api/auth/me')
      .set('Cookie', alice.cookie);
    expect(me.status).toBe(200);
  });

  it('rejects header-less logout with 403 and leaves the session alive', async () => {
    const alice = await registerUser(
      ctx.server,
      'alice@test.local',
      TEST_PASSWORD,
      'Alice',
    );

    const response = await api(ctx.server)
      .post('/api/auth/logout')
      .set('Cookie', alice.cookie);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('CSRF_HEADER_MISSING');

    // No side effect: the session was not revoked.
    const me = await api(ctx.server)
      .get('/api/auth/me')
      .set('Cookie', alice.cookie);
    expect(me.status).toBe(200);
  });

  it('rejects header-less password change with 403 and leaves the password unchanged', async () => {
    const alice = await registerUser(
      ctx.server,
      'alice@test.local',
      TEST_PASSWORD,
      'Alice',
    );

    const response = await api(ctx.server)
      .post('/api/auth/password')
      .set('Cookie', alice.cookie)
      .send({ currentPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('CSRF_HEADER_MISSING');

    // No side effect: the old password still authenticates and the would-be
    // new password does not.
    const oldLogin = await api(ctx.server)
      .post('/api/auth/login')
      .set(CSRF_HEADERS)
      .send({ email: 'alice@test.local', password: TEST_PASSWORD });
    expect(oldLogin.status).toBe(200);

    const newLogin = await api(ctx.server)
      .post('/api/auth/login')
      .set(CSRF_HEADERS)
      .send({ email: 'alice@test.local', password: NEW_PASSWORD });
    expect(newLogin.status).toBe(401);
    expect(newLogin.body.error.code).toBe('INVALID_CREDENTIALS');
  });
});
