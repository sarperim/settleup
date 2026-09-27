/**
 * TC-ACC-029 — Account persists across the full exercised lifecycle
 * (accounts-access.md §2; NFR-ACC-004 positive aspect).
 *
 * register → log in → change password → log out → log in with the new
 * password → `GET /api/auth/me`. The account's id, email and displayName must
 * be unchanged throughout (no account-editing or deletion path exists —
 * 03-api-design.md defines none).
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
import { sessionCookiePair, TEST_PASSWORD } from './support/factories';

const NEW_PASSWORD = 'password-2';
const EMAIL = 'alice@test.local';
const DISPLAY_NAME = 'Alice';

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

describe('TC-ACC-029 — the account persists across the exercised lifecycle', () => {
  it('keeps id, email and displayName unchanged through register → login → change password → logout → login → me', async () => {
    // 1. Register.
    const register = await api(ctx.server)
      .post('/api/auth/register')
      .set(CSRF_HEADERS)
      .send({ email: EMAIL, password: TEST_PASSWORD, displayName: DISPLAY_NAME });

    expect(register.status).toBe(201);
    const id = register.body.user.id as string;
    expect(id.length).toBeGreaterThan(0);
    expect(register.body.user.email).toBe(EMAIL);
    expect(register.body.user.displayName).toBe(DISPLAY_NAME);

    // 2. Log in (a second, independent session).
    const login = await api(ctx.server)
      .post('/api/auth/login')
      .set(CSRF_HEADERS)
      .send({ email: EMAIL, password: TEST_PASSWORD });

    expect(login.status).toBe(200);
    expect(login.body.user.id).toBe(id);
    expect(login.body.user.email).toBe(EMAIL);
    expect(login.body.user.displayName).toBe(DISPLAY_NAME);
    const loginCookie = sessionCookiePair(login.headers['set-cookie']);

    // 3. Change the password (acting session survives; D-ARCH-002).
    const change = await api(ctx.server)
      .post('/api/auth/password')
      .set(CSRF_HEADERS)
      .set('Cookie', loginCookie)
      .send({ currentPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD });

    expect(change.status).toBe(204);

    // 4. Log out.
    const logout = await api(ctx.server)
      .post('/api/auth/logout')
      .set(CSRF_HEADERS)
      .set('Cookie', loginCookie);

    expect(logout.status).toBe(204);

    // 5. Log in with the new password.
    const relogin = await api(ctx.server)
      .post('/api/auth/login')
      .set(CSRF_HEADERS)
      .send({ email: EMAIL, password: NEW_PASSWORD });

    expect(relogin.status).toBe(200);
    expect(relogin.body.user.id).toBe(id);
    expect(relogin.body.user.email).toBe(EMAIL);
    expect(relogin.body.user.displayName).toBe(DISPLAY_NAME);
    const reloginCookie = sessionCookiePair(relogin.headers['set-cookie']);

    // 6. The account is still the same one.
    const me = await api(ctx.server)
      .get('/api/auth/me')
      .set('Cookie', reloginCookie);

    expect(me.status).toBe(200);
    expect(me.body.user.id).toBe(id);
    expect(me.body.user.email).toBe(EMAIL);
    expect(me.body.user.displayName).toBe(DISPLAY_NAME);

    // The row persists unchanged (NFR-ACC-004: accounts live for app lifetime).
    const rows = await ctx.prisma.user.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(id);
    expect(rows[0]?.email).toBe(EMAIL);
    expect(rows[0]?.displayName).toBe(DISPLAY_NAME);
  });
});
