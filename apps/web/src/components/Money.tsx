/**
 * Money display component (TKT-foundation-005).
 *
 * Renders integer kuruş as 2-decimal TRY text via the shared `formatKurus`
 * helper — the only money-formatting boundary in the SPA
 * (packages/shared; arch 01 §4 "Money handling discipline").
 */

import { formatKurus, type Kurus } from '../money';

export interface MoneyProps {
  kurus: Kurus;
}

export function Money({ kurus }: MoneyProps) {
  return <span className="money">{formatKurus(kurus)}</span>;
}
