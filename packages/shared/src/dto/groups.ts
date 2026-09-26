/**
 * Groups & Membership DTOs — (03-api-design.md §3, C3).
 *
 * Endpoints: `POST /api/groups` (201 `{ group incl. joinCode }`),
 * `GET /api/groups` (200 `{ groups }`), `GET /api/groups/:groupId`
 * (200 `{ group }`), `GET /api/groups/:groupId/members` (200 `{ members }`),
 * `GET /api/join-info?code=...` (200 `{ groupId, groupName }`),
 * `POST /api/join-requests` (201 `{ joinRequest }`),
 * `GET /api/groups/:groupId/join-requests` (200 `{ requests }`),
 * `POST /api/join-requests/:requestId/approve` / `.../reject`
 * (200 `{ joinRequest }`).
 */

import type { UserRefDto } from './common';

/** `POST /api/groups` request body (name 1–100 chars — FIELD_LIMITS.groupName). */
export interface CreateGroupRequestDto {
  name: string;
}

/** `POST /api/join-requests` request body (join by code). */
export interface JoinByCodeRequestDto {
  code: string;
}

/**
 * A group as returned by create, detail and overview reads. `joinCode`
 * (8-char Crockford base32) is present **iff the caller is the group's
 * creator** (FR-GRP-002); it is never exposed to other members. Beyond
 * `id`/`name`, the overview list's field set is not pinned by the
 * contract (groups-membership test plan §1).
 */
export interface GroupDto {
  id: string;
  name: string;
  creator: UserRefDto;
  createdAt: string;
  /** Present iff the caller is the creator. */
  joinCode?: string;
}

/** Success body of `POST /api/groups` and `GET /api/groups/:groupId`. */
export interface GroupResponseDto {
  group: GroupDto;
}

/** Success body of `GET /api/groups` (the caller's memberships only). */
export interface GroupsResponseDto {
  groups: GroupDto[];
}

/** `GET /api/groups/:groupId/members` entry (display names only — FR-ACC-008). */
export interface MemberDto {
  id: string;
  displayName: string;
  isCreator: boolean;
  joinedAt: string;
}

/** Success body of `GET /api/groups/:groupId/members`. */
export interface MembersResponseDto {
  members: MemberDto[];
}

/**
 * `GET /api/join-info?code=...` success body — exactly these keys: the
 * code holder learns the group's name and nothing else (TC-GRP-007).
 */
export interface JoinInfoDto {
  groupId: string;
  groupName: string;
}

/** Join-request status — the 02-data-model.md §5.3 state machine. */
export type JoinRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/**
 * A join request as returned by `POST /api/join-requests`, approve/reject
 * and the creator's pending-requests list. The requester is exposed by
 * display name only (FR-ACC-008).
 */
export interface JoinRequestDto {
  id: string;
  groupId: string;
  requester: UserRefDto;
  status: JoinRequestStatus;
  createdAt: string;
  /** Set on approve/reject; cleared on re-request (02 §5.3). */
  decidedAt?: string;
}

/** Success body of `POST /api/join-requests` and approve/reject. */
export interface JoinRequestResponseDto {
  joinRequest: JoinRequestDto;
}

/** Success body of `GET /api/groups/:groupId/join-requests` (creator only). */
export interface JoinRequestsResponseDto {
  requests: JoinRequestDto[];
}
