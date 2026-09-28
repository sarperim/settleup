/**
 * TC-EXP-012 — Expense field validation (boundary values)
 * (expense-tracking.md §2; FR-EXP-002/E3, UC-EXP-001 E3, BR-EXP-008 no date
 * field, API §1 field limits, data-model §8 amount bound).
 *
 * Integration level, parameterized: each row runs from a clean precondition
 * state (a fresh standing group). Invalid rows are rejected with
 * `400 VALIDATION_FAILED` naming the offending field and create no expense;
 * valid rows create exactly one.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  api,
  createIntegrationApp,
  CSRF_HEADERS,
  type IntegrationApp,
} from './support/app';
import { truncateAllTables } from './support/truncate';
import { createStandingGroup } from './support/standing-group';

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

interface Ids {
  readonly alice: string;
  readonly bob: string;
  readonly carol: string;
}

interface ValidRow {
  readonly kind: 'valid';
  readonly label: string;
  readonly build: (ids: Ids) => Record<string, unknown>;
}

interface InvalidRow {
  readonly kind: 'invalid';
  readonly label: string;
  readonly field: string;
  readonly build: (ids: Ids) => Record<string, unknown>;
}

type Row = ValidRow | InvalidRow;

const base = (ids: Ids): Record<string, unknown> => ({
  description: 'Row',
  amountKurus: 1000,
  payerId: ids.alice,
  participantIds: [ids.alice, ids.bob, ids.carol],
  splitType: 'EQUAL',
});

/** Copy `body` without `key` — a missing-field payload row. */
function without(
  body: Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  const copy = { ...body };
  delete copy[key];
  return copy;
}

const rows: readonly Row[] = [
  // a: amount -1
  { kind: 'invalid', label: 'a', field: 'amountKurus', build: (ids) => ({ ...base(ids), amountKurus: -1 }) },
  // b: amount 0 (BR-EXP-010 / OQ-EXP-002 — zero valid)
  { kind: 'valid', label: 'b', build: (ids) => ({ ...base(ids), amountKurus: 0 }) },
  // c: amount 2^31−1
  { kind: 'valid', label: 'c', build: (ids) => ({ ...base(ids), amountKurus: 2147483647 }) },
  // d: amount 2^31
  { kind: 'invalid', label: 'd', field: 'amountKurus', build: (ids) => ({ ...base(ids), amountKurus: 2147483648 }) },
  // e: amount missing
  { kind: 'invalid', label: 'e', field: 'amountKurus', build: (ids) => without(base(ids), 'amountKurus') },
  // f: amount non-integer
  { kind: 'invalid', label: 'f', field: 'amountKurus', build: (ids) => ({ ...base(ids), amountKurus: 100.5 }) },
  // g: description ""
  { kind: 'invalid', label: 'g', field: 'description', build: (ids) => ({ ...base(ids), description: '' }) },
  // h: description 1 char
  { kind: 'valid', label: 'h', build: (ids) => ({ ...base(ids), description: 'A' }) },
  // i: description 200 chars
  { kind: 'valid', label: 'i', build: (ids) => ({ ...base(ids), description: 'A'.repeat(200) }) },
  // j: description 201 chars
  { kind: 'invalid', label: 'j', field: 'description', build: (ids) => ({ ...base(ids), description: 'A'.repeat(201) }) },
  // k: description missing
  { kind: 'invalid', label: 'k', field: 'description', build: (ids) => without(base(ids), 'description') },
  // l: splitType other
  { kind: 'invalid', label: 'l', field: 'splitType', build: (ids) => ({ ...base(ids), splitType: 'WEIGHTED' }) },
  // m: splitType missing
  { kind: 'invalid', label: 'm', field: 'splitType', build: (ids) => without(base(ids), 'splitType') },
  // n: payerId missing
  { kind: 'invalid', label: 'n', field: 'payerId', build: (ids) => without(base(ids), 'payerId') },
];

describe('TC-EXP-012 — expense field validation (parameterized)', () => {
  it.each(rows)('row $label ($kind)', async (row) => {
    const { alice, bob, carol, group } = await createStandingGroup(ctx.server);
    const ids: Ids = { alice: alice.id, bob: bob.id, carol: carol.id };

    const response = await api(ctx.server)
      .post(`/api/groups/${group.id}/expenses`)
      .set(CSRF_HEADERS)
      .set('Cookie', alice.cookie)
      .send(row.build(ids));

    if (row.kind === 'valid') {
      expect(response.status).toBe(201);
      expect(await ctx.prisma.expense.count()).toBe(1);
      return;
    }

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
    expect(response.body.error.details.fields).toContain(row.field);
    expect(await ctx.prisma.expense.count()).toBe(0);
  });
});
