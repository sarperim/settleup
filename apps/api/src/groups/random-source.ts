/**
 * Injectable randomness source (TKT-groups-001; 01-system-architecture.md §3
 * rule 3 — "Randomness ... comes from an injectable CSPRNG source").
 *
 * The join-code generator consumes this interface, never `node:crypto`
 * directly, so unit tests can inject a seeded deterministic PRNG (strategy
 * §3 T5 — the one sanctioned double) and the production provider draws from a
 * cryptographically secure source. C4's split engine reuses the same pattern
 * for ASM-001.
 */
import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';

/** A source of uniformly distributed 32-bit unsigned integers. */
export interface RandomSource {
  /** Next 32-bit unsigned integer (`0` … `2^32 − 1`). */
  nextUint32(): number;
}

/** DI token for the production CSPRNG source. */
export const RANDOM_SOURCE = Symbol('RANDOM_SOURCE');

/** Production source: 4 fresh CSPRNG bytes per draw (`node:crypto`). */
@Injectable()
export class CryptoRandomSource implements RandomSource {
  nextUint32(): number {
    return randomBytes(4).readUInt32BE(0);
  }
}
