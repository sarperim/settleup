/**
 * pino logger construction (TKT-foundation-004; 01-system-architecture.md §8.4).
 *
 * One logger instance for the process; a caller may redirect it to an
 * in-memory stream (tests). `base: undefined` drops pid/hostname so log lines
 * stay lean, and the ISO timestamp keeps them deterministic to parse.
 *
 * Defense-in-depth redaction (review round 2, F-S-6): the platform itself
 * never logs secrets, but the domain modules (C2–C5) will hold this logger —
 * any field named like a secret is censored at the sink (top level and one
 * level deep), whatever the caller passes.
 */
import { pino, type DestinationStream, type Logger } from 'pino';

const REDACTED_KEYS = [
  'password',
  'email',
  'token',
  'cookie',
  'cookies',
  'authorization',
  'settleup_session',
] as const;

/** Each key redacted at the top level and one nesting level deep. */
const REDACT_PATHS: string[] = REDACTED_KEYS.flatMap((key) => [
  key,
  `*.${key}`,
]);

export function buildLogger(
  level: string,
  stream?: DestinationStream,
): Logger {
  const options = {
    level,
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: { paths: REDACT_PATHS, censor: '[redacted]' },
  };
  return stream === undefined ? pino(options) : pino(options, stream);
}
