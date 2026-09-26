/**
 * TKT-foundation-004 acceptance criterion 5 (one pino JSON line per request;
 * request ids differ) and arch. §8.4's "never log emails/passwords/tokens".
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { Logger } from 'pino';
import { createHttpApp } from '../../src/app.factory';
import { buildLogger } from '../../src/common/logging/logger';
import { applyTestEnv, memoryLogDestination } from './support/test-env';

const SECRET = 'Sup3r-Secret-Pw-9x';

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

describe('request logging (arch. §8.4)', () => {
  it('emits exactly one JSON line per request with the required fields', async () => {
    const before = logs.lines.length;

    await request(app.getHttpServer()).get('/api/one');
    await request(app.getHttpServer()).get('/api/two');

    const emitted = logs.lines
      .slice(before)
      .map((line) => JSON.parse(line) as Record<string, unknown>);

    expect(emitted).toHaveLength(2);
    for (const line of emitted) {
      expect(line.method).toBe('GET');
      expect(typeof line.path).toBe('string');
      expect(typeof line.status).toBe('number');
      expect(typeof line.durationMs).toBe('number');
      expect(typeof line.requestId).toBe('string');
      expect(line.requestId).not.toBe('');
      expect(line.userId).toBeNull();
    }
    expect(emitted[0]?.requestId).not.toBe(emitted[1]?.requestId);
    expect(emitted[0]?.path).toBe('/api/one');
    expect(emitted[1]?.path).toBe('/api/two');
  });

  it('never logs request bodies (passwords)', async () => {
    const before = logs.lines.length;

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ email: 'alice@test.local', password: SECRET });

    const emitted = logs.lines.slice(before).join('\n');
    expect(emitted).not.toContain(SECRET);
    expect(emitted).not.toContain('alice@test.local');
  });
});
