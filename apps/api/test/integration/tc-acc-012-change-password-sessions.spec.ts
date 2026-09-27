/**
 * TC-ACC-012 — Password change invalidates all other sessions, keeps the
 * current one (accounts-access.md §2; D-ARCH-002, FR-ACC-006, UC-ACC-004
 * postcondition).
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

describe('TC-ACC-012 — password change keeps the acting session, revokes others', () => {
  it('survives on cookie A and revokes cookie B', async () => {
    await registerUser(ctx.server, 'alice@test.local', TEST_PASSWORD, 'Alice');

    const loginA = await api(ctx.server)
      .post('/api/auth/login')
      .set(CSRF_HEADERS)
      .send({ email: 'alice@test.local', password: TEST_PASSWORD });
    expect(loginA.status).toBe(200);
    const cookieA = sessionCookiePair(loginA.headers['set-cookie']);

    const loginB = await api(ctx.server)
      .post('/api/auth/login')
      .set(CSRF_HEADERS)
      .send({ email: 'alice@test.local', password: TEST_PASSWORD });
    expect(loginB.status).toBe(200);
    const cookieB = sessionCookiePair(loginB.headers['set-cookie']);

    const change = await api(ctx.server)
      .post('/api/auth/password')
      .set(CSRF_HEADERS)
      .set('Cookie', cookieA)
      .send({ currentPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD });
    expect(change.status).toBe(204);

    const meA = await api(ctx.server)
      .get('/api/auth/me')
      .set('Cookie', cookieA);
    expect(meA.status).toBe(200);

    const meB = await api(ctx.server)
      .get('/api/auth/me')
      .set('Cookie', cookieB);
    expect(meB.status).toBe(401);
    expect(meB.body.error.code).toBe('UNAUTHENTICATED');
  });
});
