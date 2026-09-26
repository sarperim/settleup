import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * Minimal boot skeleton (TKT-foundation-001).
 *
 * The full platform — config validation (fail-fast §8.5), helmet, cookie-parser,
 * pino logging, the global exception filter and static SPA serving — is wired by
 * TKT-foundation-004.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT ?? 3007);
  await app.listen(port);
}

void bootstrap();
