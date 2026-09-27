/**
 * TC-ACC-030 — Email case normalization at login (accounts-access.md §2;
 * BR-ACC-002 context, 02-data-model.md §4, 03-api-design.md §1 — user decision
 * at Gate 2, 2026-09-25).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  api,
  createIntegrationApp,
  CSRF_HEADERS,
  type IntegrationApp,
} from './support/app';
import { truncateAllTables } from './support/truncate';
import { findSetCookie } from './support/factories';

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

describe('TC-ACC-030 — email case normalization at login', () => {
  it('stores the lowercased form and authenticates the mixed-case login input', async () => {
    const register = await api(ctx.server)
      .post('/api/auth/register')
      .set(CSRF_HEADERS)
      .send({
        email: 'Alice@Test.Local',
        password: 'password-1',
        displayName: 'Alice',
      });
    expect(register.status).toBe(201);

    const stored = await ctx.prisma.user.findUnique({
      where: { email: 'alice@test.local' },
    });
    expect(stored).not.toBeNull();
    expect(stored!.email).toBe('alice@test.local');

    const login = await api(ctx.server)
      .post('/api/auth/login')
      .set(CSRF_HEADERS)
      .send({ email: 'Alice@Test.Local', password: 'password-1' });
    expect(login.status).toBe(200);
    expect(
      findSetCookie(login.headers['set-cookie'], 'settleup_session'),
    ).toBeDefined();
  });
});
