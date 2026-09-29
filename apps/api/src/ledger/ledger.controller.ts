/**
 * Ledger controller — C4 expense routes (TKT-exp-002;
 * 03-api-design.md §3b create row, 01-system-architecture.md §8.1).
 *
 * Every route is group-scoped and applies `GroupMemberGuard` (layer 2): a
 * non-member receives `404 NOT_FOUND`, indistinguishable from a missing group
 * (FR-GRP-008, SC-006). DTO validation precedes all service-level checks
 * (03 §4).
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
import type { RequestWithContext } from '../common/http/request-context';
import { AppError } from '../common/errors/app-error';
import { DEFAULT_MESSAGES } from '../common/errors/error-contract';
import type { GroupScopedRequest } from '../groups/group-request-context';
import { GroupMemberGuard } from '../groups/guards/group-member.guard';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { LedgerService, type ExpenseView } from './ledger.service';

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

@Controller('groups/:groupId/expenses')
@UseGuards(GroupMemberGuard)
export class LedgerController {
  constructor(private readonly ledger: LedgerService) {}

  /** Log an expense (UC-EXP-001 main; FR-EXP-001). */
  @Post()
  @HttpCode(201)
  async create(
    @Param('groupId') groupId: string,
    @Body() dto: CreateExpenseDto,
    @Req() request: GroupScopedRequest,
  ): Promise<{ expense: ExpenseView }> {
    const loggerId = requireUserId(request);
    return { expense: await this.ledger.create(loggerId, groupId, dto) };
  }

  /** Expense detail incl. shares and timestamps (FR-EXP-011 read aspect). */
  @Get(':expenseId')
  async detail(
    @Param('groupId') groupId: string,
    @Param('expenseId') expenseId: string,
  ): Promise<{ expense: ExpenseView }> {
    return { expense: await this.ledger.getDetail(groupId, expenseId) };
  }
}
