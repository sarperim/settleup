/**
 * TC-ACC-019 — Password hashing uses Argon2id with the specified parameters
 * (accounts-access.md §2; NFR-ACC-001, 01-system-architecture.md §4).
 *
 * Unit level: pure call to the app's hashing utility. The hash must decode to
 * `argon2id` with m=19456 KiB, t=2, p=1, verify the correct password and reject
 * a wrong one.
 */
import { describe, expect, it } from 'vitest';
import {
  decodeArgon2Hash,
  hashPassword,
  verifyPassword,
} from '../../src/auth/password';

const ARGON2ID_DEFAULTS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

const PASSWORD = 'correct horse battery staple';

describe('TC-ACC-019 — Argon2id parameters', () => {
  it('encodes argon2id with m=19456, t=2, p=1', async () => {
    const encoded = await hashPassword(PASSWORD, ARGON2ID_DEFAULTS);

    expect(encoded.startsWith('$argon2id$')).toBe(true);
    expect(decodeArgon2Hash(encoded)).toEqual({
      algorithm: 'argon2id',
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
  });

  it('verifies the correct password and rejects a wrong one', async () => {
    const encoded = await hashPassword(PASSWORD, ARGON2ID_DEFAULTS);

    await expect(verifyPassword(encoded, PASSWORD)).resolves.toBe(true);
    await expect(verifyPassword(encoded, 'not-the-password')).resolves.toBe(
      false,
    );
  });
});
