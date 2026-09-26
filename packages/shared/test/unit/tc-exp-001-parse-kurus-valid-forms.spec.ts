import { describe, expect, it } from 'vitest';

import { parseKurus } from '../../src/index';

/**
 * TC-EXP-001 — parseKurus accepts the documented valid forms
 *
 * - Traces to: ASM-002, BR-EXP-010 (zero valid), data-model §8, arch. §4
 *   (money discipline)
 * - Level: unit (`packages/shared`) — pure function, no DB, no HTTP
 * - Preconditions: none
 * - Steps: call `parseKurus` with each of `"123"`, `"123.4"`, `"123.45"`,
 *   `"0"`, `"0.00"`, `"0.01"`
 * - Expected result: `12300`, `12340`, `12345`, `0`, `0`, `1` (integer
 *   kuruş) — every documented valid form converts exactly
 *
 * Source: .pipeline/testing/expense-tracking.md §2 (TC-EXP-001) — exact
 * translation; carried by TKT-foundation-003.
 */
describe('TC-EXP-001 — parseKurus accepts the documented valid forms', () => {
  const validForms: ReadonlyArray<readonly [string, number]> = [
    ['123', 12300],
    ['123.4', 12340],
    ['123.45', 12345],
    ['0', 0],
    ['0.00', 0],
    ['0.01', 1],
  ];

  it.each(validForms)(
    'parseKurus(%j) converts exactly to %d kuruş',
    (input, expectedKurus) => {
      expect(parseKurus(input)).toEqual({ ok: true, value: expectedKurus });
    },
  );
});
