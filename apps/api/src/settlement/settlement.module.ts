/**
 * Settlement module — C5 (TKT-bal-002; 01-system-architecture.md §2 C5, §3).
 *
 * Owns `settled_payments` and the derived balance read model. Registers only
 * the balance components on this ticket; the suggestion engine and the
 * mark-paid / undo routes land with their own tickets (TKT-bal-001/003/004).
 *
 * Imports C3 (`MembershipService` for the member list and `GroupMemberGuard`
 * for the group-scoped privacy boundary) and C4 (`LedgerReadService` — the
 * exported read path to `expenses`/`expense_shares`; 01 §3 rule 1,
 * 02-data-model.md §6). It never touches those tables directly.
 */
import { Module } from '@nestjs/common';
import { GroupsModule } from '../groups/groups.module';
import { LedgerModule } from '../ledger/ledger.module';
import { BalancesController } from './balances.controller';
import { BalancesService } from './balances.service';

@Module({
  imports: [GroupsModule, LedgerModule],
  controllers: [BalancesController],
  providers: [BalancesService],
})
export class SettlementModule {}
