/**
 * TKT-foundation-004 acceptance criterion 3 (error contract incl. a
 * validation-failing probe DTO) and criterion 5's 500-with-request-id logging.
 *
 * Uses a scratch Nest module so the platform's exact global pipe/filter are
 * exercised without adding probe routes to the production API.
 */
import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Body, Controller, Get, Module, Post } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { IsInt, IsNotEmpty, IsString } from 'class-validator';
import request from 'supertest';
import type { Logger } from 'pino';
import { configurePlatform } from '../../src/app.factory';
import { buildLogger } from '../../src/common/logging/logger';
import { applyTestEnv, memoryLogDestination } from './support/test-env';

class ProbeDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsInt()
  age!: number;
}

@Controller('probe')
class ProbeController {
  @Post()
  create(@Body() dto: ProbeDto): { ok: boolean; name: string } {
    return { ok: true, name: dto.name };
  }

  @Get('boom')
  boom(): never {
    throw new Error('secret internal detail');
  }
}

@Module({ controllers: [ProbeController] })
class ProbeModule {}

/**
 * The Vitest harness now emits decorator metadata via the SWC transform in
 * `vitest.config.ts` (acceptance F-1 fix, 2026-09-27; closes TKT-foundation-004
 * FLAG-3). This spec previously hand-injected `design:paramtypes` because
 * esbuild does not emit it; that workaround is gone, so this spec exercises the
 * real global ValidationPipe over compiler-emitted metadata exactly as
 * production `nest build` (tsc) does. The gap is separately pinned by
 * `harness.decorator-metadata.spec.ts`.
 */
const CSRF_HEADER = { 'X-Requested-With': 'XMLHttpRequest' };

let restore: () => void;
let app: NestExpressApplication;
let logs: ReturnType<typeof memoryLogDestination>;

beforeAll(async () => {
  restore = applyTestEnv();
  logs = memoryLogDestination();
  const logger: Logger = buildLogger('error', logs.stream);

  app = await NestFactory.create<NestExpressApplication>(ProbeModule, {
    logger: false,
  });
  configurePlatform(app, logger);
  await app.init();
});

afterAll(async () => {
  await app.close();
  restore();
});

describe('validation pipe + error contract (03 §4)', () => {
  it('returns 400 VALIDATION_FAILED listing the offending fields', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/probe')
      .set(CSRF_HEADER)
      .send({ age: 'not-a-number' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
    expect(Object.keys(response.body)).toEqual(['error']);
    expect(response.body.error.details.fields).toContain('name');
    expect(response.body.error.details.fields).toContain('age');
  });

  it('accepts a valid probe payload (mechanism does not over-reject)', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/probe')
      .set(CSRF_HEADER)
      .send({ name: 'Alice', age: 30 });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ ok: true, name: 'Alice' });
  });
});

describe('unexpected fault (03 §4 INTERNAL)', () => {
  it('returns a generic 500 envelope and logs the request id, never the internals', async () => {
    const before = logs.lines.length;

    const response = await request(app.getHttpServer()).get('/api/probe/boom');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: {
        code: 'INTERNAL',
        message: 'An unexpected error occurred.',
      },
    });
    expect(response.text).not.toContain('secret internal detail');

    const emitted = logs.lines.slice(before).map((line) => JSON.parse(line));
    const fault = emitted.find((line) => line.msg === 'unhandled_exception');
    expect(fault).toBeDefined();
    expect(typeof fault.requestId).toBe('string');
    expect(fault.requestId.length).toBeGreaterThan(0);
  });
});
