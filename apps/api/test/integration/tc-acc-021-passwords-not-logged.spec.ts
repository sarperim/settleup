/**
 * TC-ACC-021 — Passwords never appear in logs (accounts-access.md §2;
 * NFR-ACC-001, arch. §8.4).
 *
 * The integration bootstrap routes the app's pino output to a captured
 * in-memory destination (`createIntegrationApp`'s log-capture hook), so this
 * spec can scan every emitted line. The full auth lifecycle is driven with a
 * distinctive password: if any request body (or any other field carrying the
 * credential) were logged, the substring would appear.
 *
 * `logLevel: 'info'` is passed so the request-logging lines — the ones that
 * would carry request data if the middleware ever regressed — are emitted.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  api,
  createIntegrationApp,
  CSRF_HEADERS,
  type IntegrationApp,
} from './support/app';
import { truncateAllTables } from './support/truncate';
import { sessionCookiePair } from './support/factories';

const SECRET_PASSWORD = 'Sup3r-Secret-Pw-9x';

let ctx: IntegrationApp;

beforeAll(async () => {
  ctx = await createIntegrationApp({ logLevel: 'info' });
});

afterAll(async () => {
  if (ctx) {
    await ctx.app.close();
  }
});

beforeEach(async () => {
  await truncateAllTables(ctx.prisma);
  ctx.resetLoginThrottle();
  ctx.logs.clear();
});

describe('TC-ACC-021 — passwords never appear in logs', () => {
  it('emits no occurrence of the password across register, login and logout', async () => {
    const register = await api(ctx.server)
      .post('/api/auth/register')
      .set(CSRF_HEADERS)
      .send({
        email: 'logs@test.local',
        password: SECRET_PASSWORD,
        displayName: 'Logs',
      });
    expect(register.status).toBe(201);

    const login = await api(ctx.server)
      .post('/api/auth/login')
      .set(CSRF_HEADERS)
      .send({ email: 'logs@test.local', password: SECRET_PASSWORD });
    expect(login.status).toBe(200);

    const cookie = sessionCookiePair(login.headers['set-cookie']);
    const logout = await api(ctx.server)
      .post('/api/auth/logout')
      .set(CSRF_HEADERS)
      .set('Cookie', cookie);
    expect(logout.status).toBe(204);

    const captured = ctx.logs.text();

    // The capture is real — it observed the lifecycle requests (a vacuous
    // pass from an empty capture would be meaningless).
    expect(captured).toContain('/api/auth/register');
    expect(captured).toContain('/api/auth/login');
    expect(captured).toContain('/api/auth/logout');

    // The credential value appears nowhere in the output (NFR-ACC-001).
    expect(captured).not.toContain(SECRET_PASSWORD);
  });
});
