/**
 * TC-BAL-004 — Greedy fallback above 12 nonzero balances (defensive path,
 * strategy G-5)
 * (testing/balances-settlement.md §2; arch. §5.3 defensive fallback, §9 flag 2,
 * NFR-BAL-003 context).
 *
 * Unit level. 13 nonzero balances (6 creditors, 7 debtors). The plan must
 * zero everything; its length is **not** asserted (the fallback may be
 * non-minimal by contract); repeated runs are identical; the fallback warning
 * is emitted through the injected logger.
 */
import { describe, expect, it } from 'vitest';
import {
  EXACT_SEARCH_MAX_NONZERO,
  suggestSettlements,
  type SettlementEngineLogger,
} from '../../src/settlement/engine/suggestion-engine';
import { applyPlan } from './support/settlement-reference';

class CapturingLogger implements SettlementEngineLogger {
  public readonly warnings: Array<{
    fields: Record<string, unknown>;
    message: string;
  }> = [];

  warn(fields: Record<string, unknown>, message: string): void {
    this.warnings.push({ fields, message });
  }
}

/** 13 nonzero, zero-sum: 6 creditors (sum 2100) vs 7 debtors (300 each). */
function thirteenNonzero(): Map<string, number> {
  const balances = new Map<string, number>();
  const credits = [100, 200, 300, 400, 500, 600];
  credits.forEach((value, i) => balances.set(`c${String(i)}`, value));
  for (let i = 0; i < 7; i += 1) {
    balances.set(`d${String(i)}`, -300);
  }
  return balances;
}

describe('TC-BAL-004 — greedy fallback above 12 nonzero balances', () => {
  it('zeroes every balance, is deterministic, and logs the fallback warning', () => {
    const balances = thirteenNonzero();
    expect(balances.size).toBe(13);
    expect([...balances.values()].reduce((a, b) => a + b, 0)).toBe(0);
    expect(balances.size).toBeGreaterThan(EXACT_SEARCH_MAX_NONZERO);

    const logger = new CapturingLogger();
    const first = suggestSettlements(balances, { logger });
    const second = suggestSettlements(balances);

    // Correctness: the plan zeroes every balance (length not asserted).
    for (const residual of applyPlan(balances, first).values()) {
      expect(residual).toBe(0);
    }

    // Deterministic across runs.
    expect(second).toEqual(first);

    // The defensive path signalled the fallback.
    expect(logger.warnings).toHaveLength(1);
    expect(logger.warnings[0]!.fields).toMatchObject({
      nonzeroBalances: 13,
      threshold: EXACT_SEARCH_MAX_NONZERO,
    });
  });

  it('does not engage the fallback at exactly 12 nonzero balances', () => {
    // Same shape one below the boundary: 12 nonzero (6 creditors, 6 debtors).
    const balances = new Map<string, number>();
    const credits = [100, 200, 300, 400, 500, 600];
    credits.forEach((value, i) => balances.set(`c${String(i)}`, value));
    for (let i = 0; i < 6; i += 1) {
      balances.set(`d${String(i)}`, -350);
    }
    expect(balances.size).toBe(EXACT_SEARCH_MAX_NONZERO);

    const logger = new CapturingLogger();
    const plan = suggestSettlements(balances, { logger });
    for (const residual of applyPlan(balances, plan).values()) {
      expect(residual).toBe(0);
    }
    expect(logger.warnings).toHaveLength(0);
  });
});
