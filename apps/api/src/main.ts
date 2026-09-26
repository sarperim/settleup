import 'reflect-metadata';
import { bootstrap } from './bootstrap';
import { buildLogger } from './common/logging/logger';
import { LOG_LEVELS, type LogLevel } from './config/env';

/**
 * Process entry point (TKT-foundation-004).
 *
 * The `require.main === module` guard keeps `bootstrap()` importable by tests
 * without starting a listener. A boot failure exits non-zero (fail fast). The
 * logger is built defensively here — an invalid `LOG_LEVEL` must not mask the
 * real boot error.
 */
async function main(): Promise<void> {
  try {
    await bootstrap();
  } catch (error: unknown) {
    const rawLevel = process.env.LOG_LEVEL;
    const level: LogLevel = (LOG_LEVELS as readonly string[]).includes(
      rawLevel ?? '',
    )
      ? (rawLevel as LogLevel)
      : 'info';
    buildLogger(level).fatal({ err: error }, 'boot_failed');
    process.exitCode = 1;
  }
}

if (require.main === module) {
  void main();
}
