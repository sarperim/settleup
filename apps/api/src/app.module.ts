import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';

/**
 * Root application module (TKT-foundation-004).
 *
 * Platform-level pieces only: validated configuration and the single Prisma
 * client. Domain modules (Auth C2, Groups C3, Ledger C4, Settlement C5) are
 * added by their owning tickets and import these globals.
 */
@Module({
  imports: [AppConfigModule, PrismaModule],
})
export class AppModule {}
