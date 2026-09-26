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
  // Validate here and thread the result through the factory (review round 2,
  // F-K-4): the factory no longer re-validates `process.env` itself. The
  // `APP_CONFIG` provider still runs one `loadEnv(process.env)` during
  // `app.init()` — the fail-fast net for consumers that construct the app
  // without going through `bootstrap()` — so a production boot validates
  // env twice (review round 2, F-K2-1).
  const env = loadEnv(process.env);
  const app = await createHttpApp({ env });
  // SIGTERM (deploy restarts, container stop) runs the destroy lifecycle:
  // `PrismaService.onModuleDestroy()` → `$disconnect()` — before the hooks
  // are enabled the signal kills the process without closing the client.
  app.enableShutdownHooks();
  await app.listen(env.port);
  return app;
}
