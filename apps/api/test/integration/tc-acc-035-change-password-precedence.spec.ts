/**
 * TC-ACC-035 — Password-change precedence: invalid new password wins over
 * wrong current password (accounts-access.md §2; API §4 error-precedence note,
 * UC-ACC-004 E1 + policy combined).
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

describe('TC-ACC-035 — validation precedence on password change', () => {
  it('returns 400 VALIDATION_FAILED when current is wrong AND new violates policy', async () => {
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
      .send({ currentPassword: 'not-my-password', newPassword: '1234567' });

    expect(change.status).toBe(400);
    expect(change.body.error.code).toBe('VALIDATION_FAILED');

    const oldLogin = await api(ctx.server)
      .post('/api/auth/login')
      .set(CSRF_HEADERS)
      .send({ email: 'alice@test.local', password: TEST_PASSWORD });
    expect(oldLogin.status).toBe(200);
  });
});
