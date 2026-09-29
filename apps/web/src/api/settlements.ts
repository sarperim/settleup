/**
 * Balances & Settlement API service (TKT-bal-006; 03-api-design.md §3c
 * balances/settlement rows).
 *
 * Thin typed wrapper over the shared fetch client (`./client`) so pages never
 * compose API paths or bodies inline. Every path is site-relative under the
 * client's fixed `/api` base; ids are URL-encoded because they are path
 * segments. The service is injectable (`createSettlementsApi`) so mechanism
 * specs can drive it with a fake fetch; production uses the
 * `settlementsApi` singleton.
 */

import type {
  BalancesResponseDto,
  MarkPaidRequestDto,
  SettlementResponseDto,
  SettleUpViewDto,
} from 'shared';

import { api, type ApiClient } from './client';

export interface SettlementsApi {
  /**
   * `GET /api/groups/:groupId/balances` — derived per-member running balances
   * plus the always-zero sum (UC-BAL-001; FR-BAL-001/002/003; §3c).
   */
  balances(groupId: string): Promise<BalancesResponseDto>;
  /**
   * `GET /api/groups/:groupId/settlements` — the live outstanding suggestion
   * plan and the settled-payment facts, distinguished (UC-BAL-002; §3c).
   */
  view(groupId: string): Promise<SettleUpViewDto>;
  /**
   * `POST /api/groups/:groupId/settlements` — mark a suggested payment paid
   * (party only; exact match against the live plan, §3.4) (UC-BAL-003).
   */
  markPaid(groupId: string, body: MarkPaidRequestDto): Promise<SettlementResponseDto>;
  /**
   * `POST /api/groups/:groupId/settlements/:settlementId/undo` — undo a
   * settled payment (party only) (UC-BAL-004; FR-BAL-008/009).
   */
  undo(groupId: string, settlementId: string): Promise<SettlementResponseDto>;
}

/** The `/groups/:groupId/settlements` collection path, group id encoded. */
function settlementsPath(groupId: string): string {
  return `/groups/${encodeURIComponent(groupId)}/settlements`;
}

export function createSettlementsApi(client: ApiClient = api): SettlementsApi {
  return {
    balances: (groupId: string) =>
      client.get<BalancesResponseDto>(`/groups/${encodeURIComponent(groupId)}/balances`),
    view: (groupId: string) => client.get<SettleUpViewDto>(settlementsPath(groupId)),
    markPaid: (groupId: string, body: MarkPaidRequestDto) =>
      client.post<SettlementResponseDto>(settlementsPath(groupId), body),
    undo: (groupId: string, settlementId: string) =>
      client.post<SettlementResponseDto>(
        `${settlementsPath(groupId)}/${encodeURIComponent(settlementId)}/undo`,
      ),
  };
}

/** The application-wide Settlements service (real `/api` client). */
export const settlementsApi = createSettlementsApi();
