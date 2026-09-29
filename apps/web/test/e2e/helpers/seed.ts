import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Direct Prisma seeding for **scale fixtures** only (00-test-strategy.md §5):
 * e2e scenario data is created through the UI, but large read-path fixtures
 * (e.g. the NFR-EXP-004 50-expense ledger, TC-EXP-033) may be seeded straight
 * into the e2e database. Seeded facts must satisfy the domain invariants
 * (shares sum exactly to the amount); `seedEqualExpenses` distributes the
 * remainder deterministically so that validity is asserted, not assumed.
 *
 * The Playwright process runs from `apps/web`, which does not depend on
 * `@prisma/client`. The client is resolved from the API workspace's
 * node_modules (single generated client, same schema) rather than added as a
 * web dependency — the ticket forbids lockfile/root-dependency changes.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const apiPackageDir = path.resolve(here, '../../../../api');

export interface SeededShareRow {
  shareKurus: number;
}

export interface SeededExpenseRow {
  id: string;
  amountKurus: number;
  shares: SeededShareRow[];
}

export interface SeededUserRow {
  id: string;
  email: string;
}

export interface PrismaLike {
  expense: {
    create(args: unknown): Promise<{ id: string }>;
    findMany(args: unknown): Promise<SeededExpenseRow[]>;
  };
  user: {
    findMany(args: unknown): Promise<SeededUserRow[]>;
  };
  $disconnect(): Promise<void>;
}

/** The e2e database URL; the ambient `E2E_DATABASE_URL` (or CI's `DATABASE_URL`). */
export function e2eDatabaseUrl(): string {
  const url = process.env.E2E_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error('The scale-fixture seed helper requires E2E_DATABASE_URL (or DATABASE_URL).');
  }
  return url;
}

/** Run `fn` with a Prisma client bound to the e2e database, always disconnecting. */
export async function withPrisma<T>(fn: (prisma: PrismaLike) => Promise<T>): Promise<T> {
  const require = createRequire(path.join(apiPackageDir, 'package.json'));
  const { PrismaClient } = require('@prisma/client') as {
    PrismaClient: new (options: unknown) => PrismaLike;
  };
  const prisma = new PrismaClient({ datasources: { db: { url: e2eDatabaseUrl() } } });
  try {
    return await fn(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

export interface EqualExpenseSeed {
  groupId: string;
  /** Payer and logger of every seeded expense. */
  payerId: string;
  participantIds: string[];
  count: number;
  amountKurus: number;
  descriptionPrefix: string;
}

/**
 * Seed `count` EQUAL expenses into `groupId`, each with shares summing exactly
 * to `amountKurus` (base floor plus a deterministic one-kuruş remainder on the
 * first participants). Timestamps are spaced so the ledger order is stable.
 */
export async function seedEqualExpenses(input: EqualExpenseSeed): Promise<void> {
  const { groupId, payerId, participantIds, count, amountKurus, descriptionPrefix } = input;
  const base = Math.floor(amountKurus / participantIds.length);
  const remainder = amountKurus - base * participantIds.length;
  const now = Date.now();

  await withPrisma(async (prisma) => {
    for (let i = 0; i < count; i += 1) {
      const shares = participantIds.map((participantId, index) => ({
        participantId,
        shareKurus: base + (index < remainder ? 1 : 0),
      }));
      await prisma.expense.create({
        data: {
          groupId,
          description: `${descriptionPrefix} ${i + 1}`,
          amountKurus,
          payerId,
          loggerId: payerId,
          splitType: 'EQUAL',
          createdAt: new Date(now - (count - i) * 1000),
          shares: { create: shares },
        },
      });
    }
  });
}

/** Every expense of `groupId` incl. its shares — for seed-validity assertions. */
export function findGroupExpenses(groupId: string): Promise<SeededExpenseRow[]> {
  return withPrisma((prisma) =>
    prisma.expense.findMany({ where: { groupId }, include: { shares: true } }),
  );
}

/** Resolve user ids by email (registration creates them through the UI). */
export async function findUserIdsByEmails(
  emails: string[],
): Promise<Record<string, string>> {
  const users = await withPrisma((prisma) =>
    prisma.user.findMany({ where: { email: { in: emails } } }),
  );
  return Object.fromEntries(users.map((user) => [user.email, user.id]));
}
