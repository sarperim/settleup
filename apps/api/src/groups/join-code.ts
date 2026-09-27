/**
 * Join-code generator (TKT-groups-001; FR-GRP-002, NFR-GRP-005,
 * 01-system-architecture.md §4 join-code row, §3 rule 3).
 *
 * An 8-character **Crockford base32** code (`0-9`, `A-Z` minus the
 * confusable `I`, `L`, `O`, `U`) drawn from an **injected CSPRNG source** —
 * pure and unit-testable with a seeded PRNG (strategy §3 T5). The 5-bit
 * alphabet divides 2^32 exactly, so masking the low 5 bits of a uniform 32-bit
 * draw is unbiased.
 */
import type { RandomSource } from './random-source';

/** Crockford base32: `0-9` + `A-Z` without `I`, `L`, `O`, `U`. */
export const JOIN_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Join-code length (FR-GRP-002 / NFR-GRP-005). */
export const JOIN_CODE_LENGTH = 8;

/** Exactly 8 Crockford base32 characters (02-data-model.md §4). */
export const JOIN_CODE_PATTERN = /^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{8}$/;

/** Draw one 8-character Crockford base32 join code from `source`. */
export function generateJoinCode(source: RandomSource): string {
  let code = '';
  for (let i = 0; i < JOIN_CODE_LENGTH; i += 1) {
    code += JOIN_CODE_ALPHABET[source.nextUint32() & 0x1f];
  }
  return code;
}
