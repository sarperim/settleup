import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { GroupsModule } from './groups/groups.module';

/**
 * Root application module (TKT-foundation-004).
 *
 * Platform-level pieces: validated configuration and the single Prisma client.
 * Domain modules register themselves here as their tickets land — C2 Auth
 * (TKT-accounts-001) and C3 Groups (TKT-groups-001) are in place; C4 Ledger
 * and C5 Settlement are added by their owning tickets and import the global
 * providers.
 */
@Module({
  imports: [AppConfigModule, PrismaModule, AuthModule, GroupsModule],
})
export class AppModule {}
