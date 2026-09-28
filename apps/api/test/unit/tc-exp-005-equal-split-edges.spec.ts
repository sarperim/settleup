/**
 * TC-EXP-005 — Equal-split edge cases and determinism
 * (testing/expense-tracking.md §2; ASM-001, BR-EXP-004/005, FR-EXP-004/005,
 * OQ-EXP-002 zero amount, SC-002 edge list; arch. §5.1).
 *
 * Unit level — pure engine with an injected seeded PRNG (strategy §3 T5).
 * The no-remainder rows (a, b, d) run against a source that *throws* if the
 * engine draws from it, pinning the documented "r = 0 — no draw needed".
 */
import { describe, expect, it } from 'vitest';
import { equalSplit } from '../../src/ledger/engine/split-engine';
import { SeededRandomSource } from './support/seeded-prng';

/** Fixed seeds (deterministic; §7 rule 2). */
const SEED = 0x5eed0005;
const SEED_2 = 0x5eed0050;

/** A source that fails the test if the engine draws when no remainder exists. */
class ThrowingRandomSource {
  nextUint32(): number {
    throw new Error('engine drew randomness although r = 0');
  }
}

function sum(shares: readonly { shareKurus: number }[]): number {
  return shares.reduce((acc, share) => acc + share.shareKurus, 0);
}

describe('TC-EXP-005 — equal-split edge cases and determinism', () => {
  it('(a) amount 0 over 3 participants → all shares 0, no draw', () => {
    const shares = equalSplit(0, ['u0', 'u1', 'u2'], new ThrowingRandomSource());

    expect(shares).toEqual([
      { participantId: 'u0', shareKurus: 0 },
      { participantId: 'u1', shareKurus: 0 },
      { participantId: 'u2', shareKurus: 0 },
    ]);
  });

  it('(b) n = 1, amount 12345 → the single share is 12345, no draw', () => {
    const shares = equalSplit(12345, ['u0'], new ThrowingRandomSource());

    expect(shares).toEqual([{ participantId: 'u0', shareKurus: 12345 }]);
  });

  it('(c) amount 2 over 3 participants (amount < n) → two shares of 1, one of 0', () => {
    const shares = equalSplit(2, ['u0', 'u1', 'u2'], new SeededRandomSource(SEED));

    expect(sum(shares)).toBe(2);
    expect(shares.map((share) => share.shareKurus).sort()).toEqual([0, 1, 1]);
  });

  it('(d) amount 900 over 3 participants (exact division) → 300/300/300, no draw', () => {
    const shares = equalSplit(900, ['u0', 'u1', 'u2'], new ThrowingRandomSource());

    expect(shares).toEqual([
      { participantId: 'u0', shareKurus: 300 },
      { participantId: 'u1', shareKurus: 300 },
      { participantId: 'u2', shareKurus: 300 },
    ]);
  });

  it('(e) same input + same seed → identical share vector, twice in a row', () => {
    const ids = ['u0', 'u1', 'u2', 'u3'];
    const first = equalSplit(10002, ids, new SeededRandomSource(SEED));
    const second = equalSplit(10002, ids, new SeededRandomSource(SEED));

    expect(second).toEqual(first);
  });

  it('(e) a different seed yields a valid vector with the same arithmetic properties', () => {
    const ids = ['u0', 'u1', 'u2', 'u3'];
    const a = equalSplit(10002, ids, new SeededRandomSource(SEED));
    const b = equalSplit(10002, ids, new SeededRandomSource(SEED_2));

    // amount 10002 over 4: base 2500, r = 2 → exactly two shares of 2501.
    for (const shares of [a, b]) {
      expect(sum(shares)).toBe(10002);
      expect(shares.map((share) => share.shareKurus).sort()).toEqual([
        2500, 2500, 2501, 2501,
      ]);
    }
  });

  it('(f) amount 2,147,483,647 over 8 participants → sum exact, bounds hold, 7 extras', () => {
    const ids = Array.from({ length: 8 }, (_, i) => `u${String(i)}`);
    const shares = equalSplit(2_147_483_647, ids, new SeededRandomSource(SEED));

    const base = Math.floor(2_147_483_647 / 8); // 268,435,455, r = 7
    expect(sum(shares)).toBe(2_147_483_647);
    expect(shares).toHaveLength(8);
    for (const share of shares) {
      expect(share.shareKurus === base || share.shareKurus === base + 1).toBe(true);
    }
    expect(shares.filter((share) => share.shareKurus === base + 1)).toHaveLength(7);
  });
});
