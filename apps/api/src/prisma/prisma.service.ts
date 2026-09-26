/**
 * `PrismaService` — the single injectable Prisma client (TKT-foundation-004;
 * 02-data-model.md §6, arch. §2 C7).
 *
 * Domain modules (C2–C5) inject this one instance; only it talks to
 * PostgreSQL. The datasource URL comes from the validated `APP_CONFIG`, so the
 * client never reads `process.env` on its own.
 *
 * The connection is opened lazily by Prisma on the first query (no eager
 * `$connect` at boot): env validation already fails fast for a missing
 * `DATABASE_URL`, and booting must not require a live database — the f-007
 * unit runner and this ticket's platform tests boot the app without Postgres.
 */
import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { APP_CONFIG, type AppConfig } from '../config/app-config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    super({ datasourceUrl: config.databaseUrl });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
