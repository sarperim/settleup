/**
 * Shared test support for the platform acceptance specs
 * (TKT-foundation-004). Not a `*.spec.ts` file, so Vitest does not collect it
 * as a suite.
 */
import net from 'node:net';

/**
 * A syntactically valid but unreachable URL: the platform tests never query a
 * database (Prisma connects lazily), they only need env validation to pass.
 */
export const TEST_DATABASE_URL =
  'postgresql://settleup:settleup@127.0.0.1:5432/settleup_test';

export interface EnvOverrides {
  [key: string]: string | undefined;
}

/**
 * Apply the baseline test env plus overrides. Returns a restore function so a
 * spec can leave `process.env` exactly as it found it.
 */
export function applyTestEnv(overrides: EnvOverrides = {}): () => void {
  const snapshot: NodeJS.ProcessEnv = { ...process.env };
  const baseline: EnvOverrides = {
    DATABASE_URL: TEST_DATABASE_URL,
    PORT: '3999',
    LOG_LEVEL: 'error',
    COOKIE_SECURE: 'true',
  };
  for (const [key, value] of Object.entries({ ...baseline, ...overrides })) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  return () => {
    process.env = snapshot;
  };
}

/** Ask the OS for a free TCP port (closed immediately, then handed out). */
export function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port =
        address && typeof address === 'object' ? address.port : undefined;
      server.close(() => {
        if (port === undefined) {
          reject(new Error('could not determine a free port'));
        } else {
          resolve(port);
        }
      });
    });
  });
}

/** Minimal in-memory pino destination for asserting on emitted log lines. */
export function memoryLogDestination() {
  const lines: string[] = [];
  return {
    lines,
    stream: {
      write(line: string): void {
        lines.push(line);
      },
    },
  };
}
