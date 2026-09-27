/**
 * TC-ACC-031 — Login throttle blocks the (email, IP) pair after ten failed
 * attempts (accounts-access.md §2; NFR-ACC-001 throttle translation, arch.
 * §8.2, 03-api-design.md §4, UC-ACC-002 E1 context).
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

function login(body: Record<string, unknown>) {
  return api(ctx.server).post('/api/auth/login').set(CSRF_HEADERS).send(body);
}

describe('TC-ACC-031 — login throttle blocks after ten counted failures', () => {
  it('returns 429 for the 11th+ attempt (correct password included) before verification', async () => {
    await registerUser(ctx.server, 'alice@test.local', TEST_PASSWORD, 'Alice');

    // Step 1: ten wrong-password attempts are processed normally.
    for (let attempt = 1; attempt <= 10; attempt += 1) {
      const response = await login({
        email: 'alice@test.local',
        password: 'wrong-password',
      });
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    }

    // Step 2: the 11th attempt — correct credentials — is blocked.
    const eleventh = await login({
      email: 'alice@test.local',
      password: TEST_PASSWORD,
    });
    expect(eleventh.status).toBe(429);
    expect(eleventh.body.error.code).toBe('TOO_MANY_ATTEMPTS');
    expect(Object.keys(eleventh.body.error).sort()).toEqual(['code', 'message']);
    expect(eleventh.body.error.details).toBeUndefined();
    expect(eleventh.headers['retry-after']).toBeUndefined();
    expect(eleventh.headers['set-cookie']).toBeUndefined();

    // Step 3: a further wrong-password attempt is blocked too.
    const twelfth = await login({
      email: 'alice@test.local',
      password: 'wrong-password',
    });
    expect(twelfth.status).toBe(429);
    expect(twelfth.body.error.code).toBe('TOO_MANY_ATTEMPTS');

    // Step 4: DTO validation precedes the throttle — a malformed body is 400.
    const malformed = await login({ email: 'alice@test.local' });
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe('VALIDATION_FAILED');

    // Step 5: register is not throttled.
    const register = await api(ctx.server)
      .post('/api/auth/register')
      .set(CSRF_HEADERS)
      .send({
        email: 'fresh@test.local',
        password: TEST_PASSWORD,
        displayName: 'Fresh',
      });
    expect(register.status).toBe(201);
  });
});
