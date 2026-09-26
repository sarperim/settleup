/**
 * pino logger construction (TKT-foundation-004; 01-system-architecture.md §8.4).
 *
 * One logger instance for the process; a caller may redirect it to an
 * in-memory stream (tests). `base: undefined` drops pid/hostname so log lines
 * stay lean, and the ISO timestamp keeps them deterministic to parse.
 */
import { pino, type DestinationStream, type Logger } from 'pino';

export function buildLogger(
  level: string,
  stream?: DestinationStream,
): Logger {
  const options = {
    level,
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime,
  };
  return stream === undefined ? pino(options) : pino(options, stream);
}
