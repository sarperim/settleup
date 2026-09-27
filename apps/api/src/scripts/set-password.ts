/**
 * Owner password-reset CLI (TKT-accounts-003; UC-ACC-005 automatable path,
 * BR-ACC-007, 01-system-architecture.md §10 runbook — amended 2026-09-25).
 *
 * Usage (from `apps/api`, after `pnpm build`):
 *
 *   node dist/scripts/set-password.js <email>
 *
 * The new password is read from **stdin** and works non-interactively when
 * piped (`echo "new-password" | node dist/scripts/set-password.js alice@…`),
 * the testability requirement recorded by TC-ACC-028. The script writes an
 * Argon2id hash directly to the database and, in the same transaction, deletes
 * **all** of the account's session rows: the CLI has no acting session, so an
 * owner-initiated reset (the suspected-compromise / forgotten-password recovery
 * path) must leave no session alive — every existing session is an "other"
 * session under D-ARCH-002's compromise rationale (arch. §10).
 *
 * There is deliberately no HTTP surface and no in-app admin role
 * (OQ-ACC-001: performed outside the application). Emails and passwords are
 * never logged (arch. §8.4).
 */
import { PrismaClient } from '@prisma/client';
import { loadEnv } from '../config/env';
import { hashPassword } from '../auth/password';

/** Password policy (D-ARCH-003): min 8, max 128, no composition rules. */
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

function fail(message: string): void {
  process.stderr.write(`set-password: ${message}\n`);
  process.exitCode = 1;
}

/** Read the whole of stdin (piped input terminates at EOF). */
async function readAllStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
  }
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * Normalize the piped password: strip exactly one trailing newline (so
 * `echo "pw" | …` and a bare `printf 'pw'` behave identically) while
 * preserving any other characters verbatim.
 */
function stripTrailingNewline(raw: string): string {
  return raw.replace(/\r?\n$/, '');
}

async function main(): Promise<void> {
  const emailArg = process.argv[2];
  if (emailArg === undefined || emailArg.trim().length === 0) {
    fail('usage: node dist/scripts/set-password.js <email> (new password on stdin)');
    return;
  }
  const email = emailArg.trim().toLowerCase();

  const password = stripTrailingNewline(await readAllStdin());
  if (
    password.length < PASSWORD_MIN_LENGTH ||
    password.length > PASSWORD_MAX_LENGTH
  ) {
    fail(
      `the new password must be ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} characters`,
    );
    return;
  }

  // `loadEnv` validates DATABASE_URL and applies the pinned Argon2id defaults
  // (arch. §7/§8.5). The CLI never listens, so a placeholder PORT satisfies the
  // one boot variable it does not need.
  const env = loadEnv({ ...process.env, PORT: process.env.PORT ?? '1' });

  const prisma = new PrismaClient({
    datasources: { db: { url: env.databaseUrl } },
  });
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user === null) {
      fail('no account exists for that email');
      return;
    }

    const passwordHash = await hashPassword(password, env.argon2);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });
      await tx.session.deleteMany({ where: { userId: user.id } });
    });

    process.stdout.write(
      'set-password: password updated; all sessions cleared\n',
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    fail(error instanceof Error ? error.message : 'unexpected failure');
  });
}
