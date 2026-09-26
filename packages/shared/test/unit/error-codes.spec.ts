import { describe, expect, it } from 'vitest';

import sharedPkg from '../../package.json';
import { ERROR_CODES, type ErrorCode } from '../../src/index';

/**
 * TKT-foundation-003 — explicit acceptance criterion 2 & 3 (ticket file):
 *
 * 2. "The error-code union covers exactly the codes of the 03 §4 table plus
 *    `LIST_TOO_LARGE` (§3b) — no more, no less."
 * 3. "No runtime dependencies — pure code, importable by api and web
 *    (arch §2 C6)."
 *
 * The runtime contract: `ERROR_CODES` is the single source the `ErrorCode`
 * union is derived from, so asserting its exact contents pins the union.
 */
describe('TKT-foundation-003 explicit criteria — error codes & purity', () => {
  /**
   * The 03-api-design.md §4 table (in table order) plus `LIST_TOO_LARGE`
   * (§3b — the defensive ledger-list cap, not in the §4 table).
   * `satisfies` pins this list against the exported union at type level;
   * the sorted deep-equal below pins it at runtime — no more, no less.
   */
  const documentedCodes = [
    'VALIDATION_FAILED',
    'INVALID_CURRENT_PASSWORD',
    'SPLIT_SUM_MISMATCH',
    'NO_PARTICIPANTS',
    'PARTICIPANT_NOT_MEMBER',
    'UNAUTHENTICATED',
    'INVALID_CREDENTIALS',
    'CSRF_HEADER_MISSING',
    'NOT_GROUP_CREATOR',
    'NOT_LOGGER',
    'NOT_PAYMENT_PARTY',
    'NOT_FOUND',
    'CODE_NOT_FOUND',
    'EMAIL_TAKEN',
    'ALREADY_MEMBER',
    'PENDING_REQUEST_EXISTS',
    'SUGGESTION_STALE',
    'ALREADY_UNDONE',
    'TOO_MANY_ATTEMPTS',
    'INTERNAL',
    'LIST_TOO_LARGE',
  ] as const satisfies readonly ErrorCode[];

  it('criterion 2 — ERROR_CODES is exactly the 03 §4 table plus LIST_TOO_LARGE (§3b), no more, no less', () => {
    expect([...ERROR_CODES].sort()).toEqual([...documentedCodes].sort());
  });

  it('criterion 2 (complement) — no duplicate codes', () => {
    expect(new Set(ERROR_CODES).size).toBe(ERROR_CODES.length);
  });

  it('criterion 3 — the shared package declares no runtime dependencies (pure code, arch 01 §2 C6)', () => {
    // The JSON import's inferred type mirrors the file exactly (no
    // dependency key exists today); read it through the optional-key view
    // the assertions actually check. All three dependency maps count:
    // pnpm auto-installs peers of workspace packages and installs
    // optional dependencies unless explicitly omitted, so "pure code"
    // requires all of them empty.
    const { dependencies, peerDependencies, optionalDependencies } =
      sharedPkg as {
        dependencies?: Record<string, string>;
        peerDependencies?: Record<string, string>;
        optionalDependencies?: Record<string, string>;
      };
    expect(Object.keys(dependencies ?? {})).toEqual([]);
    expect(Object.keys(peerDependencies ?? {})).toEqual([]);
    expect(Object.keys(optionalDependencies ?? {})).toEqual([]);
  });
});
