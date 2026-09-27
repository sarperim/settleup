/**
 * TC-ACC-011 — Change password with a wrong current password is rejected,
 * password unchanged (accounts-access.md §2; FR-ACC-007, UC-ACC-004 E1,
 * ASM-003).
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

describe('TC-ACC-011 — wrong current password rejected, password unchanged', () => {
  it('returns 400 INVALID_CURRENT_PASSWORD and leaves the old password live', async () => {
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
      .send({ currentPassword: 'not-my-password', newPassword: NEW_PASSWORD });

    expect(change.status).toBe(400);
    expect(change.body.error.code).toBe('INVALID_CURRENT_PASSWORD');

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
