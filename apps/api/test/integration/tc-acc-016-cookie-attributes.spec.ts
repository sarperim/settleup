/**
 * TC-ACC-016 — Session cookie attributes (accounts-access.md §2; ASM-004,
 * arch. §4 auth-cookie row, NFR-ACC-001 context).
 *
 * The harness pins `COOKIE_SECURE=true` (setup-env.ts) so the `Secure`
 * attribute is assertable.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  api,
  createIntegrationApp,
  CSRF_HEADERS,
  type IntegrationApp,
} from './support/app';
import { truncateAllTables } from './support/truncate';
import { findSetCookie, registerUser, TEST_PASSWORD } from './support/factories';

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

describe('TC-ACC-016 — session cookie attributes', () => {
  it('sets settleup_session HttpOnly, Secure and SameSite=Lax on login', async () => {
    await registerUser(ctx.server, 'alice@test.local', TEST_PASSWORD, 'Alice');

    const login = await api(ctx.server)
      .post('/api/auth/login')
      .set(CSRF_HEADERS)
      .send({ email: 'alice@test.local', password: TEST_PASSWORD });

    expect(login.status).toBe(200);
    const header = findSetCookie(login.headers['set-cookie'], 'settleup_session');
    expect(header).toBeDefined();
    expect(header).toMatch(/HttpOnly/i);
    expect(header).toMatch(/Secure/i);
    expect(header).toMatch(/SameSite=Lax/i);
  });
});
