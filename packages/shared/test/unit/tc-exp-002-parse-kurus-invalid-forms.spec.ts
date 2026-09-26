import { describe, expect, it } from 'vitest';

import { parseKurus } from '../../src/index';

/**
 * TC-EXP-002 — parseKurus rejects the documented invalid forms (incl. storage bound)
 *
 * - Traces to: ASM-002, BR-EXP-010 (negative invalid), FR-EXP-002 (API-side
 *   counterpart), data-model §8 (bound 2,147,483,647 kuruş)
 * - Level: unit (`packages/shared`)
 * - Preconditions: none
 * - Steps: call `parseKurus` with each of `"-1"`, `"-0.01"`, `"1.234"`,
 *   `"1,23"`, `"abc"`, `""`, and the boundary pair `"21474836.47"` /
 *   `"21474836.48"`
 * - Expected result: every input **except** `"21474836.47"` is rejected
 *   (the shared helper's documented failure mode — a non-throwing error
 *   result); `"21474836.47"` → `2147483647` (the exact storage ceiling is
 *   the last accepted value; one kuruş more is rejected — BVA at the `Int`
 *   bound)
 *
 * Source: .pipeline/testing/expense-tracking.md §2 (TC-EXP-002) — exact
 * translation; carried by TKT-foundation-003.
 */
describe('TC-EXP-002 — parseKurus rejects the documented invalid forms (incl. storage bound)', () => {
  const rejectedForms: readonly string[] = [
    '-1',
    '-0.01',
    '1.234',
    '1,23',
    'abc',
    '',
    '21474836.48',
  ];

  it.each(rejectedForms)('parseKurus(%j) is rejected', (input) => {
    const result = parseKurus(input);
    expect(result.ok).toBe(false);
  });

  it('parseKurus("21474836.47") → 2147483647 — the exact storage ceiling is the last accepted value (BVA at the Int bound)', () => {
    expect(parseKurus('21474836.47')).toEqual({ ok: true, value: 2147483647 });
  });
});
