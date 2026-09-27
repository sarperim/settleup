/**
 * TC-ACC-002 — Registration with an email that already belongs to an account
 * is rejected (accounts-access.md §2; FR-ACC-002, UC-ACC-001 A1, BR-ACC-002).
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

describe('TC-ACC-002 — duplicate email is rejected', () => {
  it('returns 409 EMAIL_TAKEN with details.field = email and no session', async () => {
    await registerUser(ctx.server, 'alice@test.local', TEST_PASSWORD, 'Alice');

    const duplicate = await api(ctx.server)
      .post('/api/auth/register')
      .set(CSRF_HEADERS)
      .send({
        email: 'alice@test.local',
        password: 'password-9',
        displayName: 'Impostor',
      });

    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('EMAIL_TAKEN');
    expect(duplicate.body.error.details).toEqual({ field: 'email' });
    expect(duplicate.headers['set-cookie']).toBeUndefined();

    // No second account was created: the impostor password does not authenticate.
    const login = await api(ctx.server)
      .post('/api/auth/login')
      .set(CSRF_HEADERS)
      .send({ email: 'alice@test.local', password: 'password-9' });

    expect(login.status).toBe(401);
    expect(login.body.error.code).toBe('INVALID_CREDENTIALS');
  });
});
