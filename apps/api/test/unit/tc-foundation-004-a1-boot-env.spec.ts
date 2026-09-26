/**
 * TKT-foundation-004 acceptance criterion 1 (boot / fail-fast env validation).
 *
 * Traces to: 01-system-architecture.md §8.5, arch. §7 (defaults).
 */
import { afterEach, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { bootstrap } from '../../src/bootstrap';
import { EnvValidationError, loadEnv } from '../../src/config/env';
import {
  applyTestEnv,
  getFreePort,
  TEST_DATABASE_URL,
} from './support/test-env';

describe('env validation (arch. §8.5)', () => {
  it('fails fast, naming every missing required variable, when booting without env', () => {
    const env: NodeJS.ProcessEnv = {
      LOG_LEVEL: 'info',
      COOKIE_SECURE: 'true',
    };

    let thrown: unknown;
    try {
      loadEnv(env);
    } catch (error: unknown) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(EnvValidationError);
    const error = thrown as EnvValidationError;
    expect(error.problems.join('\n')).toContain('DATABASE_URL');
    expect(error.problems.join('\n')).toContain('PORT');
  });

  it('applies the architecture-pinned defaults for optional variables', () => {
    const config = loadEnv({ DATABASE_URL: TEST_DATABASE_URL, PORT: '3007' });

    expect(config).toEqual({
      databaseUrl: TEST_DATABASE_URL,
      port: 3007,
      logLevel: 'info',
      argon2: { memoryCost: 19456, timeCost: 2, parallelism: 1 },
      cookieSecure: true,
    });
  });

  it.each([
    ['PORT', { DATABASE_URL: TEST_DATABASE_URL, PORT: 'not-a-number' }],
    ['PORT', { DATABASE_URL: TEST_DATABASE_URL, PORT: '70000' }],
    // Review round 2, F-K-3: numeric-literal forms are malformed env values —
    // `Number()` would accept them ('0x50' boots on port 80, '1e3' on 1000).
    ['PORT', { DATABASE_URL: TEST_DATABASE_URL, PORT: '0x50' }],
    ['PORT', { DATABASE_URL: TEST_DATABASE_URL, PORT: '1e3' }],
    [
      'ARGON2_MEMORY_COST',
      {
        DATABASE_URL: TEST_DATABASE_URL,
        PORT: '3007',
        ARGON2_MEMORY_COST: '0x10',
      },
    ],
    [
      'ARGON2_PARALLELISM',
      {
        DATABASE_URL: TEST_DATABASE_URL,
        PORT: '3007',
        ARGON2_PARALLELISM: '1e2',
      },
    ],
    ['LOG_LEVEL', { DATABASE_URL: TEST_DATABASE_URL, PORT: '3007', LOG_LEVEL: 'shouty' }],
    ['ARGON2_MEMORY_COST', { DATABASE_URL: TEST_DATABASE_URL, PORT: '3007', ARGON2_MEMORY_COST: '-1' }],
    ['COOKIE_SECURE', { DATABASE_URL: TEST_DATABASE_URL, PORT: '3007', COOKIE_SECURE: 'maybe' }],
  ])('rejects a malformed %s', (variable, env) => {
    expect(() => loadEnv(env)).toThrowError(EnvValidationError);
    try {
      loadEnv(env);
    } catch (error: unknown) {
      expect((error as EnvValidationError).problems.join('\n')).toContain(
        variable,
      );
    }
  });
});

describe('boot (acceptance criterion 1)', () => {
  let restore: () => void = () => {};
  let app: Awaited<ReturnType<typeof bootstrap>> | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
    restore();
  });

  it('exits the boot path (throws) when a required env var is missing', async () => {
    restore = applyTestEnv({ DATABASE_URL: undefined, PORT: undefined });

    await expect(bootstrap()).rejects.toBeInstanceOf(EnvValidationError);
  });

  it('listens on the configured PORT with valid env', async () => {
    const port = await getFreePort();
    restore = applyTestEnv({ PORT: String(port) });

    app = await bootstrap();

    const address = app.getHttpServer().address() as AddressInfo;
    expect(address.port).toBe(port);
  });
});
