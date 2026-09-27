/**
 * Groups API service (TKT-groups-004; 03-api-design.md §3 groups rows).
 *
 * Thin typed wrapper over the shared fetch client (`./client`) so pages never
 * compose API paths or bodies inline. Every path is site-relative under the
 * client's fixed `/api` base; `groupId` is URL-encoded because it is a path
 * segment. The service is injectable (`createGroupsApi`) so mechanism specs
 * can drive it with a fake fetch; production uses the `groupsApi` singleton.
 */

import type {
  CreateGroupRequestDto,
  GroupResponseDto,
  GroupsResponseDto,
  MembersResponseDto,
} from 'shared';

import { api, type ApiClient } from './client';

export interface GroupsApi {
  /** `GET /api/groups` — the caller's memberships overview (FR-GRP-009). */
  list(): Promise<GroupsResponseDto>;
  /** `POST /api/groups` — create a group; caller becomes creator (FR-GRP-001). */
  create(name: string): Promise<GroupResponseDto>;
  /**
   * `GET /api/groups/:groupId` — group detail; `joinCode` is present iff the
   * caller is the creator (FR-GRP-002).
   */
  detail(groupId: string): Promise<GroupResponseDto>;
  /** `GET /api/groups/:groupId/members` — display names only (FR-GRP-010). */
  members(groupId: string): Promise<MembersResponseDto>;
}

export function createGroupsApi(client: ApiClient = api): GroupsApi {
  return {
    list: () => client.get<GroupsResponseDto>('/groups'),
    create: (name: string) => {
      const body: CreateGroupRequestDto = { name };
      return client.post<GroupResponseDto>('/groups', body);
    },
    detail: (groupId: string) =>
      client.get<GroupResponseDto>(`/groups/${encodeURIComponent(groupId)}`),
    members: (groupId: string) =>
      client.get<MembersResponseDto>(`/groups/${encodeURIComponent(groupId)}/members`),
  };
}

/** The application-wide Groups service (real `/api` client). */
export const groupsApi = createGroupsApi();
