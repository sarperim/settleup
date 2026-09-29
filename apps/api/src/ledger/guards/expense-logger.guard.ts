/**
 * `ExpenseLoggerGuard` — C4's logger-only authorization for expense edit/delete
 * (TKT-exp-004; FR-EXP-008/009, BR-EXP-007, 03-api-design.md §3b/§4 amended
 * 2026-09-25 "authorization first — guard order", 01-system-architecture.md
 * §8.1 layers 2/3).
 *
 * Route-level guard on `PATCH`/`DELETE /api/groups/:groupId/expenses/:expenseId`,
 * running **after** `GroupMemberGuard` (controller-level) and **before** the
 * global validation pipe: a member who is not the logger receives
 * `403 NOT_LOGGER` even when the body is also field-invalid. It resolves the
 * expense group-scoped (an id from another group is indistinguishable from a
 * missing one → `404 NOT_FOUND`) and attaches the row for the handler.
 */
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AppError } from '../../common/errors/app-error';
import { DEFAULT_MESSAGES } from '../../common/errors/error-contract';
import { LedgerReadService } from '../ledger-read.service';
import type { ExpenseScopedRequest } from '../ledger-request-context';

@Injectable()
export class ExpenseLoggerGuard implements CanActivate {
  constructor(private readonly read: LedgerReadService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ExpenseScopedRequest>();
    const groupId = request.params?.groupId;
    const expenseId = request.params?.expenseId;
    const userId = request.user?.id;

    // A missing :groupId/:expenseId or acting user is unreachable on a correctly
    // wired route; fail closed with the same 404 so nothing is disclosed.
    if (
      typeof groupId !== 'string' ||
      typeof expenseId !== 'string' ||
      userId === undefined
    ) {
      throw notFound();
    }

    const expense = await this.read.findGroupExpense(groupId, expenseId);
    // An expense is addressable only through its own group: a foreign or
    // missing id is indistinguishable (03 §3b, FR-EXP-011).
    if (expense === null) {
      throw notFound();
    }
    // Authorization precedes field validation (03 §4).
    if (expense.loggerId !== userId) {
      throw new AppError(
        403,
        'NOT_LOGGER',
        DEFAULT_MESSAGES.NOT_LOGGER,
      );
    }

    request.expense = expense;
    return true;
  }
}

function notFound(): AppError {
  return new AppError(404, 'NOT_FOUND', DEFAULT_MESSAGES.NOT_FOUND);
}
