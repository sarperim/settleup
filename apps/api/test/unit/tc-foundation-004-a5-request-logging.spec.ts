/**
 * TKT-foundation-004 acceptance criterion 5 (one pino JSON line per request;
 * request ids differ) and arch. §8.4's "never log emails/passwords/tokens".
 */
import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Controller, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { Logger } from 'pino';
import { configurePlatform, createHttpApp } from '../../src/app.factory';
import { buildLogger } from '../../src/common/logging/logger';
import { applyTestEnv, memoryLogDestination } from './support/test-env';

const SECRET = 'Sup3r-Secret-Pw-9x';
const QUERY_SECRET = 'qu3ry-Secret-Tok3n-7q';
const JOIN_CODE = 'JOIN-CODE-4x';

/**
 * Scratch module for the fault-path logging pin (review round 2, F-S-1): the
 * production `AppModule` has no route that faults, so a probe route exercises
 * the same platform wiring (`configurePlatform`) the acceptance specs use.
 */
@Controller('probe')
class ProbeController {
  @Get('boom')
  boom(): never {
    throw new Error('probe fault');
  }
}

@Module({ controllers: [ProbeController] })
class ProbeModule {}

let restore: () => void;
let app: NestExpressApplication;
let logs: ReturnType<typeof memoryLogDestination>;
let faultApp: NestExpressApplication;
let faultLogs: ReturnType<typeof memoryLogDestination>;

beforeAll(async () => {
  restore = applyTestEnv();
  logs = memoryLogDestination();
  const logger: Logger = buildLogger('info', logs.stream);
  app = await createHttpApp({ logger });

  faultLogs = memoryLogDestination();
  faultApp = await NestFactory.create<NestExpressApplication>(ProbeModule, {
    logger: false,
  });
  configurePlatform(faultApp, buildLogger('info', faultLogs.stream));
  await faultApp.init();
});

afterAll(async () => {
  await app.close();
  await faultApp.close();
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

  it('strips the query string from every log line of a faulted request (round 2, F-S-1)', async () => {
    const before = faultLogs.lines.length;

    const response = await request(faultApp.getHttpServer()).get(
      `/api/probe/boom?token=${QUERY_SECRET}&code=${JOIN_CODE}`,
    );

    // Sanity: the probe route faults and is folded to the generic 500.
    expect(response.status).toBe(500);

    const emitted = faultLogs.lines
      .slice(before)
      .map((line) => JSON.parse(line) as Record<string, unknown>);

    const requestLine = emitted.find((line) => line.msg === 'request');
    const errorLine = emitted.find((line) => line.msg === 'unhandled_exception');
    expect(requestLine).toBeDefined();
    expect(errorLine).toBeDefined();

    // BOTH lines — the request log and the unhandled-exception log — carry
    // the path without the query string (arch. §8.4: a query param may carry
    // a secret, e.g. a join code — NFR-GRP-005).
    expect(requestLine?.path).toBe('/api/probe/boom');
    expect(errorLine?.path).toBe('/api/probe/boom');

    const everything = faultLogs.lines.slice(before).join('\n');
    expect(everything).not.toContain(QUERY_SECRET);
    expect(everything).not.toContain(JOIN_CODE);
  });
});

describe('logger redaction (arch. §8.4, defense-in-depth; round 2, F-S-6)', () => {
  it('censors secret-shaped keys at the sink, top level and one level deep', () => {
    const sink = memoryLogDestination();
    const logger = buildLogger('info', sink.stream);

    logger.info(
      {
        password: SECRET,
        email: 'alice@test.local',
        token: 'session-token-value',
        authorization: 'Bearer some-token',
        settleup_session: 'cookie-value',
        nested: { password: SECRET, email: 'alice@test.local' },
        kept: 'not-a-secret',
      },
      'redaction_probe',
    );

    const line = JSON.parse(sink.lines[0] ?? '{}') as Record<
      string,
      unknown & { nested?: Record<string, unknown> }
    >;
    expect(line.password).toBe('[redacted]');
    expect(line.email).toBe('[redacted]');
    expect(line.token).toBe('[redacted]');
    expect(line.authorization).toBe('[redacted]');
    expect(line.settleup_session).toBe('[redacted]');
    expect(line.nested?.password).toBe('[redacted]');
    expect(line.nested?.email).toBe('[redacted]');
    expect(line.kept).toBe('not-a-secret');
    expect(JSON.stringify(line)).not.toContain(SECRET);
    expect(JSON.stringify(line)).not.toContain('alice@test.local');
  });
});
