/**
 * Test-only exhaustive reference for the suggestion engine (TC-BAL-001).
 *
 * Implemented independently of `apps/api/src/settlement/engine/**`: it pivots
 * on the **first nonzero account of either sign** (the canonical minimum-cash-
 * flow recursion) whereas the engine pivots on the first *debtor*. It computes
 * the true minimum number of tight transfers that zeroes a zero-sum vector by
 * exhaustive search, memoized on the canonical balance vector — slow by design,
 * permitted by NFR-BAL-003 for ≤ 8 nonzero balances.
 */
import type { SuggestedPayment } from '../../../src/settlement/engine/suggestion-engine';

function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function sign(value: number): number {
  return value > 0 ? 1 : value < 0 ? -1 : 0;
}

/**
 * Minimum number of transfers (each between accounts of opposite sign) that
 * zeroes the given zero-sum vector, via the standard first-nonzero recursion.
 */
export function referenceMinTransactions(
  balances: ReadonlyMap<string, number>,
): number {
  const ordered = [...balances.entries()]
    .filter(([, value]) => value !== 0)
    .sort((a, b) => compareIds(a[0], b[0]));
  const amounts = ordered.map(([, value]) => value);
  const memo = new Map<string, number>();

  const rec = (a: readonly number[]): number => {
    const idx = a.findIndex((value) => value !== 0);
    if (idx === -1) {
      return 0;
    }
    const key = a.join(',');
    const cached = memo.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const pivot = a[idx]!;
    let best = Number.POSITIVE_INFINITY;
    for (let j = 0; j < a.length; j += 1) {
      if (j === idx) {
        continue;
      }
      const other = a[j]!;
      if (other === 0 || sign(other) === sign(pivot)) {
        continue;
      }
      const amount = Math.min(Math.abs(pivot), Math.abs(other));
      const next = a.slice();
      next[idx] = pivot - sign(pivot) * amount;
      next[j] = other - sign(other) * amount;
      const candidate = 1 + rec(next);
      if (candidate < best) {
        best = candidate;
      }
    }

    memo.set(key, best);
    return best;
  };

  return rec(amounts);
}

/** Applies a plan to a balance vector, returning the residual balances. */
export function applyPlan(
  balances: ReadonlyMap<string, number>,
  plan: readonly SuggestedPayment[],
): Map<string, number> {
  const result = new Map(balances);
  for (const payment of plan) {
    result.set(
      payment.payerId,
      (result.get(payment.payerId) ?? 0) + payment.amountKurus,
    );
    result.set(
      payment.recipientId,
      (result.get(payment.recipientId) ?? 0) - payment.amountKurus,
    );
  }
  return result;
}
