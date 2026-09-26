/**
 * Interim drift-pin for FLAG-1 (TKT-foundation-004, review round 1, F-1).
 *
 * `API_ERROR_CODES` (apps/api) is a local mirror of the frozen
 * `ERROR_CODES` (packages/shared) kept only as a build-ordering workaround.
 * A rename/removal in `shared` would otherwise leave the api copy stale and
 * still compiling. This spec pins the two unions together as sets.
 *
 * It imports `shared` by relative source path on purpose — bypassing the
 * dist-only package resolution that motivates FLAG-1 — and lives under
 * `test/unit`, outside the api lint/typecheck globs, so it prejudices
 * neither the build-ordering issue nor the architect's ruling.
 *
 * DELETE this file when the root build-ordering fix lands and the api
 * imports the one true union from `shared`.
 */
import { describe, expect, it } from 'vitest';
import { API_ERROR_CODES } from '../../src/common/errors/error-contract';
import { ERROR_CODES } from '../../../../packages/shared/src/errors';

describe('FLAG-1 drift pin: api error-code mirror vs shared ERROR_CODES', () => {
  it('mirrors the shared error-code set exactly (no drift)', () => {
    expect([...API_ERROR_CODES].sort()).toEqual([...ERROR_CODES].sort());
  });
});
