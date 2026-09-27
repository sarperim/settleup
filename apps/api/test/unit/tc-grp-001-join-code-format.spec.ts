/**
 * TC-GRP-001 — Join-code generator: format and determinism (injected CSPRNG)
 * (groups-membership.md §2; NFR-GRP-005, FR-GRP-002, BR-GRP-002,
 * 01-system-architecture.md §4 join-code row, §3 rule 3 injectable CSPRNG).
 *
 * Unit level, no DB/HTTP. The generator is invoked directly with a seeded
 * deterministic PRNG injected as the CSPRNG source (strategy §3 T5 — the one
 * sanctioned double).
 */
import { describe, expect, it } from 'vitest';
import {
  generateJoinCode,
  JOIN_CODE_LENGTH,
  JOIN_CODE_PATTERN,
} from '../../src/groups/join-code';
import { SeededRandomSource } from './support/seeded-prng';

/** Fixed seeds (deterministic; chosen so S1 vs S2 differ). */
const S1 = 0x5eed0001;
const S2 = 0x5eed0002;

describe('TC-GRP-001 — join-code format and determinism', () => {
  it('emits exactly 8 Crockford base32 characters and is deterministic per seed', () => {
    const first = generateJoinCode(new SeededRandomSource(S1));
    const second = generateJoinCode(new SeededRandomSource(S1));

    expect(first).toHaveLength(JOIN_CODE_LENGTH);
    expect(first).toMatch(JOIN_CODE_PATTERN);
    // Deterministic: the same seed stream yields the identical code.
    expect(second).toBe(first);
  });

  it('never emits the Crockford-excluded letters I, L, O, U', () => {
    const source = new SeededRandomSource(S1);
    for (let i = 0; i < 200; i += 1) {
      const code = generateJoinCode(source);
      expect(code).toMatch(JOIN_CODE_PATTERN);
      expect(code).not.toMatch(/[ILOU]/);
    }
  });

  it('a different seed yields a different code', () => {
    const fromS1 = generateJoinCode(new SeededRandomSource(S1));
    const fromS2 = generateJoinCode(new SeededRandomSource(S2));

    expect(fromS2).not.toBe(fromS1);
  });

  it('50 consecutive codes from the S1 stream are all valid 8-char Crockford codes', () => {
    const source = new SeededRandomSource(S1);
    const codes = Array.from({ length: 50 }, () => generateJoinCode(source));

    for (const code of codes) {
      expect(code).toHaveLength(JOIN_CODE_LENGTH);
      expect(code).toMatch(JOIN_CODE_PATTERN);
    }
  });
});
