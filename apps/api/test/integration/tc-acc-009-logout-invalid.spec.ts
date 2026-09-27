/**
 * TC-ACC-009 — Logout without a valid session is rejected
 * (accounts-access.md §2; FR-ACC-009 guard, UC-ACC-003 error side).
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

describe('TC-ACC-009 — logout without a valid session', () => {
  it('rejects a missing cookie and a revoked cookie with 401 UNAUTHENTICATED', async () => {
    const alice = await registerUser(
      ctx.server,
      'alice@test.local',
      TEST_PASSWORD,
      'Alice',
    );
    // Precondition: alice logged in, then logged out.
    const firstLogout = await api(ctx.server)
      .post('/api/auth/logout')
      .set(CSRF_HEADERS)
      .set('Cookie', alice.cookie);
    expect(firstLogout.status).toBe(204);

    const noCookie = await api(ctx.server)
      .post('/api/auth/logout')
      .set(CSRF_HEADERS);
    expect(noCookie.status).toBe(401);
    expect(noCookie.body.error.code).toBe('UNAUTHENTICATED');

    const revoked = await api(ctx.server)
      .post('/api/auth/logout')
      .set(CSRF_HEADERS)
      .set('Cookie', alice.cookie);
    expect(revoked.status).toBe(401);
    expect(revoked.body.error.code).toBe('UNAUTHENTICATED');
  });
});
