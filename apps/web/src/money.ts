/**
 * Money display wiring (TKT-foundation-005).
 *
 * The SPA never converts money itself: the single source of truth is
 * `packages/shared` (arch 01-system-architecture.md §2 C6, §4 "Money
 * handling discipline"). This module re-exports the shared helpers so the
 * UI imports them from one app-local entry point.
 */

export { formatKurus, parseKurus } from 'shared';
export type { Kurus, KurusParseResult, KurusParseRejection } from 'shared';
