/**
 * Balances controller — C5's `GET /api/groups/:groupId/balances` route
 * (TKT-bal-002; 03-api-design.md §3c balances row; 01-system-architecture.md
 * §2 C5, §8.1).
 *
 * Every route is group-scoped and applies `GroupMemberGuard` (layer 2): a
 * non-member receives `404 NOT_FOUND`, indistinguishable from a missing group
 * (FR-GRP-008, SC-006, FR-BAL-010 members-only views). The handler returns the
 * derived per-member balances plus the always-zero sum.
 */
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { GroupMemberGuard } from '../groups/guards/group-member.guard';
import { BalancesService, type BalancesView } from './balances.service';

@Controller('groups/:groupId')
@UseGuards(GroupMemberGuard)
export class BalancesController {
  constructor(private readonly balances: BalancesService) {}

  /** Derived per-member balances (UC-BAL-001 main; FR-BAL-001/002/003). */
  @Get('balances')
  async get(@Param('groupId') groupId: string): Promise<BalancesView> {
    return this.balances.forGroup(groupId);
  }
}
