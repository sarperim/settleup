/**
 * TC-GRP-002 — Join-code generator: uniqueness across a large seeded sample
 * (groups-membership.md §2; NFR-GRP-005, FR-GRP-002 "unique join code for each
 * group", 02-data-model.md §4 `joinCode @unique`).
 *
 * Unit level, seeded PRNG injected (strategy §3 T5). A collision in the sample
 * would surface a biased construction; the fixed seed makes the verdict
 * deterministic.
 */
import { describe, expect, it } from 'vitest';
import { generateJoinCode } from '../../src/groups/join-code';
import { SeededRandomSource } from './support/seeded-prng';

/** Fixed seed recorded in the test (§7 rule 2 — reproducible). */
const SEED = 0xc0ffee01;
const SAMPLE_SIZE = 10_000;

describe('TC-GRP-002 — join-code uniqueness over a large seeded sample', () => {
  it('produces 10,000 distinct codes from the seeded stream', () => {
    const source = new SeededRandomSource(SEED);
    const codes = new Set<string>();

    for (let i = 0; i < SAMPLE_SIZE; i += 1) {
      codes.add(generateJoinCode(source));
    }

    expect(codes.size).toBe(SAMPLE_SIZE);
  });
});
