/**
 * Application factory — the whole cross-cutting platform in one place
 * (TKT-foundation-004).
 *
 * `createHttpApp` is the production boot path (`bootstrap.ts`); the exported
 * `configurePlatform` / `configureServing` pieces are also used by the
 * platform's own acceptance specs, so a scratch Nest module can exercise the
 * exact same global filter, CSRF middleware, validation pipe and static-server
 * configuration without duplicating them.
 */
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import * as nodePath from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import type { DestinationStream, Logger } from 'pino';
import { AppModule } from './app.module';
import { loadEnv, type AppConfig } from './config/env';
import { buildLogger } from './common/logging/logger';
import { createRequestLoggingMiddleware } from './common/http/request-logging.middleware';
import { createCsrfMiddleware } from './common/http/csrf.middleware';
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter';
import { createValidationPipe } from './common/validation/validation.pipe';

export interface CreateHttpAppOptions {
  /** Injected logger (tests); otherwise built from `LOG_LEVEL`. */
  logger?: Logger;
  /** In-memory pino destination (tests). */
  loggerStream?: DestinationStream;
  /** Static SPA root override (tests); defaults to `apps/web/dist`. */
  webRoot?: string;
  /**
   * Pre-validated config (review round 2, F-K-4): the production boot
   * validates in `bootstrap()` and passes the result through, so this
   * factory no longer re-validates. The `APP_CONFIG` provider still runs
   * one `loadEnv(process.env)` during `app.init()` — the fail-fast net
   * for consumers that construct the app without going through
   * `bootstrap()` — so a production boot validates env twice in total
   * (review round 2, F-K2-1). Callers that omit it (tests) get
   * `process.env` validated here.
   */
  env?: AppConfig;
}

/**
 * Default location of the built SPA. Both `src/app.factory.ts` (Vitest) and
 * `dist/app.factory.js` (production) sit directly under `apps/api`, so the
 * same relative hop resolves to `apps/web/dist` in either case.
 */
export function defaultWebRoot(): string {
  return nodePath.resolve(__dirname, '..', '..', 'web', 'dist');
}

/** Wire the global middlewares, pipes and filters (pre-init). */
export function configurePlatform(
  app: NestExpressApplication,
  logger: Logger,
): void {
  // Helmet first so every response — including CSRF early-rejections —
  // carries the default security headers (arch. §8.2).
  app.use(helmet());
  app.use(createRequestLoggingMiddleware(logger));
  app.use(createCsrfMiddleware());
  app.use(cookieParser());
  // The Caddy hop: trust exactly one proxy so `req.ip` is the originating
  // client, not the proxy (arch. §8.2 login-throttle keying).
  app.set('trust proxy', 1);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter(logger));
}

/**
 * Serve the built SPA at `/`: hashed assets get immutable cache headers,
 * `index.html` stays revalidated, and non-`/api` GET navigations fall back to
 * `index.html` (SPA history fallback). Must be called **before** `app.init()`
 * so it sits ahead of Nest's not-found handler.
 */
export function configureServing(
  app: NestExpressApplication,
  webRoot: string,
): void {
  app.useStaticAssets(webRoot, {
    index: 'index.html',
    setHeaders: (res, filePath) => {
      const relative = nodePath
        .relative(webRoot, filePath)
        .split(nodePath.sep)
        .join('/');
      res.setHeader('Cache-Control', cacheControlFor(relative));
    },
  });

  const server = app.getHttpAdapter().getInstance() as {
    use(
      handler: (req: Request, res: Response, next: NextFunction) => void,
    ): void;
  };

  server.use((req, res, next) => {
    const isRead = req.method === 'GET' || req.method === 'HEAD';
    // Case-insensitive prefix check (review round 2, F-S-5): an `/API/x`
    // navigation must not be served the SPA — every casing of the prefix
    // belongs to the API surface, so such requests fall through to routing
    // (a JSON 404), never to index.html.
    const path = req.path.toLowerCase();
    const isApi = path === '/api' || path.startsWith('/api/');
    if (!isRead || isApi || !req.accepts('html')) {
      next();
      return;
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(nodePath.join(webRoot, 'index.html'), (error?: Error) => {
      if (error) {
        next();
      }
    });
  });
}

/** Vite emits hashed files under `assets/`; those are safe to cache forever. */
function cacheControlFor(relativePath: string): string {
  if (relativePath === 'index.html') {
    return 'no-cache';
  }
  if (relativePath.startsWith('assets/')) {
    return 'public, max-age=31536000, immutable';
  }
  return 'public, max-age=3600';
}

/** Build the fully-configured (but not yet listening) Nest application. */
export async function createHttpApp(
  options: CreateHttpAppOptions = {},
): Promise<NestExpressApplication> {
  const env: AppConfig = options.env ?? loadEnv(process.env);
  const logger =
    options.logger ?? buildLogger(env.logLevel, options.loggerStream);

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: false,
  });

  configurePlatform(app, logger);
  configureServing(app, options.webRoot ?? defaultWebRoot());
  await app.init();

  return app;
}
