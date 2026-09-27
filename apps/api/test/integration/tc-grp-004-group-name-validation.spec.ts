/**
 * TC-GRP-004 — Group name validation (boundary values)
 * (groups-membership.md §2; UC-GRP-001 E1, 03-api-design.md §1 field limits
 * group name 1–100, §4 validation precedence, OQ-GRP-003 resolution).
 *
 * Each row runs in its own truncated database (strategy §7 rule 3). An invalid
 * row creates **no** group; a valid row creates exactly one.
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

interface Row {
  readonly label: string;
  readonly body: Record<string, unknown>;
  readonly status: 201 | 400;
}

const rows: readonly Row[] = [
  { label: 'a empty', body: { name: '' }, status: 400 },
  { label: 'b 1 char', body: { name: 'A' }, status: 201 },
  { label: 'c 100 chars', body: { name: 'x'.repeat(100) }, status: 201 },
  { label: 'd 101 chars', body: { name: 'x'.repeat(101) }, status: 400 },
  { label: 'e missing', body: {}, status: 400 },
];

describe('TC-GRP-004 — group name validation at the boundaries', () => {
  it.each(rows)('row $label', async (row) => {
    const alice = await registerUser(
      ctx.server,
      'alice@test.local',
      TEST_PASSWORD,
      'Alice',
    );

    const create = await api(ctx.server)
      .post('/api/groups')
      .set(CSRF_HEADERS)
      .set('Cookie', alice.cookie)
      .send(row.body);

    expect(create.status).toBe(row.status);

    if (row.status === 400) {
      expect(create.body.error.code).toBe('VALIDATION_FAILED');
      expect(create.body.error.details.fields).toContain('name');
    }

    // Follow-up overview proves the no-group / exactly-one-group outcome.
    const overview = await api(ctx.server)
      .get('/api/groups')
      .set('Cookie', alice.cookie);

    expect(overview.status).toBe(200);
    expect(overview.body.groups).toHaveLength(row.status === 201 ? 1 : 0);
  });
});
