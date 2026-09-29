/**
 * Settlements controller — C5's `GET /api/groups/:groupId/settlements` route
 * (TKT-bal-003; 03-api-design.md §3c settlements row; 01-system-architecture.md
 * §2 C5, §8.1).
 *
 * Every route is group-scoped and applies `GroupMemberGuard` (layer 2): a
 * non-member receives `404 NOT_FOUND`, indistinguishable from a missing group
 * (FR-GRP-008, SC-006, FR-BAL-010 members-only views). The handler returns the
 * live derived outstanding plan plus the stored settled-payment facts.
 *
 * The mark-paid / undo state-changing routes on this same path land with
 * TKT-bal-004.
 */
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { GroupMemberGuard } from '../groups/guards/group-member.guard';
import {
  SettlementsService,
  type SettlementsView,
} from './settlements.service';

@Controller('groups/:groupId/settlements')
@UseGuards(GroupMemberGuard)
export class SettlementsController {
  constructor(private readonly settlements: SettlementsService) {}

  /** Live outstanding plan + settled facts (UC-BAL-002 main; FR-BAL-004/005). */
  @Get()
  async get(@Param('groupId') groupId: string): Promise<SettlementsView> {
    return this.settlements.forGroup(groupId);
  }
}
