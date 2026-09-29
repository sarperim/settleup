/**
 * Suggestion engine (C5 — Settlement) — TKT-bal-001.
 *
 * A pure decision function: the group's current nonzero balances (member id →
 * signed integer kuruş) → the minimum-transaction settlement plan that zeroes
 * every balance. No DB, no Nest wiring (arch. 01-system-architecture.md §3
 * rule 3 + §5.3; the module wiring lands with TKT-bal-002/003).
 *
 * Algorithm (arch. §5.3, "exact search"):
 * - Depth-first search. At each state the **first debtor** (smallest member id
 *   with a negative balance) is settled against each creditor in turn, moving
 *   `min(|debtor|, creditor)` — a tight transfer that zeroes at least one side.
 *   The search recurses on the reduced balance vector, **memoizes on the
 *   canonical state**, and keeps the first minimum-length solution found.
 * - **Deterministic:** debtors and creditors are iterated in a locale-
 *   independent code-unit comparison of member ids, so identical balances
 *   always produce the identical plan (BR-BAL-008 context / mark-paid is
 *   well-defined).
 * - Zero-balance members are excluded entirely (BR-BAL-005); every amount is
 *   an exact integer number of kuruş — sub-lira suggestions (e.g. 1 kuruş) are
 *   emitted, never rounded (BR-BAL-011).
 * - **Defensive fallback** (arch. §5.3, §9 flag 2): above
 *   {@link EXACT_SEARCH_MAX_NONZERO} nonzero balances (impossible at the
 *   brief's ≤ 8-member scale) the exact search is skipped for greedy
 *   largest-debtor ↔ largest-creditor matching. Still zeroes everything, may
 *   be non-minimal, remains deterministic, and a warning is emitted through
 *   the injected logger.
 *
 * Logging is injected (never imported) so the engine stays a pure function
 * that unit tests exercise without a logger; the C5 service wires pino.
 */

/** One suggested outstanding payment, in integer kuruş (engine-local ids). */
export interface SuggestedPayment {
  /** The member who owes (engine input had a negative balance). */
  payerId: string;
  /** The member who is owed (engine input had a positive balance). */
  recipientId: string;
  /** Exact transfer amount, `> 0`, integer kuruş. */
  amountKurus: number;
}

/**
 * Minimal logging sink for the defensive fallback — structurally compatible
 * with pino's `Logger.warn(obj, msg)` so the C5 service can pass its logger
 * straight through. Injectable to keep this engine pure and testable.
 */
export interface SettlementEngineLogger {
  warn(fields: Record<string, unknown>, message: string): void;
}

export interface SuggestSettlementsOptions {
  /** Optional sink for the defensive-fallback warning. */
  logger?: SettlementEngineLogger;
}

/**
 * Nonzero balances above this count skip the exact search (§5.3 defensive
 * fallback). The plan's TC-BAL-004 boundary is "13 nonzero → fallback", so the
 * threshold is `< 13` exact / `> 12` fallback.
 */
export const EXACT_SEARCH_MAX_NONZERO = 12;

/** Locale-independent member-id ordering (code-unit order). */
function compareIds(a: string, b: string): number {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}

/** Canonical, order-independent key for a balance state (memoization). */
function canonicalKey(balances: ReadonlyMap<string, number>): string {
  const parts: string[] = [];
  for (const [id, value] of balances) {
    if (value !== 0) {
      parts.push(`${id}:${value}`);
    }
  }
  parts.sort();
  return parts.join('|');
}

/**
 * Exact minimum-transaction search (arch. §5.3). Returns the first
 * minimum-length plan in deterministic iteration order. The input is a
 * normalized zero-sum vector; a residual imbalance with no opposite side
 * (malformed input) yields no payment for the stranded debt.
 */
