/**
 * Review round 1, F-2 (TKT-foundation-004): a non-`AppError` `HttpException`
 * whose status has no §4 mapping — here a bare Nest `ForbiddenException` —
 * must respond `500 INTERNAL` (never `<original status> + INTERNAL`, a
 * pairing absent from the 03-api-design.md §4 table), and the original
 * status is logged server-side.
 *
 * Review round 2, F-K-5: the *mapped* switch arms of the filter's
 * `mapStatus` (401 → UNAUTHENTICATED, 429 → TOO_MANY_ATTEMPTS) are pinned
 * here too — previously only 404 and the default branch had regression
 * coverage, so a broken switch arm would not fail CI.
 */
import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  Controller,
  ForbiddenException,
  Get,
  HttpException,
  HttpStatus,
  Module,
  UnauthorizedException,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { Logger } from 'pino';
import { configurePlatform } from '../../src/app.factory';
import { buildLogger } from '../../src/common/logging/logger';
import { DEFAULT_MESSAGES } from '../../src/common/errors/error-contract';
import { applyTestEnv, memoryLogDestination } from './support/test-env';

@Controller('probe')
class ProbeController {
  @Get('forbidden')
  forbidden(): never {
    throw new ForbiddenException();
  }

  @Get('unauthenticated')
  unauthenticated(): never {
    throw new UnauthorizedException();
  }

  @Get('rate-limited')
  rateLimited(): never {
    throw new HttpException('original message', HttpStatus.TOO_MANY_REQUESTS);
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

describe('mapped HttpException statuses keep their §4 code (round 2, F-K-5)', () => {
  it.each([
    { route: 'unauthenticated', status: 401, code: 'UNAUTHENTICATED' },
    { route: 'rate-limited', status: 429, code: 'TOO_MANY_ATTEMPTS' },
  ])('maps $status to $code with the generic §4 message', async ({ route, status, code }) => {
    const before = logs.lines.length;

    const response = await request(app.getHttpServer()).get(
      `/api/probe/${route}`,
    );

    expect(response.status).toBe(status);
    // The framework exception's own message is replaced by the §4 default —
    // nothing from the thrown exception reaches the response.
    expect(response.body).toEqual({
      error: { code, message: DEFAULT_MESSAGES[code] },
    });

    // A mapped status is a client-input fault: never logged as unhandled.
    const emitted = logs.lines.slice(before).map((line) => JSON.parse(line));
    expect(emitted.find((line) => line.msg === 'unhandled_exception')).toBeUndefined();
  });
});
