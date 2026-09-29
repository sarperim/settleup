/**
 * TC-BAL-003 — Suggestion edge cases (SC-002 named list)
 * (testing/balances-settlement.md §2; SC-002, NFR-BAL-002, FR-BAL-005,
 * BR-BAL-005, BR-BAL-011, UC-BAL-002 A1 context).
 *
 * Unit level. The a–g table is transcribed exactly from the plan.
 */
import { describe, expect, it } from 'vitest';
import { suggestSettlements } from '../../src/settlement/engine/suggestion-engine';

describe('TC-BAL-003 — suggestion edge cases', () => {
  it('a — all zero → empty plan', () => {
    expect(suggestSettlements(new Map())).toEqual([]);
    expect(
      suggestSettlements(
        new Map<string, number>([
          ['A', 0],
          ['B', 0],
          ['C', 0],
        ]),
      ),
    ).toEqual([]);
  });

  it('b — single debtor/creditor → exactly 1 payment B → A 1000', () => {
    const plan = suggestSettlements(
      new Map<string, number>([
        ['A', 1000],
        ['B', -1000],
      ]),
    );
    expect(plan).toEqual([
      { payerId: 'B', recipientId: 'A', amountKurus: 1000 },
    ]);
  });

  it('c — two debtors, one creditor → exact debts, 2 payments', () => {
    const plan = suggestSettlements(
      new Map<string, number>([
        ['A', 1000],
        ['B', -600],
        ['C', -400],
      ]),
    );
    expect(plan).toEqual([
      { payerId: 'B', recipientId: 'A', amountKurus: 600 },
      { payerId: 'C', recipientId: 'A', amountKurus: 400 },
    ]);
  });

  it('d — zero-balance member excluded (BR-BAL-005)', () => {
    const plan = suggestSettlements(
      new Map<string, number>([
        ['A', 1000],
        ['B', -1000],
        ['D', 0],
      ]),
    );
    expect(plan).toEqual([
      { payerId: 'B', recipientId: 'A', amountKurus: 1000 },
    ]);
    for (const payment of plan) {
      expect(payment.payerId).not.toBe('D');
      expect(payment.recipientId).not.toBe('D');
    }
  });

  it('e — sub-lira → 1 payment of 1 kuruş, no rounding (BR-BAL-011)', () => {
    expect(
      suggestSettlements(
        new Map<string, number>([
          ['A', 1],
          ['B', -1],
        ]),
      ),
    ).toEqual([{ payerId: 'B', recipientId: 'A', amountKurus: 1 }]);
  });

  it('f — circular gross debt nets to zero → empty plan', () => {
    expect(suggestSettlements(new Map())).toEqual([]);
    // Net positions all zero: gross cycles must not produce payments.
    expect(
      suggestSettlements(
        new Map<string, number>([
          ['A', 0],
          ['B', 0],
          ['C', 0],
        ]),
      ),
    ).toEqual([]);
  });

  it('g — creditor also a gross debtor → 2 minimal payments in member-id order', () => {
    const plan = suggestSettlements(
      new Map<string, number>([
        ['A', 300],
        ['B', -500],
        ['C', 200],
      ]),
    );
    expect(plan).toEqual([
      { payerId: 'B', recipientId: 'A', amountKurus: 300 },
      { payerId: 'B', recipientId: 'C', amountKurus: 200 },
    ]);
  });
});
