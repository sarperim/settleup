/**
 * Truncate-all-tables isolation helper (TKT-foundation-006; strategy §3 T3,
 * §7 rule 3, domain-plan conventions).
 *
 * Integration tests truncate **all** public tables before each test, so every
 * test starts from an empty database and no test can couple to another through
 * leftover rows — the approved alternative to per-test transaction rollback
 * (strategy §3 T3 explains why rollback is unsafe here).
 *
 * `_prisma_migrations` is deliberately excluded: it is Prisma Migrate's own
 * bookkeeping table, not application data. Truncating it would make the
 * applied-migration state inconsistent with the schema.
 */
import type { PrismaService } from '../../../src/prisma/prisma.service';

/**
 * Truncate every application table in the `public` schema, restarting
 * identities and cascading through foreign keys. Order-independent by
 * construction.
 */
export async function truncateAllTables(prisma: PrismaService): Promise<void> {
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
    ORDER BY tablename
  `;

  if (tables.length === 0) {
    return;
  }

  const targets = tables
    .map(({ tablename }) => `"public"."${tablename}"`)
    .join(', ');

  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${targets} RESTART IDENTITY CASCADE`,
  );
}
