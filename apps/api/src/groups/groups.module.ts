/**
 * Groups module — C3 (TKT-groups-001; 01-system-architecture.md §2 C3, §3).
 *
 * Owns `groups`/`memberships`/`join_requests`. Exports the `MembershipService`
 * read API (`isMember`, `(groupId, userId)` resolution) plus the
 * `GroupMemberGuard`/`GroupCreatorGuard` so C4 Ledger and C5 Settlement can
 * apply the same privacy boundary to their group-scoped routes (arch. §8.1
 * layers 2/3, 02 §6 ownership matrix). Imports C2 for `UsersService` (display
 * names only — FR-ACC-008).
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';
import { MembershipService } from './membership.service';
import { CryptoRandomSource, RANDOM_SOURCE } from './random-source';
import { GroupMemberGuard } from './guards/group-member.guard';
import { GroupCreatorGuard } from './guards/group-creator.guard';

@Module({
  imports: [AuthModule],
  controllers: [GroupsController],
  providers: [
    GroupsService,
    MembershipService,
    { provide: RANDOM_SOURCE, useClass: CryptoRandomSource },
    GroupMemberGuard,
    GroupCreatorGuard,
  ],
  exports: [MembershipService, GroupMemberGuard, GroupCreatorGuard],
})
export class GroupsModule {}
