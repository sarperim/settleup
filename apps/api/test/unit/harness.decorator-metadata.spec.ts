/**
 * Pins that the Vitest harness emits decorator metadata (SWC transform in
 * vitest.config.ts, acceptance F-1 fix). If this fails with a 500/201 instead
 * of 400, the SWC plugin was removed or misconfigured — do NOT hand-inject
 * metadata, do NOT debug the validation pipe.
 *
 * This spec deliberately mirrors `tc-foundation-004-a3-validation-internal`'s
 * scratch Nest module (no DATABASE_URL, no production routes) but WITHOUT the
 * `Reflect.defineMetadata('design:paramtypes', …)` hand-injection that the
 * a3 spec needed before the harness fix. Its 400 depends entirely on
 * `emitDecoratorMetadata` reaching Vitest's compiler.
 */
import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Body, Controller, Module, Post } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { IsInt, IsNotEmpty, IsString } from 'class-validator';
import request from 'supertest';
import type { Logger } from 'pino';
import { configurePlatform } from '../../src/app.factory';
import { buildLogger } from '../../src/common/logging/logger';
import { applyTestEnv, memoryLogDestination } from './support/test-env';

class PinDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsInt()
  age!: number;
}

@Controller('harness-pin')
class PinController {
  @Post()
  create(@Body() dto: PinDto): { ok: boolean; name: string } {
    return { ok: true, name: dto.name };
  }
}

@Module({ controllers: [PinController] })
class PinModule {}

const CSRF_HEADER = { 'X-Requested-With': 'XMLHttpRequest' };

let restore: () => void;
let app: NestExpressApplication;

beforeAll(async () => {
  restore = applyTestEnv();
  const logger: Logger = buildLogger('error', memoryLogDestination().stream);

  app = await NestFactory.create<NestExpressApplication>(PinModule, {
    logger: false,
  });
  configurePlatform(app, logger);
  await app.init();
});

afterAll(async () => {
  await app.close();
  restore();
});

describe('Vitest harness emits decorator metadata (F-1)', () => {
  it('rejects an invalid DTO with 400 VALIDATION_FAILED in the §4 envelope', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/harness-pin')
      .set(CSRF_HEADER)
      .send({ age: 'not-a-number' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
    expect(Object.keys(response.body)).toEqual(['error']);
    expect(response.body.error.details.fields).toContain('name');
    expect(response.body.error.details.fields).toContain('age');
  });

  it('accepts a valid DTO payload (mechanism does not over-reject)', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/harness-pin')
      .set(CSRF_HEADER)
      .send({ name: 'Alice', age: 30 });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ ok: true, name: 'Alice' });
  });
});
