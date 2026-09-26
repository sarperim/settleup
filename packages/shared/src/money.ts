/**
 * Kuruş money helpers — Settle Up (TKT-foundation-003).
 *
 * Single source of truth for the money boundary (ASM-002; arch
 * 01-system-architecture.md §2 C6 + §4 "Money handling discipline";
 * 02-data-model.md §8):
 *
 * - Storage and API payloads carry **integer kuruş** (`amountKurus: 12345`
 *   = ₺123.45). Decimals exist only at the UI text-field boundary.
 * - `parseKurus` converts user-entered decimal TRY text ("123.45") into
 *   integer kuruş — the one place that conversion happens.
 * - `formatKurus` renders integer kuruş as a 2-decimal TRY string for
 *   display.
 *
 * Accepted input grammar (02-data-model.md §8, exhaustive for the
 * documented contract): `digits` or `digits.d` or `digits.dd` —
 * non-negative, at most 2 fractional digits, period separator only.
 * Everything else (negative, >2 decimals, comma separator, non-numeric,
 * empty, above the storage bound) is rejected. Zero is valid (BR-EXP-010).
 */

import { KURUS_STORAGE_BOUND } from './constants';

declare const KurusBrand: unique symbol;

/**
 * A non-negative integer kuruş amount (1/100 TRY), branded so that plain
 * numbers cannot silently flow into money-typed boundaries. Produce values
 * via `parseKurus`; the domain is 0 … `KURUS_STORAGE_BOUND`.
 *
 * Derived, signed quantities (e.g. member balances) are plain `number`s,
 * not `Kurus` — see `BalancesResponseDto`.
 */
export type Kurus = number & { readonly [KurusBrand]: true };

/** Why `parseKurus` rejected an input. */
export type KurusParseRejection =
  /** `""` — nothing to parse. */
  | 'EMPTY'
  /** Leading `-` (BR-EXP-010: negative amounts are invalid). */
  | 'NEGATIVE'
  /**
   * Not a plain decimal string: stray characters, sign other than the
   * rejected leading `-` (e.g. `+`), comma separator, spaces, `123.`,
   * `.45`, non-numeric text.
   */
  | 'NON_NUMERIC'
  /** More than 2 fractional digits (e.g. "1.234"). */
  | 'TOO_MANY_DECIMALS'
  /**
   * Valid shape, but the value exceeds 2,147,483,647 kuruş
   * (₺21,474,836.47) — the `Int` storage bound.
   */
  | 'ABOVE_STORAGE_BOUND';

/**
 * The documented failure mode of `parseKurus`: a discriminated result —
 * it never throws. Callers check `result.ok` and read either `value` or
 * `reason`.
 */
export type KurusParseResult =
  | { readonly ok: true; readonly value: Kurus }
  | { readonly ok: false; readonly reason: KurusParseRejection };

/**
 * Parse user-entered TRY text into integer kuruş.
 *
 * Accepts exactly the documented forms (02-data-model.md §8): `"123"`,
 * `"123.4"`, `"123.45"` (zero valid). Rejects negative values, more than
 * two decimals, comma separators, non-numeric text, the empty string, and
 * anything above the 2,147,483,647-kuruş storage bound.
 *
 * Rejection check order (first match wins): non-string → `NON_NUMERIC`,
 * empty → `EMPTY`, leading `-` → `NEGATIVE`, not a plain decimal string →
 * `NON_NUMERIC`, > 2 fractional digits → `TOO_MANY_DECIMALS`, above the
 * storage bound → `ABOVE_STORAGE_BOUND`.
 */
export function parseKurus(input: string): KurusParseResult {
  if (typeof input !== 'string') {
    return { ok: false, reason: 'NON_NUMERIC' };
  }
  if (input.length === 0) {
    return { ok: false, reason: 'EMPTY' };
  }
  if (input.startsWith('-')) {
    return { ok: false, reason: 'NEGATIVE' };
  }

  // Plain decimal grammar: digits, optionally a period followed by digits.
  // A stricter check on the fractional length follows; anything else
  // (comma, stray characters, "123.", ".45", "+1", spaces) fails here.
  const match = /^(\d+)(?:\.(\d+))?$/.exec(input);
  if (match === null) {
    return { ok: false, reason: 'NON_NUMERIC' };
  }

  const wholePart = match[1]!;
  const fractionPart = match[2];
  if (fractionPart !== undefined && fractionPart.length > 2) {
    return { ok: false, reason: 'TOO_MANY_DECIMALS' };
  }

  // Exact integer arithmetic: every accepted value is far below 2^53, so
  // whole*100 + fraction is exact. Values large enough to lose precision
  // are orders of magnitude above the storage bound and stay rejected.
  const fractionKurus = Number((fractionPart ?? '').padEnd(2, '0'));
  const value = Number(wholePart) * 100 + fractionKurus;

  if (value > KURUS_STORAGE_BOUND) {
    return { ok: false, reason: 'ABOVE_STORAGE_BOUND' };
  }

  return { ok: true, value: value as Kurus };
}

/**
 * Render integer kuruş as a 2-decimal TRY string: `12345 → "123.45"`,
 * `5 → "0.05"`, `0 → "0.00"`. Round-trips with `parseKurus`.
 *
 * Accepts a non-negative integer `Kurus` within the storage bound (the
 * domain `parseKurus` produces: 0 … `KURUS_STORAGE_BOUND`). Negative,
 * fractional, or above-bound input is a programming error — a legitimate
 * `Kurus` is never any of these — and throws a `RangeError` rather than
 * rendering an out-of-domain string that would only surface later, far
 * from the cause, as an `ABOVE_STORAGE_BOUND` round-trip failure. Signed
 * derived balances are not `Kurus`; format their magnitude and prepend
 * the sign at the call site.
 */
export function formatKurus(kurus: Kurus): string {
  if (!Number.isInteger(kurus) || kurus < 0 || kurus > KURUS_STORAGE_BOUND) {
    throw new RangeError(
      `formatKurus: expected a non-negative integer kuruş amount within the storage bound (≤ ${KURUS_STORAGE_BOUND}), got ${String(kurus)}`,
    );
  }
  const wholePart = Math.floor(kurus / 100);
  const fractionPart = kurus % 100;
  return `${String(wholePart)}.${String(fractionPart).padStart(2, '0')}`;
}
