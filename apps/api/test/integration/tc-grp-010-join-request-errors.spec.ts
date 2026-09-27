/**
 * TC-GRP-010 — Join request with an unknown code or a missing code field
 * (groups-membership.md §2; FR-GRP-004, UC-GRP-002 E1, 03-api-design.md §4
 * error precedence: DTO validation before service-level checks).
 *
 * The code IS the group selector, so code resolution precedes every
 * requester-relation check: an unknown code yields 404 for every requester
 * class. A missing `code` field fails DTO validation first → 400.
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
});

describe('TC-GRP-010 — unknown code and missing code field', () => {
  it('returns 404 CODE_NOT_FOUND for an unknown code, creating no request', async () => {
    const bob = await registerUser(
      ctx.server,
      'bob@test.local',
      TEST_PASSWORD,
      'Bob',
    );

    // 1. POST /api/join-requests as bob with { code: "ZZZZ9999" }.
    const unknown = await api(ctx.server)
      .post('/api/join-requests')
      .set(CSRF_HEADERS)
      .set('Cookie', bob.cookie)
      .send({ code: 'ZZZZ9999' });

    expect(unknown.status).toBe(404);
    expect(Object.keys(unknown.body)).toEqual(['error']);
    expect(unknown.body.error.code).toBe('CODE_NOT_FOUND');
    expect(await ctx.prisma.joinRequest.count()).toBe(0);
  });

  it('returns 400 VALIDATION_FAILED naming code when the field is missing, creating no request', async () => {
    const bob = await registerUser(
      ctx.server,
      'bob@test.local',
      TEST_PASSWORD,
      'Bob',
    );

    // 2. POST /api/join-requests as bob with {} (missing code field).
    const missing = await api(ctx.server)
      .post('/api/join-requests')
      .set(CSRF_HEADERS)
      .set('Cookie', bob.cookie)
      .send({});

    expect(missing.status).toBe(400);
    expect(Object.keys(missing.body)).toEqual(['error']);
    expect(missing.body.error.code).toBe('VALIDATION_FAILED');
    expect(missing.body.error.details.fields).toContain('code');
    expect(await ctx.prisma.joinRequest.count()).toBe(0);
  });
});
