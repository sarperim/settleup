/**
 * TC-ACC-007 — Login with a nonexistent email is rejected identically (no
 * account enumeration) (accounts-access.md §2; FR-ACC-004, UC-ACC-002 E1,
 * 03-api-design.md §2 "generic — no enumeration on login").
 *
 * Also carries the deterministic evidence for the accounts-001 review F-6
 * timing side channel: an unknown-email attempt must still perform an Argon2id
 * verification (against a dummy hash) so the response's timing profile does not
 * reveal account existence. The timing delta itself is non-deterministic and is
 * deliberately not asserted (strategy T6/G-6); the spy below asserts the code
 * path that closes it.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  api,
  createIntegrationApp,
  CSRF_HEADERS,
  type IntegrationApp,
} from './support/app';
import { truncateAllTables } from './support/truncate';
import { registerUser, TEST_PASSWORD } from './support/factories';
import { PasswordHasher } from '../../src/auth/password-hasher.service';

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

describe('TC-ACC-007 — no account enumeration on login', () => {
  it('responds identically to a wrong password and a nonexistent email', async () => {
    await registerUser(ctx.server, 'alice@test.local', TEST_PASSWORD, 'Alice');

    const existing = await api(ctx.server)
      .post('/api/auth/login')
      .set(CSRF_HEADERS)
      .send({ email: 'alice@test.local', password: 'wrong-password' });

    const ghost = await api(ctx.server)
      .post('/api/auth/login')
      .set(CSRF_HEADERS)
      .send({ email: 'ghost@test.local', password: 'wrong-password' });

    expect(existing.status).toBe(401);
    expect(ghost.status).toBe(401);
    expect(ghost.body).toEqual(existing.body);
    expect(ghost.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(existing.headers['set-cookie']).toBeUndefined();
    expect(ghost.headers['set-cookie']).toBeUndefined();
  });

  it('F-6: still runs Argon2id verification for a nonexistent email', async () => {
    await registerUser(ctx.server, 'alice@test.local', TEST_PASSWORD, 'Alice');
    const hasher = ctx.app.get(PasswordHasher);
    const verify = vi.spyOn(hasher, 'verify');

    const ghost = await api(ctx.server)
      .post('/api/auth/login')
      .set(CSRF_HEADERS)
      .send({ email: 'ghost@test.local', password: 'wrong-password' });

    expect(ghost.status).toBe(401);
    expect(verify).toHaveBeenCalledTimes(1);
    verify.mockRestore();
  });
});
