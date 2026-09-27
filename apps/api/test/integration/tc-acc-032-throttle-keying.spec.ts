/**
 * TC-ACC-032 — Throttle keying: nonexistent emails and case variants share the
 * pair counter (accounts-access.md §2; arch. §8.2 keying rules).
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

function failedLogin(email: string) {
  return api(ctx.server)
    .post('/api/auth/login')
    .set(CSRF_HEADERS)
    .send({ email, password: 'wrong-password' });
}

describe('TC-ACC-032 — throttle keying', () => {
  it('keys nonexistent emails and lowercases the submitted email', async () => {
    await registerUser(ctx.server, 'alice@test.local', TEST_PASSWORD, 'Alice');

    // Scenario 1 — a nonexistent email accumulates its own counter.
    for (let attempt = 1; attempt <= 10; attempt += 1) {
      const response = await failedLogin('ghost@test.local');
      expect(response.status).toBe(401);
    }
    const ghostEleventh = await failedLogin('ghost@test.local');
    expect(ghostEleventh.status).toBe(429);
    expect(ghostEleventh.body.error.code).toBe('TOO_MANY_ATTEMPTS');

    // Scenario 2 — mixed-case and lowercase submissions share one key.
    for (let attempt = 1; attempt <= 10; attempt += 1) {
      const response = await failedLogin('ALICE@Test.Local');
      expect(response.status).toBe(401);
    }
    const lowercaseEleventh = await failedLogin('alice@test.local');
    expect(lowercaseEleventh.status).toBe(429);
    expect(lowercaseEleventh.body.error.code).toBe('TOO_MANY_ATTEMPTS');
  });
});
