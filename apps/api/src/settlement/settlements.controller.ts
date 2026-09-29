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
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AppError } from '../common/errors/app-error';
import { DEFAULT_MESSAGES } from '../common/errors/error-contract';
import type { RequestWithContext } from '../common/http/request-context';
import type { GroupScopedRequest } from '../groups/group-request-context';
import { GroupMemberGuard } from '../groups/guards/group-member.guard';
import { CreateSettlementDto } from './dto/create-settlement.dto';
import {
  SettlementsService,
  type SettlementView,
  type SettlementsView,
} from './settlements.service';

/** The acting user's id, or `UNAUTHENTICATED` if somehow absent. */
function requireUserId(request: RequestWithContext): string {
  const userId = request.user?.id;
  if (userId === undefined) {
    // Unreachable: the global AuthGuard rejects anonymous calls first.
    throw new AppError(
      401,
      'UNAUTHENTICATED',
      DEFAULT_MESSAGES.UNAUTHENTICATED,
    );
  }
  return userId;
}

@Controller('groups/:groupId/settlements')
@UseGuards(GroupMemberGuard)
export class SettlementsController {
  constructor(private readonly settlements: SettlementsService) {}

  /** Live outstanding plan + settled facts (UC-BAL-002 main; FR-BAL-004/005). */
  @Get()
  async get(@Param('groupId') groupId: string): Promise<SettlementsView> {
    return this.settlements.forGroup(groupId);
  }

  /**
   * Mark a suggested payment paid — party-only (UC-BAL-003 main;
   * FR-BAL-006/007; 03 §3c/§3.4). The party check precedes plan recomputation
   * (`403 NOT_PAYMENT_PARTY`); a triple not matching the in-transaction live
   * plan is `409 SUGGESTION_STALE`.
   */
  @Post()
  @HttpCode(201)
  async markPaid(
    @Param('groupId') groupId: string,
    @Body() dto: CreateSettlementDto,
    @Req() request: GroupScopedRequest,
  ): Promise<{ settlement: SettlementView }> {
    return {
      settlement: await this.settlements.markPaid(
        requireUserId(request),
        groupId,
        dto,
      ),
    };
  }

  /**
   * Undo a settled payment — party-only (UC-BAL-004 main; FR-BAL-008/009;
   * 03 §3c undo row). Party check precedes `ALREADY_UNDONE`; a foreign or
   * missing `:settlementId` is `404 NOT_FOUND`.
   */
  @Post(':settlementId/undo')
  @HttpCode(200)
  async undo(
    @Param('groupId') groupId: string,
    @Param('settlementId') settlementId: string,
    @Req() request: GroupScopedRequest,
  ): Promise<{ settlement: SettlementView }> {
    return {
      settlement: await this.settlements.undo(
        groupId,
        settlementId,
        requireUserId(request),
      ),
    };
  }
}
