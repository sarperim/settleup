// pnpm test:e2e — e2e database create + migrate step (TKT-foundation-006).
//
// Realises 04-ci-pipeline.md §4 step 4's "Create E2E database & apply
// migrations" for the local root script contract (04 §3): the Playwright suite
// boots the built app against E2E_DATABASE_URL, so that database must exist and
// carry the Prisma migration schema. The frozen CI workflow performs the same
// two actions before `pnpm test:e2e`; this script is idempotent, so it is a
// no-op-shaped safety net there and the sole setup locally.
//
// `E2E_DATABASE_URL` and `psql` are required. The maintenance connection
// (`/postgres`) is derived from E2E_DATABASE_URL — `CREATE DATABASE` cannot run
// while connected to the database being created (the same bug 04 §4 carries;
// see TKT-foundation-007 DEVIATION-3).
import { execFileSync } from 'node:child_process';

const databaseUrl = process.env.E2E_DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error(
    '[e2e-db] E2E_DATABASE_URL is required, e.g. postgresql://settleup:settleup@127.0.0.1:5432/settleup_e2e',
  );
  process.exit(1);
}

const parsed = new URL(databaseUrl);
const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
if (!databaseName) {
  console.error(`[e2e-db] E2E_DATABASE_URL has no database name: ${databaseUrl}`);
  process.exit(1);
}

const maintenance = new URL(databaseUrl);
maintenance.pathname = '/postgres';
const maintenanceUrl = maintenance.toString();

const psql = process.env.PSQL ?? 'psql';

try {
  const exists = execFileSync(
    psql,
    [
      maintenanceUrl,
      '-tAc',
      `SELECT 1 FROM pg_database WHERE datname = '${databaseName.replace(/'/g, "''")}'`,
    ],
    { encoding: 'utf8' },
  ).trim();

  if (exists !== '1') {
    console.log(`[e2e-db] creating database "${databaseName}"`);
    execFileSync(psql, [maintenanceUrl, '-v', 'ON_ERROR_STOP=1', '-c', `CREATE DATABASE "${databaseName}";`], {
      stdio: 'inherit',
    });
  } else {
    console.log(`[e2e-db] database "${databaseName}" already exists`);
  }
} catch (error) {
  console.error('[e2e-db] failed to ensure the e2e database exists:', error.message);
  process.exit(1);
}

console.log('[e2e-db] applying Prisma migrations');
execFileSync(
  'pnpm',
  ['--filter', 'api', 'exec', 'prisma', 'migrate', 'deploy', '--schema', 'prisma/schema.prisma'],
  { stdio: 'inherit', env: { ...process.env, DATABASE_URL: databaseUrl } },
);
