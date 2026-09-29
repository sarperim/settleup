/**
 * TC-BAL-001 — Suggestion minimality vs an exhaustive brute-force reference
 * (seeded property test)
 * (testing/balances-settlement.md §2; SC-002, OBJ-002, FR-BAL-004,
 * BR-BAL-004, NFR-BAL-002/003, R-BAL-002; arch. 01-system-architecture.md §5.3).
 *
 * Unit level — pure engine, no DB/HTTP. The reference is an independent
 * exhaustive search (test-only, `support/settlement-reference.ts`). Fixed
 * fast-check seed makes every verdict reproducible (strategy §7 rule 2).
 *
 * Generator (strategy §5 / plan): zero-sum balance vectors with 2–8 nonzero
 * integer entries — `n − 1` random nonzero signed amounts and a final entry
 * that negates their total, so the vector sums to zero by construction. Cases
 * without both a creditor and a debtor (or with a zero entry) are discarded.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { suggestSettlements } from '../../src/settlement/engine/suggestion-engine';
import {
  applyPlan,
  referenceMinTransactions,
} from './support/settlement-reference';

/** Fixed fast-check seed; a failure is reproducible from it (§7 rule 2). */
const FAST_CHECK_SEED = 0xba12026;
const RUNS = 500;

const AMOUNT_MAX = 100;

/**
 * Zero-sum vector with `n` (2–8) nonzero entries and at least one creditor and
 * one debtor: `n − 1` random nonzero signed amounts plus the negated total.
 */
const zeroSumVector = fc.integer({ min: 2, max: 8 }).chain((n) =>
  fc
    .array(
      fc.integer({ min: -AMOUNT_MAX, max: AMOUNT_MAX }).filter((v) => v !== 0),
      { minLength: n - 1, maxLength: n - 1 },
    )
    .map((partial) => {
      const balances = new Map<string, number>();
      partial.forEach((value, i) => {
        balances.set(`m${String(i).padStart(2, '0')}`, value);
      });
      const total = partial.reduce((a, b) => a + b, 0);
      balances.set(`m${String(n - 1).padStart(2, '0')}`, -total);
      return balances;
    })
    .filter((balances) => {
      const values = [...balances.values()];
      return (
        values.every((value) => value !== 0) &&
        values.some((value) => value > 0) &&
        values.some((value) => value < 0)
      );
    }),
);

describe('TC-BAL-001 — suggestion minimality vs exhaustive reference', () => {
  it('zeroes every balance, matches the reference minimum, and never emits a sign-violating or zero payment', () => {
    fc.assert(
      fc.property(zeroSumVector, (balances) => {
        const plan = suggestSettlements(balances);

        // Fixture validity: the generator produced a genuine zero-sum vector.
        const total = [...balances.values()].reduce((a, b) => a + b, 0);
        expect(total).toBe(0);

        // 1. Applying the plan zeroes every balance (correctness).
        for (const residual of applyPlan(balances, plan).values()) {
          expect(residual).toBe(0);
        }

        // 2. Plan length equals the reference's minimum (minimality, OBJ-002).
        expect(plan.length).toBe(referenceMinTransactions(balances));

        // 3. Every payment runs debtor → creditor and no amount is zero.
        for (const payment of plan) {
          expect(balances.get(payment.payerId) ?? 0).toBeLessThan(0);
          expect(balances.get(payment.recipientId) ?? 0).toBeGreaterThan(0);
          expect(payment.amountKurus).toBeGreaterThan(0);
        }
      }),
      { seed: FAST_CHECK_SEED, numRuns: RUNS },
    );
  });
});