function exactSearch(initial: ReadonlyMap<string, number>): SuggestedPayment[] {
  const memo = new Map<string, SuggestedPayment[]>();

  const solve = (balances: Map<string, number>): SuggestedPayment[] => {
    const key = canonicalKey(balances);
    const cached = memo.get(key);
    if (cached !== undefined) {
      return cached;
    }

    let debtor: string | null = null;
    for (const id of balances.keys()) {
      const value = balances.get(id)!;
      if (value < 0 && (debtor === null || compareIds(id, debtor) < 0)) {
        debtor = id;
      }
    }
    if (debtor === null) {
      return [];
    }

    const creditorIds: string[] = [];
    for (const [id, value] of balances) {
      if (value > 0) {
        creditorIds.push(id);
      }
    }
    creditorIds.sort(compareIds);

    const debtorBalance = balances.get(debtor)!;
    let best: SuggestedPayment[] | null = null;
    for (const creditorId of creditorIds) {
      const creditorBalance = balances.get(creditorId)!;
      const amount = Math.min(-debtorBalance, creditorBalance);

      const next = new Map(balances);
      const remainingDebtor = debtorBalance + amount;
      const remainingCreditor = creditorBalance - amount;
      if (remainingDebtor === 0) {
        next.delete(debtor);
      } else {
        next.set(debtor, remainingDebtor);
      }
      if (remainingCreditor === 0) {
        next.delete(creditorId);
      } else {
        next.set(creditorId, remainingCreditor);
      }

      const candidate: SuggestedPayment[] = [
        { payerId: debtor, recipientId: creditorId, amountKurus: amount },
        ...solve(next),
      ];
      if (best === null || candidate.length < best.length) {
        best = candidate;
      }
    }

    const result = best ?? [];
    memo.set(key, result);
    return result;
  };

  return solve(new Map(initial));
}

/**
 * Greedy fallback (arch. §5.3): repeatedly match the largest debtor
 * (most negative) with the largest creditor (most positive), tie-broken by
 * member id. Always zeroes a zero-sum vector; may be non-minimal.
 */
function greedyFallback(
  initial: ReadonlyMap<string, number>,
): SuggestedPayment[] {
  const balances = new Map(initial);
  const plan: SuggestedPayment[] = [];

  for (;;) {
    let debtor: string | null = null;
    let debtorBalance = 0;
    let creditor: string | null = null;
    let creditorBalance = 0;

    for (const [id, value] of balances) {
      if (
        value < 0 &&
        (debtor === null ||
          -value > -debtorBalance ||
          (-value === -debtorBalance && compareIds(id, debtor) < 0))
      ) {
        debtor = id;
        debtorBalance = value;
      }
      if (
        value > 0 &&
        (creditor === null ||
          value > creditorBalance ||
          (value === creditorBalance && compareIds(id, creditor) < 0))
      ) {
        creditor = id;
        creditorBalance = value;
      }
    }

    if (debtor === null || creditor === null) {
      break;
    }

    const amount = Math.min(-debtorBalance, creditorBalance);
    plan.push({ payerId: debtor, recipientId: creditor, amountKurus: amount });

    const remainingDebtor = debtorBalance + amount;
    const remainingCreditor = creditorBalance - amount;
    if (remainingDebtor === 0) {
      balances.delete(debtor);
    } else {
      balances.set(debtor, remainingDebtor);
    }
    if (remainingCreditor === 0) {
      balances.delete(creditor);
    } else {
      balances.set(creditor, remainingCreditor);
    }
  }

  return plan;
}

/**
 * Generate the minimum-transaction settlement plan for a group's current
 * balances. Pure: same balances (in any iteration order) → same plan.
 *
 * @param balances member id → signed integer kuruş; expected zero-sum.
 * @param options  optional injected logger for the defensive-fallback warning.
 */
export function suggestSettlements(
  balances: ReadonlyMap<string, number>,
  options: SuggestSettlementsOptions = {},
): SuggestedPayment[] {
  const normalized = new Map<string, number>();
  for (const [id, value] of balances) {
    if (value !== 0) {
      normalized.set(id, value);
    }
  }

  if (normalized.size === 0) {
    return [];
  }

  if (normalized.size > EXACT_SEARCH_MAX_NONZERO) {
    options.logger?.warn(
      {
        nonzeroBalances: normalized.size,
        threshold: EXACT_SEARCH_MAX_NONZERO,
      },
      'suggestion engine: exact search skipped — greedy fallback engaged',
    );
    return greedyFallback(normalized);
  }

  return exactSearch(normalized);
}
