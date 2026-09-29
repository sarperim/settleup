/**
 * Expenses API service (TKT-exp-005; 03-api-design.md §3b expense rows).
 *
 * Thin typed wrapper over the shared fetch client (`./client`) so pages never
 * compose API paths or bodies inline. Every path is site-relative under the
 * client's fixed `/api` base; `groupId` is URL-encoded because it is a path
 * segment. The service is injectable (`createExpensesApi`) so mechanism specs
 * can drive it with a fake fetch; production uses the `expensesApi` singleton.
 */

import type {
  CreateExpenseRequestDto,
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
}

export function createExpensesApi(client: ApiClient = api): ExpensesApi {
  return {
    create: (groupId: string, body: CreateExpenseRequestDto) =>
      client.post<ExpenseResponseDto>(`/groups/${encodeURIComponent(groupId)}/expenses`, body),
    list: (groupId: string) =>
      client.get<ExpensesResponseDto>(`/groups/${encodeURIComponent(groupId)}/expenses`),
  };
}

/** The application-wide Expenses service (real `/api` client). */
export const expensesApi = createExpensesApi();
