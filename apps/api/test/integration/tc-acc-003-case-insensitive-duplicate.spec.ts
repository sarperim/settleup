/**
 * TC-ACC-003 — Duplicate-email detection is case-insensitive
 * (accounts-access.md §2; FR-ACC-002, BR-ACC-002, data-model §4).
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

describe('TC-ACC-003 — duplicate detection is case-insensitive', () => {
  it('rejects a case-variant of an already registered email with 409 EMAIL_TAKEN', async () => {
    await registerUser(ctx.server, 'alice@test.local', TEST_PASSWORD, 'Alice');

    const response = await api(ctx.server)
      .post('/api/auth/register')
      .set(CSRF_HEADERS)
      .send({
        email: 'ALICE@Test.Local',
        password: 'password-2',
        displayName: 'Impostor',
      });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('EMAIL_TAKEN');
    expect(response.headers['set-cookie']).toBeUndefined();
  });
});
