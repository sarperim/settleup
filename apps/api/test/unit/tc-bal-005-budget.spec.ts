/**
 * TC-BAL-005 — Suggestion-engine computation budget at maximum group size
 * (testing/balances-settlement.md §2; NFR-BAL-004 compute half, arch. §7).
 *
 * Unit level. For each adversarial 8-member zero-sum vector, run the engine
 * 5 times and record durations. Per strategy T4 the ≤ 50 ms sub-budget is
 * measured and logged; the CI-enforced hard gate is 3× (150 ms) — the runner
 * is not expected to gate the tighter sub-budget.
 */
import { describe, expect, it } from 'vitest';
import { suggestSettlements } from '../../src/settlement/engine/suggestion-engine';
import { applyPlan } from './support/settlement-reference';

/** Fixed adversarial inputs: 7 large values, the 8th their negation. */
function zeroSumVector(values7: readonly number[]): Map<string, number> {
  const total = values7.reduce((a, b) => a + b, 0);
  const balances = new Map<string, number>();
  values7.forEach((value, i) => balances.set(`m${String(i)}`, value));
  balances.set('m7', -total);
  return balances;
}

const ADVERSARIAL_VECTORS: ReadonlyArray<Map<string, number>> = [
  // 4 creditors vs 4 debtors; near-equal large primes force deep splitting.
  new Map<string, number>([
    ['m0', 999983],
    ['m1', 998321],
    ['m2', 997219],
    ['m3', 996167],
    ['m4', -1000001],
    ['m5', -999999],
    ['m6', -995001],
    ['m7', -996689],
  ]),
  // Alternating signs over large primes; single large debtor of the rest.
  zeroSumVector([999983, 998321, -997219, -996167, 995147, -994097, 993053]),
  // Coprime-ish large values, one debt side split across five members.
  zeroSumVector([1000003, 999983, -500009, -499979, -500001, 750017, -750000]),
];

const RUNS_PER_VECTOR = 5;
const SUB_BUDGET_MS = 50;
const CI_BOUND_MS = 150; // strategy T4: 3× the sub-budget

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[middle]!;
  }
  return (sorted[middle - 1]! + sorted[middle]!) / 2;
}

describe('TC-BAL-005 — suggestion-engine computation budget', () => {
  it('keeps the median under the T4 CI bound for every adversarial 8-member vector', () => {
    for (const [index, balances] of ADVERSARIAL_VECTORS.entries()) {
      expect(balances.size).toBe(8);
      expect([...balances.values()].reduce((a, b) => a + b, 0)).toBe(0);

      const durations: number[] = [];
      for (let run = 0; run < RUNS_PER_VECTOR; run += 1) {
        const started = performance.now();
        const plan = suggestSettlements(balances);
        durations.push(performance.now() - started);
        for (const residual of applyPlan(balances, plan).values()) {
          expect(residual).toBe(0);
        }
      }

      const med = median(durations);
      // Measured sub-budget (informational; T4 gates the 3× bound).
      if (med > SUB_BUDGET_MS) {
        console.warn(
          `TC-BAL-005 vector ${String(index)} median ${med.toFixed(2)} ms exceeds the ${String(
            SUB_BUDGET_MS,
          )} ms sub-budget`,
        );
      }
      expect(med).toBeLessThanOrEqual(CI_BOUND_MS);
    }
  });
});
