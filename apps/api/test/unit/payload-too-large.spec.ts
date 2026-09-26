/**
 * Review round 2, F-K-1/F-S-4 (TKT-foundation-004): a request body over
 * Express's 100 kb limit makes body-parser raise `PayloadTooLargeError`
 * (`statusCode: 413`, `type: 'entity.too.large'`) — a plain `Error`, not an
 * `HttpException` (Nest pre-wraps only body-parser `SyntaxError`s). The
 * filter must map it to `400 VALIDATION_FAILED` (03 §4 has no 413 code, and
 * malformed JSON maps the same way) — never to `500 INTERNAL` with an
 * `unhandled_exception` log, which would classify a client-input fault as a
 * server fault.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { Logger } from 'pino';
import { createHttpApp } from '../../src/app.factory';
import { buildLogger } from '../../src/common/logging/logger';
import { applyTestEnv, memoryLogDestination } from './support/test-env';

let restore: () => void;
let app: NestExpressApplication;
let logs: ReturnType<typeof memoryLogDestination>;

beforeAll(async () => {
  restore = applyTestEnv();
  logs = memoryLogDestination();
  const logger: Logger = buildLogger('info', logs.stream);
  app = await createHttpApp({ logger });
});

afterAll(async () => {
  await app.close();
  restore();
});

describe('oversized request body (body-parser 413)', () => {
  it('maps a >100 kb JSON body to 400 VALIDATION_FAILED, not a 500/unhandled fault', async () => {
    const before = logs.lines.length;
    // ~120 kb of JSON — over body-parser's default 100 kb limit.
    const body = `{"padding":"${'x'.repeat(120 * 1024)}"}`;

    const response = await request(app.getHttpServer())
      .post('/api/anything')
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Content-Type', 'application/json')
      .send(body);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Request validation failed.',
      },
    });

    // A client-input fault is never logged as an unhandled server fault.
    const emitted = logs.lines
      .slice(before)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(
      emitted.find((line) => line.msg === 'unhandled_exception'),
    ).toBeUndefined();
  });
});
