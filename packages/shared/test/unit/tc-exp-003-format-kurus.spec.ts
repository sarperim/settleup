import { describe, expect, it } from 'vitest';

import { formatKurus, parseKurus, type Kurus } from '../../src/index';

/**
 * TC-EXP-003 — formatKurus renders kuruş as 2-decimal TRY strings
 *
 * - Traces to: ASM-002, data-model §8
 * - Level: unit (`packages/shared`)
 * - Preconditions: none
 * - Steps: call `formatKurus` with `0`, `5`, `12345`, `2147483647`
 * - Expected result: `"0.00"`, `"0.05"`, `"123.45"`, `"21474836.47"` —
 *   round-trips with `parseKurus` (`parseKurus(formatKurus(k)) === k` for
 *   these values)
 *
 * Source: .pipeline/testing/expense-tracking.md §2 (TC-EXP-003) — exact
 * translation; carried by TKT-foundation-003.
 */
describe('TC-EXP-003 — formatKurus renders kuruş as 2-decimal TRY strings', () => {
  /** The four documented inputs are integer kuruş; brand them for the call. */
  const asKurus = (kurus: number): Kurus => kurus as Kurus;

  const formatCases: ReadonlyArray<readonly [number, string]> = [
    [0, '0.00'],
    [5, '0.05'],
    [12345, '123.45'],
    [2147483647, '21474836.47'],
  ];

  it.each(formatCases)(
    'formatKurus(%d) → %j and round-trips through parseKurus',
    (kurus, expectedTry) => {
      expect(formatKurus(asKurus(kurus))).toBe(expectedTry);
      expect(parseKurus(formatKurus(asKurus(kurus)))).toEqual({
        ok: true,
        value: kurus,
      });
    },
  );
});
