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
import request from 'supertest';
import { createHttpApp } from '../../../src/app.factory';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { LoginThrottleService } from '../../../src/auth/login-throttle.service';

/** A booted integration app plus the handles specs need. */
export interface IntegrationApp {
  /** The fully-configured Nest app (close it in `afterAll`). */
  readonly app: NestExpressApplication;
  /** The app's single Prisma client (truncate between tests). */
  readonly prisma: PrismaService;
  /** The Node http server supertest drives. */
  readonly server: Server;
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
 */
export async function createIntegrationApp(): Promise<IntegrationApp> {
  const app = await createHttpApp();
  const prisma = app.get(PrismaService);
  const throttle = app.get(LoginThrottleService);
  return {
    app,
    prisma,
    server: app.getHttpServer() as Server,
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
