/**
 * TC-ACC-022 — Error responses follow the single error contract
 * (accounts-access.md §2; API §4, arch. §8.3).
 *
 * Every auth error trigger produces exactly
 * `{ "error": { "code": <string>, "message": <string>, "details"?: <object> } }`
 * — no other top-level keys, no `details` beyond the documented machine-readable
 * one, no stack traces, no internal identifiers.
 *
 * Integration level: the real app in-process over supertest against a real
 * PostgreSQL, every table truncated (and the login-throttle counters reset)
 * before each test.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Response } from 'supertest';
import {
  api,
  createIntegrationApp,
  CSRF_HEADERS,
  type IntegrationApp,
} from './support/app';
import { truncateAllTables } from './support/truncate';
import { registerUser, TEST_PASSWORD } from './support/factories';

/** The only keys §4 permits anywhere in an error body. */
const ENVELOPE_KEYS = ['code', 'details', 'message'];

/**
 * Assert the whole error body is exactly the §4 envelope carrying `code`.
 * A missing/extra key, a non-string code/message, or an embedded stack trace
 * fails the test.
 */
function expectErrorEnvelope(response: Response, code: string): void {
  // Exactly one top-level key: `error`.
  expect(Object.keys(response.body)).toEqual(['error']);

  // `error` carries only the §4 keys, and always `code` + `message`.
  const errorKeys = Object.keys(response.body.error);
  for (const key of errorKeys) {
    expect(ENVELOPE_KEYS).toContain(key);
  }
  expect(errorKeys).toContain('code');
  expect(errorKeys).toContain('message');

  expect(response.body.error.code).toBe(code);
  expect(typeof response.body.error.message).toBe('string');
  expect(response.body.error.message.length).toBeGreaterThan(0);

  // No stack traces or internals leak into the serialized body.
  expect(response.text).not.toMatch(/stack/i);
  expect(response.text).not.toContain(' at ');
}

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

describe('TC-ACC-022 — every auth error trigger uses the §4 envelope', () => {
  it('duplicate registration → 409 EMAIL_TAKEN', async () => {
    await registerUser(ctx.server, 'alice@test.local', TEST_PASSWORD, 'Alice');

    const response = await api(ctx.server)
      .post('/api/auth/register')
      .set(CSRF_HEADERS)
      .send({
        email: 'alice@test.local',
        password: 'password-9',
        displayName: 'Impostor',
      });

    expect(response.status).toBe(409);
    expectErrorEnvelope(response, 'EMAIL_TAKEN');
    expect(response.body.error.details).toEqual({ field: 'email' });
  });

  it('invalid registration field → 400 VALIDATION_FAILED', async () => {
    const response = await api(ctx.server)
      .post('/api/auth/register')
      .set(CSRF_HEADERS)
      .send({
        email: 'alice@test.local',
        password: '1234567',
        displayName: 'Alice',
      });

    expect(response.status).toBe(400);
    expectErrorEnvelope(response, 'VALIDATION_FAILED');
    expect(response.body.error.details).toBeDefined();
  });

  it('wrong login password → 401 INVALID_CREDENTIALS', async () => {
    await registerUser(ctx.server, 'alice@test.local', TEST_PASSWORD, 'Alice');

    const response = await api(ctx.server)
      .post('/api/auth/login')
      .set(CSRF_HEADERS)
      .send({ email: 'alice@test.local', password: 'wrong-password' });

    expect(response.status).toBe(401);
    expectErrorEnvelope(response, 'INVALID_CREDENTIALS');
    expect(response.body.error.details).toBeUndefined();
  });

  it('anonymous GET /api/auth/me → 401 UNAUTHENTICATED', async () => {
    const response = await api(ctx.server).get('/api/auth/me');

    expect(response.status).toBe(401);
    expectErrorEnvelope(response, 'UNAUTHENTICATED');
    expect(response.body.error.details).toBeUndefined();
  });

  it('wrong current password → 400 INVALID_CURRENT_PASSWORD', async () => {
    const alice = await registerUser(
      ctx.server,
      'alice@test.local',
      TEST_PASSWORD,
      'Alice',
    );

    const response = await api(ctx.server)
      .post('/api/auth/password')
      .set(CSRF_HEADERS)
      .set('Cookie', alice.cookie)
      .send({ currentPassword: 'not-my-password', newPassword: 'password-2' });

    expect(response.status).toBe(400);
    expectErrorEnvelope(response, 'INVALID_CURRENT_PASSWORD');
    expect(response.body.error.details).toBeUndefined();
  });

  it('state-changing call without the CSRF header → 403 CSRF_HEADER_MISSING', async () => {
    await registerUser(ctx.server, 'alice@test.local', TEST_PASSWORD, 'Alice');

    const response = await api(ctx.server)
      .post('/api/auth/login')
      .send({ email: 'alice@test.local', password: TEST_PASSWORD });

    expect(response.status).toBe(403);
    expectErrorEnvelope(response, 'CSRF_HEADER_MISSING');
    expect(response.body.error.details).toBeUndefined();
  });
});
