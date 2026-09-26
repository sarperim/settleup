/**
 * Environment validation (TKT-foundation-004; 01-system-architecture.md §8.5).
 *
 * Env is validated once, at boot, and the process **fails fast** (non-zero
 * exit) when a required variable is missing or malformed. Required variables
 * have **no defaults**: `DATABASE_URL`, `PORT`. Everything else carries the
 * architecture-pinned default (§7/§8.5):
 *
 *   - `LOG_LEVEL`       → `info`
 *   - `ARGON2_MEMORY_COST` / `ARGON2_TIME_COST` / `ARGON2_PARALLELISM`
 *                       → `19456` / `2` / `1` (NFR-ACC-001)
 *   - `COOKIE_SECURE`   → `true`
 *
 * The validated shape is provided application-wide via `APP_CONFIG`
 * (`config.module.ts`); nothing downstream reads raw `process.env` for these
 * values.
 */

/** pino levels, accepted for `LOG_LEVEL` (architecture §8.4). */
export const LOG_LEVELS = [
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'fatal',
] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

/** Argon2id parameters (NFR-ACC-001 / architecture §7). */
export interface Argon2Config {
  readonly memoryCost: number;
  readonly timeCost: number;
  readonly parallelism: number;
}

/** The validated application configuration. */
export interface AppConfig {
  readonly databaseUrl: string;
  readonly port: number;
  readonly logLevel: LogLevel;
  readonly argon2: Argon2Config;
  readonly cookieSecure: boolean;
}

/** Thrown by {@link loadEnv} when the environment is not bootable. */
export class EnvValidationError extends Error {
  public readonly problems: readonly string[];

  constructor(problems: readonly string[]) {
    super(
      `Invalid environment configuration:\n${problems
        .map((problem) => `  - ${problem}`)
        .join('\n')}`,
    );
    this.name = 'EnvValidationError';
    this.problems = problems;
  }
}

const ARGON2_DEFAULTS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

/**
 * Validate `source` (defaults to `process.env`) and return the typed config.
 *
 * @throws {EnvValidationError} listing every missing/malformed variable — all
 *   problems are reported at once so a misconfigured boot is fixed in one pass.
 */
export function loadEnv(
  source: NodeJS.ProcessEnv = process.env,
): AppConfig {
  const problems: string[] = [];

  const databaseUrl = readString(source.DATABASE_URL);
  if (databaseUrl === undefined) {
    problems.push('missing required variable DATABASE_URL');
  }

  const port = readPort(source.PORT, problems);

  const logLevel = readLogLevel(source.LOG_LEVEL, problems);

  const argon2: Argon2Config = {
    memoryCost: readPositiveInt(
      source.ARGON2_MEMORY_COST,
      'ARGON2_MEMORY_COST',
      ARGON2_DEFAULTS.memoryCost,
      problems,
    ),
    timeCost: readPositiveInt(
      source.ARGON2_TIME_COST,
      'ARGON2_TIME_COST',
      ARGON2_DEFAULTS.timeCost,
      problems,
    ),
    parallelism: readPositiveInt(
      source.ARGON2_PARALLELISM,
      'ARGON2_PARALLELISM',
      ARGON2_DEFAULTS.parallelism,
      problems,
    ),
  };

  const cookieSecure = readBoolean(source.COOKIE_SECURE, true, problems);

  if (problems.length > 0) {
    throw new EnvValidationError(problems);
  }

  return {
    // Narrowed by the `problems.length` guard above.
    databaseUrl: databaseUrl as string,
    port: port as number,
    logLevel: logLevel as LogLevel,
    argon2,
    cookieSecure,
  };
}

function readString(raw: string | undefined): string | undefined {
  const value = raw?.trim();
  return value && value.length > 0 ? value : undefined;
}

function readPort(
  raw: string | undefined,
  problems: string[],
): number | undefined {
  const value = readString(raw);
  if (value === undefined) {
    problems.push('missing required variable PORT');
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    problems.push(`PORT must be an integer between 1 and 65535 (got "${value}")`);
    return undefined;
  }
  return parsed;
}

function readLogLevel(
  raw: string | undefined,
  problems: string[],
): LogLevel | undefined {
  const value = readString(raw);
  if (value === undefined) {
    return 'info';
  }
  if (!(LOG_LEVELS as readonly string[]).includes(value)) {
    problems.push(
      `LOG_LEVEL must be one of ${LOG_LEVELS.join(', ')} (got "${value}")`,
    );
    return undefined;
  }
  return value as LogLevel;
}

function readPositiveInt(
  raw: string | undefined,
  name: string,
  fallback: number,
  problems: string[],
): number {
  const value = readString(raw);
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    problems.push(`${name} must be a positive integer (got "${value}")`);
    return fallback;
  }
  return parsed;
}

function readBoolean(
  raw: string | undefined,
  fallback: boolean,
  problems: string[],
): boolean {
  const value = readString(raw)?.toLowerCase();
  if (value === undefined) {
    return fallback;
  }
  if (value === 'true' || value === '1' || value === 'yes') {
    return true;
  }
  if (value === 'false' || value === '0' || value === 'no') {
    return false;
  }
  problems.push(`COOKIE_SECURE must be a boolean (got "${value}")`);
  return fallback;
}
