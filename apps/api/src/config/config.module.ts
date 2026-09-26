/**
 * Global configuration module (TKT-foundation-004).
 *
 * The provider factory runs `loadEnv(process.env)` the first time anything
 * injects `APP_CONFIG` — i.e. during application init. A missing/malformed
 * variable therefore aborts boot with an {@link EnvValidationError}
 * (fail fast, arch. §8.5) rather than surfacing later as a runtime fault.
 */
import { Global, Module } from '@nestjs/common';
import { APP_CONFIG } from './app-config';
import { loadEnv } from './env';

@Global()
@Module({
  providers: [
    {
      provide: APP_CONFIG,
      useFactory: () => loadEnv(process.env),
    },
  ],
  exports: [APP_CONFIG],
})
export class AppConfigModule {}
