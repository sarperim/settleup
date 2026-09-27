/**
 * TC-ACC-034 — Registration precedence: invalid fields win over duplicate
 * email (accounts-access.md §2; API §4 error-precedence note, UC-ACC-001
 * A1 + E1 combined).
 *
 * DTO validation precedes the uniqueness check, so a request whose email is
 * taken AND whose password violates the policy returns `400 VALIDATION_FAILED`
 * (naming `password`), not `409 EMAIL_TAKEN`.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { api, createIntegrationApp, CSRF_HEADERS, type IntegrationApp } from './support/app';
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
});

describe('TC-ACC-034 — validation precedes duplicate-email detection', () => {
  it('returns 400 VALIDATION_FAILED (password) for a taken email with an invalid password', async () => {
    await registerUser(ctx.server, 'alice@test.local', TEST_PASSWORD, 'Alice');

    const response = await api(ctx.server)
      .post('/api/auth/register')
      .set(CSRF_HEADERS)
      .send({
        email: 'alice@test.local',
        password: '1234567',
        displayName: 'Impostor',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
    expect(response.body.error.details.fields).toContain('password');
    expect(response.headers['set-cookie']).toBeUndefined();

    // No account created (only the original Alice row remains).
    await expect(ctx.prisma.user.count()).resolves.toBe(1);
  });
});
