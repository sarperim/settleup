/**
 * TC-EXP-006 — Exact-split sum validation (engine level)
 * (testing/expense-tracking.md §2; BR-EXP-006, FR-EXP-007, OQ-EXP-003 zero
 * shares valid; arch. §5.1 "Exact" + §4 error-contract `SPLIT_SUM_MISMATCH`).
 *
 * Unit level — pure engine, no DB/HTTP. Exact splits are arithmetic only, so
 * the RNG is not consumed; a throwing source pins that (the remainder draw is
 * an EQUAL-split concern).
 */
import { describe, expect, it } from 'vitest';
import { splitExpense } from '../../src/ledger/engine/split-engine';

/** A source that fails the test if the exact split draws randomness. */
class ThrowingRandomSource {
  nextUint32(): number {
    throw new Error('exact split must not draw randomness');
  }
}

const NEVER = new ThrowingRandomSource();

describe('TC-EXP-006 — exact-split sum validation', () => {
  it('accepts a vector summing exactly to the amount, shares as entered', () => {
    const result = splitExpense(
      {
        amountKurus: 5000,
        participantIds: ['alice', 'bob', 'carol'],
        splitType: 'EXACT',
        exactAmounts: { alice: 1000, bob: 2500, carol: 1500 },
      },
      NEVER,
    );

    expect(result).toEqual({
      ok: true,
      shares: [
        { participantId: 'alice', shareKurus: 1000 },
        { participantId: 'bob', shareKurus: 2500 },
        { participantId: 'carol', shareKurus: 1500 },
      ],
    });
  });

  it('accepts a valid vector containing a 0-kuruş share (zeros preserved)', () => {
    const result = splitExpense(
      {
        amountKurus: 5000,
        participantIds: ['alice', 'bob', 'carol'],
        splitType: 'EXACT',
        exactAmounts: { alice: 0, bob: 2500, carol: 2500 },
      },
      NEVER,
    );

    expect(result).toEqual({
      ok: true,
      shares: [
        { participantId: 'alice', shareKurus: 0 },
        { participantId: 'bob', shareKurus: 2500 },
        { participantId: 'carol', shareKurus: 2500 },
      ],
    });
  });

  it('rejects a vector summing to the amount − 1 with SPLIT_SUM_MISMATCH', () => {
    const result = splitExpense(
      {
        amountKurus: 5000,
        participantIds: ['alice', 'bob'],
        splitType: 'EXACT',
        exactAmounts: { alice: 2500, bob: 2499 },
      },
      NEVER,
    );

    expect(result).toEqual({ ok: false, reason: 'SPLIT_SUM_MISMATCH' });
  });

  it('rejects a vector summing to the amount + 1 with SPLIT_SUM_MISMATCH', () => {
    const result = splitExpense(
      {
        amountKurus: 5000,
        participantIds: ['alice', 'bob'],
        splitType: 'EXACT',
        exactAmounts: { alice: 2500, bob: 2501 },
      },
      NEVER,
    );

    expect(result).toEqual({ ok: false, reason: 'SPLIT_SUM_MISMATCH' });
  });
});
