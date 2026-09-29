/**
 * Ledger module — C4 (TKT-exp-002; 01-system-architecture.md §2 C4, §3).
 *
 * Owns `expenses`/`expense_shares`. Imports C2 (`UsersService`, display names
 * only) and C3 (`MembershipService`, `GroupMemberGuard` — the group-scoped
 * privacy boundary) and wires the **production CSPRNG** into the split engine
 * (arch. §3 rule 3): `CryptoRandomSource` for the equal split's random-spread
 * remainder. Exports `LedgerReadService` — C5 Settlement's read path to the
 * ledger (02-data-model.md §6).
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GroupsModule } from '../groups/groups.module';
import { CryptoRandomSource, RANDOM_SOURCE } from '../groups/random-source';
import { ExpenseLoggerGuard } from './guards/expense-logger.guard';
import { LedgerController } from './ledger.controller';
import { LedgerReadService } from './ledger-read.service';
import { LedgerService } from './ledger.service';

@Module({
  imports: [AuthModule, GroupsModule],
  controllers: [LedgerController],
  providers: [
    LedgerService,
    LedgerReadService,
    ExpenseLoggerGuard,
    { provide: RANDOM_SOURCE, useClass: CryptoRandomSource },
  ],
  exports: [LedgerReadService],
})
export class LedgerModule {}
