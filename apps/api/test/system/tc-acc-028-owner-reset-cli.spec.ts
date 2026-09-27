/**
 * TC-ACC-028 — Owner password-reset CLI sets a new working password and clears
 * all sessions (accounts-access.md §2; UC-ACC-005 automatable steps 3+5,
 * BR-ACC-007, 01-system-architecture.md §10 runbook amended 2026-09-25,
 * D-ARCH-002 CLI analogue, OQ-ACC-001).
 *
 * Level: **system** — runs in the e2e phase (`pnpm test:e2e`), post-build,
 * against `E2E_DATABASE_URL`. It drives the built artifact
 * (`apps/api/dist/scripts/set-password.js`) as a child process with the new
 * password supplied on **piped stdin**, then asserts the observable contract
 * over the in-process app: the new password authenticates, the old one is dead,
 * and every pre-existing session row for the account is gone.
 *
 * Precondition: `pnpm build` has produced `apps/api/dist/scripts/set-password.js`.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  api,
  createIntegrationApp,
  CSRF_HEADERS,
  type IntegrationApp,
} from '../integration/support/app';
import { truncateAllTables } from '../integration/support/truncate';
import {
  registerUser,
  sessionCookiePair,
  TEST_PASSWORD,
} from '../integration/support/factories';

const CLI_PASSWORD = 'password-cli-1';
const API_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);
const CLI_PATH = path.join(API_DIR, 'dist', 'scripts', 'set-password.js');

interface CliResult {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

/** Run the built CLI with `input` piped to its stdin, resolving on exit. */
function runSetPasswordCli(email: string, input: string): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI_PATH, email], {
      cwd: API_DIR,
      env: { ...process.env },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(input);
  });
}

let ctx: IntegrationApp;

beforeAll(async () => {
  ctx = await createIntegrationApp();
});

afterAll(async () => {
  if (ctx) {
    await ctx.app.close();
  }
});

beforeEach(async () => {
  await truncateAllTables(ctx.prisma);
  ctx.resetLoginThrottle();
});

describe('TC-ACC-028 — owner password-reset CLI', () => {
  it('accepts the new password via piped stdin, exits 0, and clears all sessions', async () => {
    // Precondition: the built artifact must exist (run `pnpm build` first).
    expect(existsSync(CLI_PATH)).toBe(true);

    const alice = await registerUser(
      ctx.server,
      'alice@test.local',
      TEST_PASSWORD,
      'Alice',
    );

    // Alice holds a valid session obtained via login with the old password.
    const login = await api(ctx.server)
      .post('/api/auth/login')
      .set(CSRF_HEADERS)
      .send({ email: 'alice@test.local', password: TEST_PASSWORD });
    expect(login.status).toBe(200);
    const preCliCookie = sessionCookiePair(login.headers['set-cookie']);

    const beforeCli = await api(ctx.server)
      .get('/api/auth/me')
      .set('Cookie', preCliCookie);
    expect(beforeCli.status).toBe(200);

    // Step 1: run the CLI, supplying the new password via non-interactive stdin.
    const cli = await runSetPasswordCli(
      'alice@test.local',
      `${CLI_PASSWORD}\n`,
    );
    expect(cli.stderr).toBe('');
    expect(cli.code).toBe(0);

    // The CLI deleted every session row for the account in the same operation.
    const remainingSessions = await ctx.prisma.session.count({
      where: { userId: alice.id },
    });
    expect(remainingSessions).toBe(0);

    // Step 2: the CLI-set password authenticates.
    const newLogin = await api(ctx.server)
      .post('/api/auth/login')
      .set(CSRF_HEADERS)
      .send({ email: 'alice@test.local', password: CLI_PASSWORD });
    expect(newLogin.status).toBe(200);
    expect(newLogin.body.user.id).toBe(alice.id);

    // Step 3: the old password is dead.
    const oldLogin = await api(ctx.server)
      .post('/api/auth/login')
      .set(CSRF_HEADERS)
      .send({ email: 'alice@test.local', password: TEST_PASSWORD });
    expect(oldLogin.status).toBe(401);
    expect(oldLogin.body.error.code).toBe('INVALID_CREDENTIALS');

    // Step 4: no session survives the owner-initiated reset.
    const me = await api(ctx.server)
      .get('/api/auth/me')
      .set('Cookie', preCliCookie);
    expect(me.status).toBe(401);
    expect(me.body.error.code).toBe('UNAUTHENTICATED');
  });
});
