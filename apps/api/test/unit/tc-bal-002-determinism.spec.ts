/**
 * TC-BAL-002 — Suggestion determinism and input-order independence
 * (testing/balances-settlement.md §2; FR-BAL-004 context, BR-BAL-008 context;
 * arch. 01-system-architecture.md §5.3 "identical balances always produce the
 * identical plan").
 *
 * Unit level. The same balances, re-presented in a different insertion order,
 * must yield a deep-equal plan: stable member-id iteration makes the plan a
 * pure function of the balances.
 */
import { describe, expect, it } from 'vitest';
import { suggestSettlements } from '../../src/settlement/engine/suggestion-engine';

describe('TC-BAL-002 — determinism and input-order independence', () => {
  it('returns the identical plan on every run and across shuffled map insertion order', () => {
    const balances = new Map<string, number>([
      ['alice', 5000],
      ['bob', -2000],
      ['carol', -3000],
    ]);

    const first = suggestSettlements(balances);
    const second = suggestSettlements(balances);

    // Same balances, different insertion order (a "shuffled map construction").
    const shuffled = new Map<string, number>([
      ['carol', -3000],
      ['alice', 5000],
      ['bob', -2000],
    ]);
    const third = suggestSettlements(shuffled);

    expect(first.length).toBeGreaterThan(0);
    expect(second).toEqual(first);
    expect(third).toEqual(first);
  });
});
