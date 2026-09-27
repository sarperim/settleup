/**
 * TC-ACC-033 — A successful login resets the pair's throttle counter
 * (accounts-access.md §2; arch. §8.2).
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

function login(password: string) {
  return api(ctx.server)
    .post('/api/auth/login')
    .set(CSRF_HEADERS)
    .send({ email: 'bob@test.local', password });
}

describe('TC-ACC-033 — successful login resets the counter', () => {
  it('clears the pair counter on success so the threshold restarts', async () => {
    await registerUser(ctx.server, 'bob@test.local', TEST_PASSWORD, 'Bob');

    // Step 1: five failures.
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await login('wrong-password');
      expect(response.status).toBe(401);
    }

    // Step 2: one success clears the counter.
    const success = await login(TEST_PASSWORD);
    expect(success.status).toBe(200);

    // Step 3: ten fresh failures are all processed normally.
    for (let attempt = 1; attempt <= 10; attempt += 1) {
      const response = await login('wrong-password');
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    }

    // Step 4: the eleventh failure of the fresh window is throttled.
    const eleventh = await login('wrong-password');
    expect(eleventh.status).toBe(429);
    expect(eleventh.body.error.code).toBe('TOO_MANY_ATTEMPTS');
  });
});
