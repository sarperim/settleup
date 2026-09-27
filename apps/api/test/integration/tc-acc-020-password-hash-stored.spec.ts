/**
 * TC-ACC-020 — Stored credential is an Argon2id hash, never plaintext
 * (accounts-access.md §2; NFR-ACC-001, data-model §4 `users.passwordHash`).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createIntegrationApp, type IntegrationApp } from './support/app';
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

describe('TC-ACC-020 — stored credential is an Argon2id hash', () => {
  it('stores a $argon2id$ hash that is not the plaintext password', async () => {
    await registerUser(ctx.server, 'alice@test.local', TEST_PASSWORD, 'Alice');

    const user = await ctx.prisma.user.findUnique({
      where: { email: 'alice@test.local' },
    });

    expect(user).not.toBeNull();
    expect(user?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(user?.passwordHash).not.toBe(TEST_PASSWORD);
  });
});
