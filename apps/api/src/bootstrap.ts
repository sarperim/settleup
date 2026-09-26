/**
 * Boot sequence (TKT-foundation-004; 01-system-architecture.md §8.5).
 *
 * `loadEnv` runs first: a missing/malformed required variable throws before
 * any server is created, so the process exits non-zero with a clear message
 * instead of listening in a broken state.
 */
import type { NestExpressApplication } from '@nestjs/platform-express';
import { createHttpApp } from './app.factory';
import { loadEnv } from './config/env';

/**
 * Create the application and start listening on the configured `PORT`.
 * Returns the running application so callers/tests can close it.
 */
export async function bootstrap(): Promise<NestExpressApplication> {
  const env = loadEnv(process.env);
  const app = await createHttpApp();
  await app.listen(env.port);
  return app;
}
