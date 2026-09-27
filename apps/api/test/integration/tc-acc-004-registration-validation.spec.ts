/**
 * TC-ACC-004 — Registration field validation (parameterized)
 * (accounts-access.md §2; FR-ACC-001, UC-ACC-001 E1, D-ARCH-003, API §1).
 *
 * Each row runs in its own truncated database (strategy §7 rule 3). Invalid
 * rows must be rejected with `400 VALIDATION_FAILED` naming the offending
 * field and must create no account; valid rows create the account and a
 * session.
 *
 * Observation note: the plan's "no account created" check is executed two
 * ways — a direct `users`-row count (the documented data model; the same
 * observation point TC-ACC-020/030 use) and a follow-up login that must not
 * authenticate. Rows whose email is itself malformed/missing (i–l) cannot
 * reach credential verification, so the follow-up login yields
 * `400 VALIDATION_FAILED` rather than `401`; both prove no account exists.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { api, createIntegrationApp, CSRF_HEADERS, type IntegrationApp } from './support/app';
import { truncateAllTables } from './support/truncate';

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

type RegisterBody = Record<string, unknown>;

interface ValidRow {
  readonly kind: 'valid';
  readonly label: string;
  readonly body: RegisterBody;
}

interface InvalidRow {
  readonly kind: 'invalid';
  readonly label: string;
  readonly body: RegisterBody;
  readonly field: string;
}

type Row = ValidRow | InvalidRow;

const emailFor = (label: string): string => `validator-${label}@test.local`;

const rows: readonly Row[] = [
  // a: password 7 chars
  { kind: 'invalid', label: 'a', field: 'password', body: { email: emailFor('a'), password: '1234567', displayName: 'Valid' } },
  // b: password 8 chars — also proves no composition rules
  { kind: 'valid', label: 'b', body: { email: emailFor('b'), password: 'aaaaaaaa', displayName: 'Valid' } },
  // c: password 128 chars
  { kind: 'valid', label: 'c', body: { email: emailFor('c'), password: 'a'.repeat(128), displayName: 'Valid' } },
  // d: password 129 chars
  { kind: 'invalid', label: 'd', field: 'password', body: { email: emailFor('d'), password: 'a'.repeat(129), displayName: 'Valid' } },
  // e: displayName empty
  { kind: 'invalid', label: 'e', field: 'displayName', body: { email: emailFor('e'), password: 'password-1', displayName: '' } },
  // f: displayName 1 char
  { kind: 'valid', label: 'f', body: { email: emailFor('f'), password: 'password-1', displayName: 'A' } },
  // g: displayName 50 chars
  { kind: 'valid', label: 'g', body: { email: emailFor('g'), password: 'password-1', displayName: 'A'.repeat(50) } },
  // h: displayName 51 chars
  { kind: 'invalid', label: 'h', field: 'displayName', body: { email: emailFor('h'), password: 'password-1', displayName: 'A'.repeat(51) } },
  // i: invalid email format
  { kind: 'invalid', label: 'i', field: 'email', body: { email: 'not-an-email', password: 'password-1', displayName: 'Valid' } },
  // j: email missing
  { kind: 'invalid', label: 'j', field: 'email', body: { password: 'password-1', displayName: 'Valid' } },
  // k: password missing
  { kind: 'invalid', label: 'k', field: 'password', body: { email: emailFor('k'), displayName: 'Valid' } },
  // l: displayName missing
  { kind: 'invalid', label: 'l', field: 'displayName', body: { email: emailFor('l'), password: 'password-1' } },
];

describe('TC-ACC-004 — registration field validation (parameterized)', () => {
  it.each(rows)('row $label', async (row) => {
    const register = await api(ctx.server)
      .post('/api/auth/register')
      .set(CSRF_HEADERS)
      .send(row.body);

    if (row.kind === 'valid') {
      expect(register.status).toBe(201);
      expect(register.headers['set-cookie']).toBeDefined();
      await expect(ctx.prisma.user.count()).resolves.toBe(1);
      return;
    }

    expect(register.status).toBe(400);
    expect(register.body.error.code).toBe('VALIDATION_FAILED');
    expect(register.body.error.details.fields).toContain(row.field);
    expect(register.headers['set-cookie']).toBeUndefined();

    // No account created.
    await expect(ctx.prisma.user.count()).resolves.toBe(0);

    const email = row.body.email;
    const password = row.body.password;
    if (typeof email === 'string' && typeof password === 'string') {
      const login = await api(ctx.server)
        .post('/api/auth/login')
        .set(CSRF_HEADERS)
        .send({ email, password });
      expect([400, 401]).toContain(login.status);
    }
  });
});
