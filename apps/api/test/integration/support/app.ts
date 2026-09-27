/**
 * Integration app factory + supertest client (TKT-foundation-006; strategy §5).
 *
 * The integration level drives the **real** application in-process over HTTP:
 * `createHttpApp` wires the exact production platform (helmet, request
 * logging, CSRF middleware, validation pipe, exception filter, static
 * serving), and supertest talks to its Node http server — no port, no mock
 * (strategy §3 T2).
 *
 * Domain factories (`registerUser`, `createGroup`, `joinAndApprove`,
 * `createExpense`) are added by the domain tickets that own those routes
 * (strategy §5). This module provides only the shared plumbing.
 */
import type { Server } from 'node:http';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { DestinationStream } from 'pino';
import request from 'supertest';
import { createHttpApp } from '../../../src/app.factory';
import { buildLogger } from '../../../src/common/logging/logger';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { LoginThrottleService } from '../../../src/auth/login-throttle.service';

/**
 * Captured pino output — the log-capture testability hook (accounts-access.md
 * §2 TC-ACC-021: "app bootstrap routes pino output to a captured in-memory
 * destination"). The app logs to this stream instead of stdout, so a spec can
 * scan every emitted line for a forbidden substring (e.g. a password).
 */
export interface LogCapture {
  /** Raw JSON lines, in emission order. */
  readonly lines: string[];
  /** The destination handed to the app's pino logger. */
  readonly stream: DestinationStream;
  /** Every captured line joined with newlines, for substring scans. */
  text(): string;
  /** Drop captured lines (call between tests). */
  clear(): void;
}

function createLogCapture(): LogCapture {
  const lines: string[] = [];
  return {
    lines,
    stream: {
      write(line: string): void {
        lines.push(line);
      },
    },
    text: () => lines.join('\n'),
    clear: () => {
      lines.length = 0;
    },
  };
}

/** Options for {@link createIntegrationApp}. */
export interface CreateIntegrationAppOptions {
  /**
   * pino level for the captured logger. Defaults to the ambient `LOG_LEVEL`
   * (`setup-env.ts` pins `error` so output stays lean); TC-ACC-021 passes
   * `info` so the request-logging lines it scans are actually emitted.
   */
  logLevel?: string;
}

/** A booted integration app plus the handles specs need. */
export interface IntegrationApp {
  /** The fully-configured Nest app (close it in `afterAll`). */
  readonly app: NestExpressApplication;
  /** The app's single Prisma client (truncate between tests). */
  readonly prisma: PrismaService;
  /** The Node http server supertest drives. */
  readonly server: Server;
  /**
   * Every pino line the app emitted, captured in memory (TC-ACC-021). The
   * destination is wired at boot; never written to stdout.
   */
  readonly logs: LogCapture;
  /**
   * Reset C2's in-memory login-throttle counters (accounts-access.md §2
   * conventions: the required auth-module testability hook). The counters are
   * not database state, so truncation alone would leak (email, IP) keys across
   * tests; every spec that exercises login calls this in `beforeEach`.
   */
  resetLoginThrottle(): void;
}

/**
 * Boot the real app against the ambient `DATABASE_URL` (validated by
 * `global-setup.ts`). Call once per spec file in `beforeAll` and close the app
 * in `afterAll`.
 *
 * pino output is always captured in memory (the log-capture testability hook)
 * rather than written to stdout, so specs can assert on it.
 */
export async function createIntegrationApp(
  options: CreateIntegrationAppOptions = {},
): Promise<IntegrationApp> {
  const logs = createLogCapture();
  const logger = buildLogger(
    options.logLevel ?? process.env.LOG_LEVEL ?? 'info',
    logs.stream,
  );
  const app = await createHttpApp({ logger });
  const prisma = app.get(PrismaService);
  const throttle = app.get(LoginThrottleService);
  return {
    app,
    prisma,
    server: app.getHttpServer() as Server,
    logs,
    resetLoginThrottle: () => throttle.reset(),
  };
}

/**
 * Every state-changing request must carry this header (03-api-design.md §1,
 * arch. §8.2). Exported so domain specs share one literal.
 */
export const CSRF_HEADERS = { 'X-Requested-With': 'XMLHttpRequest' } as const;

/** Supertest bound to the integration server (thin, intentional alias). */
export function api(server: Server) {
  return request(server);
}
