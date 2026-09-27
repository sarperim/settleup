/**
 * TC-ACC-010 — Change password with the correct current password
 * (accounts-access.md §2; FR-ACC-006, UC-ACC-004 main, ASM-003, BR-ACC-005).
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
  TEST_PASSWORD,
} from './support/factories';

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

describe('TC-ACC-010 — change password with the correct current password', () => {
  it('rotates the credential: old password dies, new password authenticates', async () => {
    const alice = await registerUser(
      ctx.server,
      'alice@test.local',
      TEST_PASSWORD,
      'Alice',
    );

    const change = await api(ctx.server)
      .post('/api/auth/password')
      .set(CSRF_HEADERS)
      .set('Cookie', alice.cookie)
      .send({ currentPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD });

    expect(change.status).toBe(204);
    expect(change.text).toBe('');

    const oldLogin = await api(ctx.server)
      .post('/api/auth/login')
      .set(CSRF_HEADERS)
      .send({ email: 'alice@test.local', password: TEST_PASSWORD });
    expect(oldLogin.status).toBe(401);
    expect(oldLogin.body.error.code).toBe('INVALID_CREDENTIALS');

    const newLogin = await api(ctx.server)
      .post('/api/auth/login')
      .set(CSRF_HEADERS)
      .send({ email: 'alice@test.local', password: NEW_PASSWORD });
    expect(newLogin.status).toBe(200);
    expect(newLogin.body.user.id).toBe(alice.id);
    expect(
      findSetCookie(newLogin.headers['set-cookie'], 'settleup_session'),
    ).toBeDefined();
  });
});
