/**
 * Integration harness canary (TKT-foundation-006, acceptance criteria 1–3).
 *
 * Proves the DB-backed harness itself before any domain suite lands:
 *   - the real app boots in-process and is driven over supertest against a
 *     real PostgreSQL;
 *   - an unknown `/api` path returns the frozen 03-api-design.md §4 error
 *     envelope (03 §4; f-004's filter), on two consecutive tests;
 *   - truncate-all-tables isolation actually removes data between tests.
 *
 * The direct Prisma write below is the harness proving its own isolation —
 * there is no API write route yet (those arrive with the domain tickets). It
 * is not a domain write-path test (strategy §5's rule that write paths go
 * through the API governs domain suites).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { api, createIntegrationApp, type IntegrationApp } from './support/app';
import { truncateAllTables } from './support/truncate';

const UNKNOWN_API_PATH = '/api/__harness-canary__';
const NOT_FOUND_ENVELOPE = {
  error: { code: 'NOT_FOUND', message: 'Not found.' },
};

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

describe('integration harness canary (strategy §2/§3 T2–T3)', () => {
  it('boots the real app, reaches PostgreSQL, and returns the §4 404 envelope for an unknown /api path', async () => {
    const response = await api(ctx.server).get(UNKNOWN_API_PATH);

    expect(response.status).toBe(404);
    expect(response.body).toEqual(NOT_FOUND_ENVELOPE);

    // Harness self-test: persist a fact directly so the *next* test can prove
    // truncate-per-test removed it (strategy §7 rule 3).
    await ctx.prisma.user.create({
      data: {
        email: 'harness-canary@test.local',
        passwordHash: 'not-a-real-password-hash',
        displayName: 'Harness Canary',
      },
    });
    await expect(ctx.prisma.user.count()).resolves.toBe(1);
  });

  it('starts the consecutive test from truncated tables (no cross-test data) and repeats the §4 envelope', async () => {
    // The row written by the previous test must be gone: truncate ran in
    // beforeEach, so this test started empty.
    await expect(ctx.prisma.user.count()).resolves.toBe(0);

    const response = await api(ctx.server).get(UNKNOWN_API_PATH);

    expect(response.status).toBe(404);
    expect(response.body).toEqual(NOT_FOUND_ENVELOPE);
  });
});
