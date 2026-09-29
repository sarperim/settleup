/**
 * Settlement module — C5 (TKT-bal-002; 01-system-architecture.md §2 C5, §3).
 *
 * Owns `settled_payments` and the derived balance + settle-up read models.
 * Registers the balance components (TKT-bal-002), the settle-up read route
 * (TKT-bal-003) and the suggestion-engine provider wiring
 * (`SUGGESTION_ENGINE`); the mark-paid / undo routes land with TKT-bal-004.
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
import { SettlementsController } from './settlements.controller';
import { SettlementsService } from './settlements.service';
import {
  PureSuggestionEngine,
  SUGGESTION_ENGINE,
} from './suggestion-engine.provider';

@Module({
  imports: [GroupsModule, LedgerModule],
  controllers: [BalancesController, SettlementsController],
  providers: [
    BalancesService,
    SettlementsService,
    // Suggestion-engine provider wiring (TKT-bal-003) — the pure TKT-bal-001
    // engine exposed through its DI token (arch. §3 rule 3).
    { provide: SUGGESTION_ENGINE, useClass: PureSuggestionEngine },
  ],
})
export class SettlementModule {}
