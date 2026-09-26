/**
 * Money wiring (TKT-foundation-005).
 *
 * The SPA must use the shared money helpers rather than reimplementing the
 * kuruş boundary (arch 01 §4). This spec proves the app-local re-export is
 * the shared implementation and behaves per the TKT-foundation-003 contract.
 */

import { formatKurus as sharedFormatKurus, type Kurus } from 'shared';
import { describe, expect, it } from 'vitest';

import { formatKurus, parseKurus } from './money';

function kurus(text: string): Kurus {
  const result = parseKurus(text);
  if (!result.ok) {
    throw new Error(`fixture not parseable: ${text}`);
  }
  return result.value;
}

describe('money helper wiring', () => {
  it('re-exports the shared formatKurus', () => {
    expect(formatKurus).toBe(sharedFormatKurus);
  });

  it('formats integer kuruş as 2-decimal TRY text', () => {
    expect(formatKurus(kurus('123.45'))).toBe('123.45');
    expect(formatKurus(kurus('0'))).toBe('0.00');
    expect(formatKurus(kurus('5'))).toBe('5.00');
  });
});
