/**
 * TC-ACC-013 — New-password policy enforced at change (boundary values)
 * (accounts-access.md §2; D-ARCH-003, FR-ACC-006, API §2 policy).
 *
 * Parameterized over the policy boundary rows (7 / 8 / 128 / 129 characters);
 * each row runs in its own truncated database.
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

interface PolicyRow {
  readonly label: string;
  readonly newPassword: string;
  readonly expectedStatus: number;
}

const ROWS: readonly PolicyRow[] = [
  { label: '7 chars', newPassword: 'a'.repeat(7), expectedStatus: 400 },
  { label: '8 chars', newPassword: 'a'.repeat(8), expectedStatus: 204 },
  { label: '128 chars', newPassword: 'a'.repeat(128), expectedStatus: 204 },
  { label: '129 chars', newPassword: 'a'.repeat(129), expectedStatus: 400 },
];

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

describe('TC-ACC-013 — new-password policy boundaries at change', () => {
  it.each(ROWS)('$label → $expectedStatus', async (row) => {
    const alice = await registerUser(
      ctx.server,
      'alice@test.local',
      TEST_PASSWORD,
      'Alice',
    );

    const change = await api(ctx.server)
      .post('/api/auth/password')
      .set(CSRF_HEADERS)
      .set('Cookie', alice.cookie)
      .send({ currentPassword: TEST_PASSWORD, newPassword: row.newPassword });

    expect(change.status).toBe(row.expectedStatus);
    if (row.expectedStatus === 400) {
      expect(change.body.error.code).toBe('VALIDATION_FAILED');
    }
  });
});
