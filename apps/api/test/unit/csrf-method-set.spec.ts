/**
 * Review round 1, F-4 (TKT-foundation-004): pins the CSRF middleware's exact
 * state-changing method set (POST/PATCH/DELETE — the allowlist pinned by
 * 03-api-design.md §1 / 01-system-architecture.md §8.2 and the ticket
 * scope). Deny-by-default is an open architect question (routed as U-E);
 * until it is decided, extending or narrowing this set must be a visible
 * decision that updates this spec together with the middleware — a later
 * ticket adding, say, a PUT route gets no CSRF protection today.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { createHttpApp } from '../../src/app.factory';
import { applyTestEnv } from './support/test-env';

let restore: () => void;
let app: NestExpressApplication;

beforeAll(async () => {
  restore = applyTestEnv();
  app = await createHttpApp();
});

afterAll(async () => {
  await app.close();
  restore();
});

describe('CSRF state-changing method set (arch. §8.2, 03 §1)', () => {
  it.each(['post', 'patch', 'delete'] as const)(
    'requires X-Requested-With on %s (rejected before routing)',
    async (method) => {
      const response = await request(app.getHttpServer())[method](
        '/api/anything',
      ).send({});

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('CSRF_HEADER_MISSING');
    },
  );

  it.each(['get', 'head', 'options', 'put'] as const)(
    'does not require X-Requested-With on %s (reaches routing)',
    async (method) => {
      const response = await request(app.getHttpServer())[method](
        '/api/anything',
      );

      expect(response.status).toBe(404);
      // Exact envelope (review round 2, F-C-5): the previous
      // `error?.code ?? 'NOT_FOUND'` silently passed a regressed
      // string-shaped 404 body.
      expect(response.body).toEqual({
        error: { code: 'NOT_FOUND', message: 'Not found.' },
      });
    },
  );
});
