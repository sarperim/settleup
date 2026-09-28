/**
 * TC-EXP-004 — Equal-split properties (seeded property test)
 * (testing/expense-tracking.md §2; ASM-001, BR-EXP-004, FR-EXP-004,
 * FR-EXP-005, SC-002 split-engine half, R-EXP-001; arch.
 * 01-system-architecture.md §3 rule 3 + §5.1).
 *
 * Unit level — pure engine, no DB/HTTP. Randomness is injected as a seeded
 * deterministic PRNG (strategy §3 T5 — the one sanctioned double); the fixed
 * fast-check seed makes every verdict reproducible (§7 rule 2).
 *
 * Generators per strategy §5: amount 0 … 2,147,483,647 kuruş; participant
 * count 1–8.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { equalSplit } from '../../src/ledger/engine/split-engine';
import { SeededRandomSource } from './support/seeded-prng';

/** Fixed fast-check seed; a failure is reproducible from it (§7 rule 2). */
const FAST_CHECK_SEED = 0x5eed2026;
const RUNS = 500;

const KURUS_MAX = 2_147_483_647;

/** Amount 0 … storage bound; participant count 1–8 (strategy §5). */
const amountAndCount = fc.tuple(
  fc.integer({ min: 0, max: KURUS_MAX }),
  fc.integer({ min: 1, max: 8 }),
);

/** Deterministic per-case seed so each generated case is independent but
 * reproducible from the case's own (amount, n) plus the fixed run seed. */
function caseSeed(amount: number, n: number): number {
  return (((amount ^ Math.imul(n, 0x9e3779b9)) >>> 0) ^ FAST_CHECK_SEED) >>> 0;
}

function participantIds(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `u${String(i)}`);
}

describe('TC-EXP-004 — equal split properties', () => {
  it('holds exact-sum, bounds, remainder count and one-row-per-participant for every seeded case', () => {
    fc.assert(
      fc.property(amountAndCount, ([amount, n]) => {
        const ids = participantIds(n);
        const shares = equalSplit(
          amount,
          ids,
          new SeededRandomSource(caseSeed(amount, n)),
        );

        const base = Math.floor(amount / n);
        const r = amount - n * base;

        // 1. shares sum exactly to the amount.
        const sum = shares.reduce((acc, share) => acc + share.shareKurus, 0);
        expect(sum).toBe(amount);

        // 2. every share is base or base + 1 — no more than one extra kuruş.
        for (const share of shares) {
          expect(share.shareKurus === base || share.shareKurus === base + 1).toBe(true);
        }

        // 3. exactly r participants hold base + 1.
        const recipientsOfExtra = shares.filter(
          (share) => share.shareKurus === base + 1,
        ).length;
        expect(recipientsOfExtra).toBe(r);

        // 4. one share row per participant — no missing, no duplicate.
        expect(shares).toHaveLength(n);
        expect(shares.map((share) => share.participantId).sort()).toEqual(
          [...ids].sort(),
        );
      }),
      { seed: FAST_CHECK_SEED, numRuns: RUNS },
    );
  });
});
