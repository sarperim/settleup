import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { GroupsModule } from './groups/groups.module';
import { LedgerModule } from './ledger/ledger.module';
import { SettlementModule } from './settlement/settlement.module';

/**
 * Root application module (TKT-foundation-004).
 *
 * Platform-level pieces: validated configuration and the single Prisma client.
 * Domain modules register themselves here as their tickets land — C2 Auth
 * (TKT-accounts-001), C3 Groups (TKT-groups-001), C4 Ledger (TKT-exp-002) and
 * C5 Settlement (TKT-bal-002) are in place; C5 imports the global providers.
 */
@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    AuthModule,
    GroupsModule,
    LedgerModule,
    SettlementModule,
  ],
})
export class AppModule {}
