/**
 * TC-ACC-008 — Logout ends the session (accounts-access.md §2; FR-ACC-005,
 * UC-ACC-003 main, BR-ACC-006, ASM-004).
 *
 * DEVIATION (see the ticket's implementation record / R-3): step 3's literal
 * `GET /api/groups` cannot be exercised here — the C3 Groups module has not
 * landed and `/api/groups` resolves to `404 NOT_FOUND` (no route, so the
 * global guard never fires). "The revoked token grants nothing anywhere" is
 * therefore asserted against every protected route this ticket's dependency
 * set defines: `GET /api/auth/me` and `POST /api/auth/logout`. The literal
 * `/api/groups` assertion belongs to the later TC-ACC-015 sweep once C3 lands.
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

describe('TC-ACC-008 — logout ends the session', () => {
  it('returns 204 and the revoked token grants nothing anywhere', async () => {
    const alice = await registerUser(
      ctx.server,
      'alice@test.local',
      TEST_PASSWORD,
      'Alice',
    );

    const logout = await api(ctx.server)
      .post('/api/auth/logout')
      .set(CSRF_HEADERS)
      .set('Cookie', alice.cookie);

    expect(logout.status).toBe(204);
    expect(logout.body).toEqual({});
    expect(logout.text).toBe('');

    const me = await api(ctx.server)
      .get('/api/auth/me')
      .set('Cookie', alice.cookie);
    expect(me.status).toBe(401);
    expect(me.body.error.code).toBe('UNAUTHENTICATED');

    // "Nowhere": every protected route in the landed surface rejects the
    // revoked token (the grouped routes are not yet implemented — C3).
    const relogout = await api(ctx.server)
      .post('/api/auth/logout')
      .set(CSRF_HEADERS)
      .set('Cookie', alice.cookie);
    expect(relogout.status).toBe(401);
    expect(relogout.body.error.code).toBe('UNAUTHENTICATED');
  });
});
