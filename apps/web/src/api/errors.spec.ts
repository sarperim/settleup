/**
 * Error-envelope parsing (TKT-foundation-005).
 *
 * Unit specs for the §4 error contract consumer: the SPA must turn the
 * frozen `ErrorEnvelopeDto` (packages/shared, TKT-foundation-003) into a
 * typed error and must not invent codes outside the shared union.
 */

import { ERROR_CODES, type ErrorCode } from 'shared';
import { describe, expect, it } from 'vitest';

import { ApiError, isErrorCode, parseErrorEnvelope } from './errors';

describe('isErrorCode', () => {
  it('accepts every code of the shared §4 union', () => {
    for (const code of ERROR_CODES) {
      expect(isErrorCode(code)).toBe(true);
    }
  });

  it('rejects unknown / non-string values', () => {
    expect(isErrorCode('NOT_A_REAL_CODE')).toBe(false);
    expect(isErrorCode(undefined)).toBe(false);
    expect(isErrorCode(42)).toBe(false);
  });
});

describe('parseErrorEnvelope', () => {
  it('parses a well-formed envelope with details', () => {
    expect(
      parseErrorEnvelope({
        error: { code: 'EMAIL_TAKEN', message: 'An account already exists.', details: { field: 'email' } },
      }),
    ).toEqual({
      code: 'EMAIL_TAKEN',
      message: 'An account already exists.',
      details: { field: 'email' },
    });
  });

  it('parses a well-formed envelope without details', () => {
    expect(parseErrorEnvelope({ error: { code: 'NOT_FOUND', message: 'Not found.' } })).toEqual({
      code: 'NOT_FOUND',
      message: 'Not found.',
    });
  });

  it('parses every code of the §4 table', () => {
    for (const code of ERROR_CODES as readonly ErrorCode[]) {
      expect(parseErrorEnvelope({ error: { code, message: `${code} message` } })?.code).toBe(code);
    }
  });

  it('returns null for a non-envelope body', () => {
    expect(parseErrorEnvelope(null)).toBeNull();
    expect(parseErrorEnvelope('boom')).toBeNull();
    expect(parseErrorEnvelope({})).toBeNull();
    expect(parseErrorEnvelope({ message: 'no error key' })).toBeNull();
    expect(parseErrorEnvelope({ error: 'not-an-object' })).toBeNull();
  });

  it('returns null for an unknown error code', () => {
    expect(parseErrorEnvelope({ error: { code: 'SOMETHING_ELSE', message: 'x' } })).toBeNull();
  });

  it('returns null for a missing or non-string message', () => {
    expect(parseErrorEnvelope({ error: { code: 'NOT_FOUND' } })).toBeNull();
    expect(parseErrorEnvelope({ error: { code: 'NOT_FOUND', message: 42 } })).toBeNull();
    expect(parseErrorEnvelope({ error: { code: 'NOT_FOUND', message: null } })).toBeNull();
  });

  it('omits non-object and array details', () => {
    const stringDetails = parseErrorEnvelope({
      error: { code: 'INTERNAL', message: 'x', details: 'nope' },
    });
    expect(stringDetails).toEqual({ code: 'INTERNAL', message: 'x' });
    expect(stringDetails).not.toHaveProperty('details');

    const arrayDetails = parseErrorEnvelope({
      error: { code: 'INTERNAL', message: 'x', details: ['email'] },
    });
    expect(arrayDetails).toEqual({ code: 'INTERNAL', message: 'x' });
    expect(arrayDetails).not.toHaveProperty('details');
  });
});

describe('ApiError', () => {
  it('carries status, code, message and details', () => {
    const err = new ApiError(409, 'EMAIL_TAKEN', 'taken', { field: 'email' });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ApiError');
    expect(err.status).toBe(409);
    expect(err.code).toBe('EMAIL_TAKEN');
    expect(err.message).toBe('taken');
    expect(err.details).toEqual({ field: 'email' });
  });
});
