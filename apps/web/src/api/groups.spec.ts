/**
 * Groups API service (TKT-groups-004; 03-api-design.md §3 groups rows).
 *
 * Pins the request shaping of the SPA's Groups calls against the frozen §3
 * contract: `GET /api/groups`, `POST /api/groups`, `GET /api/groups/:groupId`,
 * `GET /api/groups/:groupId/members`. Like `client.spec.ts`, this is a
 * mechanism spec with an injected `fetch` — full behavioral verification of the
 * create-group journey is the e2e TC-GRP-026.
 */

import { describe, expect, it, vi } from 'vitest';
import type {
  GroupResponseDto,
  GroupsResponseDto,
  JoinInfoDto,
  JoinRequestResponseDto,
  JoinRequestsResponseDto,
  MembersResponseDto,
} from 'shared';

import { API_BASE_PATH, CSRF_HEADER, CSRF_HEADER_VALUE, createApiClient } from './client';
import { createGroupsApi } from './groups';

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
  groups: ReturnType<typeof createGroupsApi>;
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
  return { groups: createGroupsApi(client), calls };
}

describe('groupsApi — request shaping (03 §3)', () => {
  it('lists the caller’s groups via GET /api/groups', async () => {
    const body: GroupsResponseDto = { groups: [] };
    const { groups, calls } = makeApi([jsonResponse(200, body)]);

    await expect(groups.list()).resolves.toEqual(body);
    expect(calls[0]!.url).toBe(`${API_BASE_PATH}/groups`);
    expect(calls[0]!.init.method).toBe('GET');
    expect((calls[0]!.init.headers as Record<string, string>)[CSRF_HEADER]).toBeUndefined();
  });

  it('creates a group via POST /api/groups with the name body and CSRF header', async () => {
    const group: GroupResponseDto = {
      group: {
        id: 'g1',
        name: 'Trip',
        creator: { id: 'u1', displayName: 'Gina' },
        createdAt: '2026-09-27T00:00:00.000Z',
        joinCode: 'ABCD1234',
      },
    };
    const { groups, calls } = makeApi([jsonResponse(201, group)]);

    await expect(groups.create('Trip')).resolves.toEqual(group);
    expect(calls[0]!.url).toBe(`${API_BASE_PATH}/groups`);
    expect(calls[0]!.init.method).toBe('POST');
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers[CSRF_HEADER]).toBe(CSRF_HEADER_VALUE);
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ name: 'Trip' });
  });

  it('reads a group detail, URL-encoding the group id', async () => {
    const { groups, calls } = makeApi([jsonResponse(200, { group: { id: 'g 1', name: 'Trip' } })]);

    await groups.detail('g 1');
    expect(calls[0]!.url).toBe(`${API_BASE_PATH}/groups/g%201`);
    expect(calls[0]!.init.method).toBe('GET');
  });

  it('lists members via GET /api/groups/:groupId/members', async () => {
    const body: MembersResponseDto = {
      members: [
        { id: 'u1', displayName: 'Gina', isCreator: true, joinedAt: '2026-09-27T00:00:00.000Z' },
      ],
    };
    const { groups, calls } = makeApi([jsonResponse(200, body)]);

    await expect(groups.members('g1')).resolves.toEqual(body);
    expect(calls[0]!.url).toBe(`${API_BASE_PATH}/groups/g1/members`);
    expect(calls[0]!.init.method).toBe('GET');
  });
});

/**
 * Join-flow request shaping (TKT-groups-006; 03-api-design.md §3 join rows).
 *
 * Pins the SPA's join-by-code calls against the frozen §3 contract:
 * `GET /api/join-info?code=...`, `POST /api/join-requests`,
 * `GET /api/groups/:groupId/join-requests`, and the approve/reject routes.
 * Full behavioral verification of the join journeys is the e2e
 * TC-GRP-027/028/029.
 */
describe('groupsApi — join-flow request shaping (03 §3)', () => {
  it('resolves a code via GET /api/join-info, URL-encoding the code', async () => {
    const body: JoinInfoDto = { groupId: 'g1', groupName: 'Trip' };
    const { groups, calls } = makeApi([jsonResponse(200, body)]);

    await expect(groups.joinInfo('AB CD')).resolves.toEqual(body);
    expect(calls[0]!.url).toBe(`${API_BASE_PATH}/join-info?code=AB%20CD`);
    expect(calls[0]!.init.method).toBe('GET');
    expect((calls[0]!.init.headers as Record<string, string>)[CSRF_HEADER]).toBeUndefined();
  });

  it('places a join request via POST /api/join-requests with the code body and CSRF header', async () => {
    const body: JoinRequestResponseDto = {
      joinRequest: {
        id: 'r1',
        groupId: 'g1',
        requester: { id: 'u2', displayName: 'Iris' },
        status: 'PENDING',
        createdAt: '2026-09-28T00:00:00.000Z',
      },
    };
    const { groups, calls } = makeApi([jsonResponse(201, body)]);

    await expect(groups.placeJoinRequest('ABCD1234')).resolves.toEqual(body);
    expect(calls[0]!.url).toBe(`${API_BASE_PATH}/join-requests`);
    expect(calls[0]!.init.method).toBe('POST');
    expect((calls[0]!.init.headers as Record<string, string>)[CSRF_HEADER]).toBe(CSRF_HEADER_VALUE);
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ code: 'ABCD1234' });
  });

  it('lists pending requests via GET /api/groups/:groupId/join-requests, encoding the group id', async () => {
    const body: JoinRequestsResponseDto = { requests: [] };
    const { groups, calls } = makeApi([jsonResponse(200, body)]);

    await expect(groups.pendingRequests('g 1')).resolves.toEqual(body);
    expect(calls[0]!.url).toBe(`${API_BASE_PATH}/groups/g%201/join-requests`);
    expect(calls[0]!.init.method).toBe('GET');
  });

  it('approves a request via POST /api/join-requests/:requestId/approve with the CSRF header', async () => {
    const body: JoinRequestResponseDto = { joinRequest: { id: 'r 1', groupId: 'g1', requester: { id: 'u2', displayName: 'Iris' }, status: 'APPROVED', createdAt: '2026-09-28T00:00:00.000Z' } };
    const { groups, calls } = makeApi([jsonResponse(200, body)]);

    await expect(groups.approveRequest('r 1')).resolves.toEqual(body);
    expect(calls[0]!.url).toBe(`${API_BASE_PATH}/join-requests/r%201/approve`);
    expect(calls[0]!.init.method).toBe('POST');
    expect((calls[0]!.init.headers as Record<string, string>)[CSRF_HEADER]).toBe(CSRF_HEADER_VALUE);
  });

  it('rejects a request via POST /api/join-requests/:requestId/reject with the CSRF header', async () => {
    const body: JoinRequestResponseDto = { joinRequest: { id: 'r1', groupId: 'g1', requester: { id: 'u2', displayName: 'Iris' }, status: 'REJECTED', createdAt: '2026-09-28T00:00:00.000Z', decidedAt: '2026-09-28T00:00:01.000Z' } };
    const { groups, calls } = makeApi([jsonResponse(200, body)]);

    await expect(groups.rejectRequest('r1')).resolves.toEqual(body);
    expect(calls[0]!.url).toBe(`${API_BASE_PATH}/join-requests/r1/reject`);
    expect(calls[0]!.init.method).toBe('POST');
    expect((calls[0]!.init.headers as Record<string, string>)[CSRF_HEADER]).toBe(CSRF_HEADER_VALUE);
  });
});
