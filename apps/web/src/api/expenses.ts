/**
 * Expenses API service (TKT-exp-005 create/list; TKT-exp-006 detail/update/
 * remove; 03-api-design.md §3b expense rows).
 *
 * Thin typed wrapper over the shared fetch client (`./client`) so pages never
 * compose API paths or bodies inline. Every path is site-relative under the
 * client's fixed `/api` base; `groupId` is URL-encoded because it is a path
 * segment. The service is injectable (`createExpensesApi`) so mechanism specs
 * can drive it with a fake fetch; production uses the `expensesApi` singleton.
 */

import type {
  CreateExpenseRequestDto,
  EditExpenseRequestDto,
  ExpenseResponseDto,
  ExpensesResponseDto,
} from 'shared';

import { api, type ApiClient } from './client';

export interface ExpensesApi {
  /**
   * `POST /api/groups/:groupId/expenses` — log an expense; the server computes
   * and stores the shares (UC-EXP-001; FR-EXP-001).
   */
  create(groupId: string, body: CreateExpenseRequestDto): Promise<ExpenseResponseDto>;
  /** `GET /api/groups/:groupId/expenses` — the group ledger, newest first (FR-EXP-011). */
  list(groupId: string): Promise<ExpensesResponseDto>;
  /**
   * `GET /api/groups/:groupId/expenses/:expenseId` — expense detail incl.
   * shares and timestamps; the edit form prefills from it (UC-EXP-002;
   * FR-EXP-011).
   */
  detail(groupId: string, expenseId: string): Promise<ExpenseResponseDto>;
  /**
   * `PATCH /api/groups/:groupId/expenses/:expenseId` — edit an expense; the
   * server recomputes shares iff amount/participants/splitType changed and
   * sets `editedAt` (UC-EXP-002; FR-EXP-006/008; logger only).
   */
  update(
    groupId: string,
    expenseId: string,
    body: EditExpenseRequestDto,
  ): Promise<ExpenseResponseDto>;
  /**
   * `DELETE /api/groups/:groupId/expenses/:expenseId` — permanent removal incl.
   * shares (UC-EXP-003; FR-EXP-009/012; logger only; `204`, no body).
   */
  remove(groupId: string, expenseId: string): Promise<void>;
}

/** The `/groups/:groupId/expenses/:expenseId` path, both ids encoded. */
function expensePath(groupId: string, expenseId: string): string {
  return `/groups/${encodeURIComponent(groupId)}/expenses/${encodeURIComponent(expenseId)}`;
}

export function createExpensesApi(client: ApiClient = api): ExpensesApi {
  return {
    create: (groupId: string, body: CreateExpenseRequestDto) =>
      client.post<ExpenseResponseDto>(`/groups/${encodeURIComponent(groupId)}/expenses`, body),
    list: (groupId: string) =>
      client.get<ExpensesResponseDto>(`/groups/${encodeURIComponent(groupId)}/expenses`),
    detail: (groupId: string, expenseId: string) =>
      client.get<ExpenseResponseDto>(expensePath(groupId, expenseId)),
    update: (groupId: string, expenseId: string, body: EditExpenseRequestDto) =>
      client.patch<ExpenseResponseDto>(expensePath(groupId, expenseId), body),
    remove: (groupId: string, expenseId: string) =>
      client.del<void>(expensePath(groupId, expenseId)),
  };
}

/** The application-wide Expenses service (real `/api` client). */
export const expensesApi = createExpensesApi();
