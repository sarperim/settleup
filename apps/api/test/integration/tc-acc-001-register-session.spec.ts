/**
 * TC-ACC-001 — Register with valid input creates the account and opens a
 * session (accounts-access.md §2; FR-ACC-001, FR-ACC-010, UC-ACC-001 main,
 * BR-ACC-001, BR-ACC-008, ASM-004).
 *
 * Integration level: the real app in-process over supertest against a real
 * PostgreSQL, every table truncated before the test (strategy §2/§3).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { api, createIntegrationApp, CSRF_HEADERS, type IntegrationApp } from './support/app';
import { truncateAllTables } from './support/truncate';
import { findSetCookie, sessionCookiePair } from './support/factories';

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

describe('TC-ACC-001 — register opens an authenticated session', () => {
  it('creates the account, sets the session cookie, and authenticates /api/auth/me', async () => {
    const register = await api(ctx.server)
      .post('/api/auth/register')
      .set(CSRF_HEADERS)
      .send({
        email: 'alice@test.local',
        password: 'password-1',
        displayName: 'Alice',
      });

    // 201 { user } with displayName and a non-empty id; no verification field.
    expect(register.status).toBe(201);
    expect(Object.keys(register.body)).toEqual(['user']);
    expect(register.body.user.displayName).toBe('Alice');
    expect(typeof register.body.user.id).toBe('string');
    expect(register.body.user.id.length).toBeGreaterThan(0);

    // Set-Cookie present for settleup_session.
    expect(findSetCookie(register.headers['set-cookie'], 'settleup_session')).toBeDefined();

    const cookie = sessionCookiePair(register.headers['set-cookie']);
    const me = await api(ctx.server).get('/api/auth/me').set('Cookie', cookie);

    expect(me.status).toBe(200);
    expect(me.body.user.id).toBe(register.body.user.id);
  });
});
