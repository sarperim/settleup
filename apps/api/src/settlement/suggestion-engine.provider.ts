/**
 * Suggestion-engine provider (C5 — TKT-bal-003;
 * 01-system-architecture.md §3 rule 3 — "pure engines", §5.3).
 *
 * The exact minimum-transaction search itself is the **pure function** in
 * `./engine/suggestion-engine.ts` (TKT-bal-001, no DB, no Nest imports). This
 * file is the deliberately deferred **wiring** the TKT-bal-002 module skeleton
 * left out: a Nest provider exposed through the `SUGGESTION_ENGINE` token so
 * the C5 services depend on an injectable engine rather than importing the
 * function directly (mirrors the `RANDOM_SOURCE` pattern C3/C4 use for their
 * pure engines and keeps the engine swappable in unit tests).
 */
import { Injectable } from '@nestjs/common';
import {
  suggestSettlements,
  type SuggestedPayment,
} from './engine/suggestion-engine';

/** DI token for the suggestion engine. */
export const SUGGESTION_ENGINE = Symbol('SUGGESTION_ENGINE');

/** The injectable surface of the suggestion engine (arch. §5.3). */
export interface SuggestionEngine {
  /**
   * The minimum-transaction plan zeroing the given balances. Pure and
   * deterministic: identical balances (in any iteration order) → identical
   * plan; zero-balance members are excluded (BR-BAL-005).
   */
  suggest(balances: ReadonlyMap<string, number>): SuggestedPayment[];
}

/** Production provider: delegates to the pure TKT-bal-001 engine. */
@Injectable()
export class PureSuggestionEngine implements SuggestionEngine {
  suggest(balances: ReadonlyMap<string, number>): SuggestedPayment[] {
    return suggestSettlements(balances);
  }
}
