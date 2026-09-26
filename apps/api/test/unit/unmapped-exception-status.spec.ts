/**
 * Review round 1, F-2 (TKT-foundation-004): a non-`AppError` `HttpException`
 * whose status has no §4 mapping — here a bare Nest `ForbiddenException` —
 * must respond `500 INTERNAL` (never `<original status> + INTERNAL`, a
 * pairing absent from the 03-api-design.md §4 table), and the original
 * status is logged server-side.
 */
import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Controller, ForbiddenException, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { Logger } from 'pino';
import { configurePlatform } from '../../src/app.factory';
import { buildLogger } from '../../src/common/logging/logger';
import { applyTestEnv, memoryLogDestination } from './support/test-env';

@Controller('probe')
class ProbeController {
  @Get('forbidden')
  forbidden(): never {
    throw new ForbiddenException();
  }
}

@Module({ controllers: [ProbeController] })
class ProbeModule {}

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

describe('unmapped HttpException status folds to 500 INTERNAL (03 §4)', () => {
  it('responds with the exact 500 INTERNAL envelope and logs the original status', async () => {
    const before = logs.lines.length;

    const response = await request(app.getHttpServer()).get(
      '/api/probe/forbidden',
    );

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: {
        code: 'INTERNAL',
        message: 'An unexpected error occurred.',
      },
    });
    expect(response.text).not.toContain('Forbidden');

    const emitted = logs.lines.slice(before).map((line) => JSON.parse(line));
    const fault = emitted.find((line) => line.msg === 'unhandled_exception');
    expect(fault).toBeDefined();
    expect(fault.unmappedStatus).toBe(403);
  });
});
