/**
 * Argon2id password hashing utility (TKT-accounts-001; NFR-ACC-001,
 * 01-system-architecture.md §4 password-hashing row).
 *
 * Pure functions taking the parameters explicitly so they are unit-testable in
 * isolation (TC-ACC-019) without booting Nest or a database. The injectable
 * {@link PasswordHasher} wires the validated `APP_CONFIG` parameters
 * (`ARGON2_MEMORY_COST`/`ARGON2_TIME_COST`/`ARGON2_PARALLELISM`, defaults
 * m=19456 KiB, t=2, p=1) into these functions.
 */
import * as argon2 from 'argon2';
import type { Argon2Config } from '../config/env';

/** The algorithm identifier every stored hash must carry (TC-ACC-020). */
export const ARGON2ID_ALGORITHM = 'argon2id';

/**
 * Hash `password` with Argon2id using the given parameters. The returned
 * string is the standard PHC encoded hash (`$argon2id$v=19$m=…,t=…,p=…$…`).
 */
export function hashPassword(
  password: string,
  params: Argon2Config,
): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: params.memoryCost,
    timeCost: params.timeCost,
    parallelism: params.parallelism,
  });
}

/** Constant-time verification of `password` against an encoded hash. */
export function verifyPassword(
  hash: string,
  password: string,
): Promise<boolean> {
  return argon2.verify(hash, password);
}

/** Decoded parameters of a PHC-encoded Argon2id hash (TC-ACC-019). */
export interface DecodedArgon2Hash {
  readonly algorithm: string;
  readonly memoryCost: number;
  readonly timeCost: number;
  readonly parallelism: number;
}

/**
 * Parse the algorithm and cost parameters out of an encoded Argon2 hash.
 * Returns `null` for a malformed or non-Argon2 string.
 */
export function decodeArgon2Hash(
  encoded: string,
): DecodedArgon2Hash | null {
  // $argon2id$v=19$m=19456,t=2,p=1$<salt>$<hash>
  const match = /^\$(argon2(?:id|i|d))\$v=\d+\$m=(\d+),t=(\d+),p=(\d+)\$/.exec(
    encoded,
  );
  if (!match) {
    return null;
  }
  return {
    algorithm: match[1] as string,
    memoryCost: Number(match[2]),
    timeCost: Number(match[3]),
    parallelism: Number(match[4]),
  };
}
