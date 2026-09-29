/**
 * Expenses API service (TKT-exp-005; 03-api-design.md §3b expense rows).
 *
 * Pins the request shaping of the SPA's expense calls against the frozen §3b
 * contract: `POST /api/groups/:groupId/expenses` and
 * `GET /api/groups/:groupId/expenses`. Like `client.spec.ts` and
 * `groups.spec.ts`, this is a mechanism spec with an injected `fetch` — full
 * behavioral verification of the add-expense journey is the e2e TC-EXP-028.
 */

import { describe, expect, it, vi } from 'vitest';
import type {
  CreateExpenseRequestDto,
  EditExpenseRequestDto,
  ExpenseDto,
  ExpenseResponseDto,
  ExpensesResponseDto,
} from 'shared';

import { API_BASE_PATH, CSRF_HEADER, CSRF_HEADER_VALUE, createApiClient } from './client';
import { createExpensesApi } from './expenses';

interface CapturedCall {
  url: string;
  init: RequestInit;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function makeApi(responses: Response[]): {
  expenses: ReturnType<typeof createExpensesApi>;
  calls: CapturedCall[];
} {
  const calls: CapturedCall[] = [];
  let index = 0;
  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    const response = responses[index];
    index += 1;
    if (!response) {
      throw new Error('unexpected fetch call');
    }
    return response;
  }) as unknown as typeof fetch;
  const client = createApiClient({ fetchImpl, onUnauthenticated: () => undefined });
  return { expenses: createExpensesApi(client), calls };
}

const EXPENSE: ExpenseDto = {
  id: 'e1',
  description: 'Dinner',
  amountKurus: 12050,
  splitType: 'EQUAL',
  payer: { id: 'u1', displayName: 'Sara' },
  logger: { id: 'u1', displayName: 'Sara' },
  shares: [
    { participant: { id: 'u1', displayName: 'Sara' }, shareKurus: 6025 },
    { participant: { id: 'u2', displayName: 'Tomás' }, shareKurus: 6025 },
  ],
  createdAt: '2026-09-29T00:00:00.000Z',
};

describe('expensesApi — request shaping (03 §3b)', () => {
  it('lists a group ledger via GET /api/groups/:groupId/expenses, encoding the group id', async () => {
    const body: ExpensesResponseDto = { expenses: [EXPENSE] };
    const { expenses, calls } = makeApi([jsonResponse(200, body)]);

    await expect(expenses.list('g 1')).resolves.toEqual(body);
    expect(calls[0]!.url).toBe(`${API_BASE_PATH}/groups/g%201/expenses`);
    expect(calls[0]!.init.method).toBe('GET');
    expect((calls[0]!.init.headers as Record<string, string>)[CSRF_HEADER]).toBeUndefined();
  });

  it('creates an expense via POST /api/groups/:groupId/expenses with the body and CSRF header', async () => {
    const request: CreateExpenseRequestDto = {
      description: 'Dinner',
      amountKurus: 12050,
      payerId: 'u1',
      participantIds: ['u1', 'u2'],
      splitType: 'EQUAL',
    };
    const body: ExpenseResponseDto = { expense: EXPENSE };
    const { expenses, calls } = makeApi([jsonResponse(201, body)]);

    await expect(expenses.create('g1', request)).resolves.toEqual(body);
    expect(calls[0]!.url).toBe(`${API_BASE_PATH}/groups/g1/expenses`);
    expect(calls[0]!.init.method).toBe('POST');
    expect((calls[0]!.init.headers as Record<string, string>)[CSRF_HEADER]).toBe(CSRF_HEADER_VALUE);
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual(request);
  });

  it('fetches an expense detail via GET /api/groups/:groupId/expenses/:expenseId, encoding both ids', async () => {
    const body: ExpenseResponseDto = { expense: EXPENSE };
    const { expenses, calls } = makeApi([jsonResponse(200, body)]);

    await expect(expenses.detail('g 1', 'e 1')).resolves.toEqual(body);
    expect(calls[0]!.url).toBe(`${API_BASE_PATH}/groups/g%201/expenses/e%201`);
    expect(calls[0]!.init.method).toBe('GET');
    expect((calls[0]!.init.headers as Record<string, string>)[CSRF_HEADER]).toBeUndefined();
  });

  it('edits an expense via PATCH /api/groups/:groupId/expenses/:expenseId with the body and CSRF header', async () => {
    const request: EditExpenseRequestDto = { amountKurus: 4500 };
    const body: ExpenseResponseDto = { expense: { ...EXPENSE, amountKurus: 4500 } };
    const { expenses, calls } = makeApi([jsonResponse(200, body)]);

    await expect(expenses.update('g 1', 'e 1', request)).resolves.toEqual(body);
    expect(calls[0]!.url).toBe(`${API_BASE_PATH}/groups/g%201/expenses/e%201`);
    expect(calls[0]!.init.method).toBe('PATCH');
    expect((calls[0]!.init.headers as Record<string, string>)[CSRF_HEADER]).toBe(CSRF_HEADER_VALUE);
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual(request);
  });

  it('deletes an expense via DELETE /api/groups/:groupId/expenses/:expenseId with the CSRF header and no body', async () => {
    const { expenses, calls } = makeApi([new Response(null, { status: 204 })]);

    await expect(expenses.remove('g 1', 'e 1')).resolves.toBeUndefined();
    expect(calls[0]!.url).toBe(`${API_BASE_PATH}/groups/g%201/expenses/e%201`);
    expect(calls[0]!.init.method).toBe('DELETE');
    expect((calls[0]!.init.headers as Record<string, string>)[CSRF_HEADER]).toBe(CSRF_HEADER_VALUE);
    expect(calls[0]!.init.body).toBeUndefined();
  });
});
