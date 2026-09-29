/**
 * Balances & Settlement API service (TKT-bal-006; 03-api-design.md §3c).
 *
 * Pins the request shaping of the SPA's balances/settle-up calls against the
 * frozen §3c contract: `GET /api/groups/:groupId/balances`,
 * `GET /api/groups/:groupId/settlements`, `POST /api/groups/:groupId/settlements`
 * and `POST /api/groups/:groupId/settlements/:settlementId/undo`. Like the
 * other API service specs this is a mechanism spec with an injected `fetch`
 * — full behavioral verification is the e2e TC-BAL-021…024.
 */

import { describe, expect, it, vi } from 'vitest';
import type {
  BalancesResponseDto,
  MarkPaidRequestDto,
  SettlementDto,
  SettlementResponseDto,
  SettleUpViewDto,
} from 'shared';

import { API_BASE_PATH, CSRF_HEADER, CSRF_HEADER_VALUE, createApiClient } from './client';
import { createSettlementsApi } from './settlements';

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
  settlements: ReturnType<typeof createSettlementsApi>;
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
  return { settlements: createSettlementsApi(client), calls };
}

const SETTLEMENT: SettlementDto = {
  id: 's1',
  payer: { id: 'u1', displayName: 'Bob' },
  recipient: { id: 'u2', displayName: 'Alice' },
  amountKurus: 3000,
  status: 'SETTLED',
  paidAt: '2026-09-29T00:00:00.000Z',
};

describe('settlementsApi — request shaping (03 §3c)', () => {
  it('reads balances via GET /api/groups/:groupId/balances, encoding the group id', async () => {
    const body: BalancesResponseDto = {
      balances: [{ member: { id: 'u1', displayName: 'Alice' }, balanceKurus: 6000 }],
      sumKurus: 0,
    };
    const { settlements, calls } = makeApi([jsonResponse(200, body)]);

    await expect(settlements.balances('g 1')).resolves.toEqual(body);
    expect(calls[0]!.url).toBe(`${API_BASE_PATH}/groups/g%201/balances`);
    expect(calls[0]!.init.method).toBe('GET');
    expect((calls[0]!.init.headers as Record<string, string>)[CSRF_HEADER]).toBeUndefined();
  });

  it('reads the settle-up view via GET /api/groups/:groupId/settlements', async () => {
    const body: SettleUpViewDto = {
      outstanding: [
        { payer: { id: 'u1', displayName: 'Bob' }, recipient: { id: 'u2', displayName: 'Alice' }, amountKurus: 3000 },
      ],
      settled: [SETTLEMENT],
    };
    const { settlements, calls } = makeApi([jsonResponse(200, body)]);

    await expect(settlements.view('g1')).resolves.toEqual(body);
    expect(calls[0]!.url).toBe(`${API_BASE_PATH}/groups/g1/settlements`);
    expect(calls[0]!.init.method).toBe('GET');
  });

  it('marks a payment paid via POST /api/groups/:groupId/settlements with the body and CSRF header', async () => {
    const request: MarkPaidRequestDto = { payerId: 'u1', recipientId: 'u2', amountKurus: 3000 };
    const body: SettlementResponseDto = { settlement: SETTLEMENT };
    const { settlements, calls } = makeApi([jsonResponse(201, body)]);

    await expect(settlements.markPaid('g1', request)).resolves.toEqual(body);
    expect(calls[0]!.url).toBe(`${API_BASE_PATH}/groups/g1/settlements`);
    expect(calls[0]!.init.method).toBe('POST');
    expect((calls[0]!.init.headers as Record<string, string>)[CSRF_HEADER]).toBe(CSRF_HEADER_VALUE);
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual(request);
  });

  it('undoes via POST /api/groups/:groupId/settlements/:settlementId/undo, encoding both ids', async () => {
    const body: SettlementResponseDto = {
      settlement: { ...SETTLEMENT, status: 'UNDONE', undoneAt: '2026-09-29T01:00:00.000Z' },
    };
    const { settlements, calls } = makeApi([jsonResponse(200, body)]);

    await expect(settlements.undo('g 1', 's 1')).resolves.toEqual(body);
    expect(calls[0]!.url).toBe(`${API_BASE_PATH}/groups/g%201/settlements/s%201/undo`);
    expect(calls[0]!.init.method).toBe('POST');
    expect((calls[0]!.init.headers as Record<string, string>)[CSRF_HEADER]).toBe(CSRF_HEADER_VALUE);
  });
});
