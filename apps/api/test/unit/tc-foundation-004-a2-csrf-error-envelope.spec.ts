/**
 * TKT-foundation-004 acceptance criteria 2 and 3 (CSRF + error envelope).
 *
 * Traces to: 03-api-design.md §1 (CSRF), §4 (error contract),
 * 01-system-architecture.md §8.2/§8.3.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { createHttpApp } from '../../src/app.factory';
import { applyTestEnv } from './support/test-env';

const CSRF_HEADER = { 'X-Requested-With': 'XMLHttpRequest' };

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

describe('CSRF middleware (arch. §8.2)', () => {
  it.each(['post', 'patch', 'delete'] as const)(
    'rejects a state-changing %s without X-Requested-With before routing',
    async (method) => {
      const response = await request(app.getHttpServer())[method](
        '/api/anything',
      ).send({});

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        error: {
          code: 'CSRF_HEADER_MISSING',
          message: 'Missing X-Requested-With header.',
        },
      });
    },
  );

  it('lets a state-changing request with the header through to routing (unknown path → 404)', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/anything')
      .set(CSRF_HEADER)
      .send({});

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'Not found.' },
    });
  });

  it('does not apply to safe methods', async () => {
    const response = await request(app.getHttpServer()).get('/api/anything');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});

describe('error envelope (03 §4)', () => {
  it('has exactly the §4 shape and no stack trace on an unknown route', async () => {
    const response = await request(app.getHttpServer()).get('/api/does-not-exist');

    expect(response.status).toBe(404);
    expect(Object.keys(response.body)).toEqual(['error']);
    expect(Object.keys(response.body.error).sort()).toEqual(['code', 'message']);
    expect(typeof response.body.error.code).toBe('string');
    expect(typeof response.body.error.message).toBe('string');
    expect(response.text).not.toContain('at ');
    expect(response.text).not.toMatch(/stack/i);
  });

  it('reports the CSRF rejection in the same envelope', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/anything')
      .send({});

    expect(Object.keys(response.body)).toEqual(['error']);
    expect(response.body.error.code).toBe('CSRF_HEADER_MISSING');
  });
});
