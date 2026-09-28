/**
 * `/groups/:groupId` page — group view (TKT-groups-004; extended by
 * TKT-groups-006; 03-api-design.md §6).
 *
 * Tab scaffold for the four §6 sections (Expenses / Balances / Settle-up /
 * Members). The **Members** tab is functional here: it lists the group's
 * members by display name (never email — FR-ACC-008) with a creator marker,
 * from `GET /api/groups/:groupId/members` (UC-GRP-005, FR-GRP-010). The
 * Expenses / Balances / Settle-up tabs stay labelled placeholders until their
 * domain UI tickets land. The group's name and — for the creator only — its
 * join code come from `GET /api/groups/:groupId` (FR-GRP-002).
 *
 * The **join-request handling view** (TKT-groups-006) lives inside this page:
 * when the caller is the group's creator, a "Join requests" section lists the
 * pending requests by display name with Approve / Reject actions
 * (`GET /api/groups/:groupId/join-requests`, approve/reject — UC-GRP-003/004,
 * FR-GRP-005/006/007). It is a page region, not a §6 tab, so the pinned tab
 * scaffold is unchanged.
 *
 * State resets at the start of the load effect so a `groupId`-only route
 * transition (React Router reuses the element) never shows the previous
 * group's name/join code/members (PR #17 K-2 / S-1) and starts on the default
 * tab.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { GroupDto, JoinRequestDto, MemberDto } from 'shared';

import { groupsApi } from '../api/groups';
import { ApiError } from '../api/errors';
import { useAuth } from '../auth/AuthContext';
import { GROUP_TABS, GROUP_TAB_LABELS, type GroupTab } from '../routes';

const TAB_PLACEHOLDERS: Record<Exclude<GroupTab, 'members'>, string> = {
  expenses: 'Group ledger placeholder.',
  balances: 'Per-member balances placeholder.',
  'settle-up': 'Settle-up suggestions placeholder.',
};

export function GroupViewPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<GroupTab>('expenses');
  const [group, setGroup] = useState<GroupDto | null>(null);
  const [members, setMembers] = useState<MemberDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [requests, setRequests] = useState<JoinRequestDto[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  // The server returns `joinCode` iff the caller is the creator (FR-GRP-002);
  // the caller's own id compared with `group.creator.id` is the same signal
  // from the detail payload and gates the creator-only handling section.
  const isCreator = group !== null && user !== null && group.creator.id === user.id;

  useEffect(() => {
    // Reset per-group state: a param-only transition must not display the
    // previous group's data (PR #17 K-2 / S-1).
    setGroup(null);
    setMembers([]);
    setError(null);
    setLoading(true);
    setActiveTab('expenses');
    setRequests([]);
    setRequestsError(null);

    if (groupId === undefined) {
      setError('Missing group id.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [groupResponse, membersResponse] = await Promise.all([
          groupsApi.detail(groupId),
          groupsApi.members(groupId),
        ]);
        if (!cancelled) {
          setGroup(groupResponse.group);
          setMembers(membersResponse.members);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof ApiError ? caught.message : 'Could not load this group.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  useEffect(() => {
    if (!isCreator || groupId === undefined) {
      return;
    }
    let cancelled = false;
    setRequests([]);
    setRequestsLoading(true);
    setRequestsError(null);
    void (async () => {
      try {
        const { requests: fetched } = await groupsApi.pendingRequests(groupId);
        if (!cancelled) {
          setRequests(fetched);
        }
      } catch (caught) {
        if (!cancelled) {
          setRequestsError(
            caught instanceof ApiError ? caught.message : 'Could not load join requests.',
          );
        }
      } finally {
        if (!cancelled) {
          setRequestsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [groupId, isCreator]);

  async function decide(requestId: string, decision: 'APPROVED' | 'REJECTED') {
    if (groupId === undefined) {
      return;
    }
    setDecidingId(requestId);
    setRequestsError(null);
    try {
      if (decision === 'APPROVED') {
        await groupsApi.approveRequest(requestId);
      } else {
        await groupsApi.rejectRequest(requestId);
      }
      // Refresh both surfaces: the request leaves the pending list and — on
      // approval — the new member joins the member list (FR-GRP-006/010).
      const [requestsResponse, membersResponse] = await Promise.all([
        groupsApi.pendingRequests(groupId),
        groupsApi.members(groupId),
      ]);
      setRequests(requestsResponse.requests);
      setMembers(membersResponse.members);
    } catch (caught) {
      setRequestsError(
        caught instanceof ApiError ? caught.message : 'Could not update the join request.',
      );
    } finally {
      setDecidingId(null);
    }
  }

  return (
    <section>
      <h1>{group?.name ?? 'Group'}</h1>
      {error !== null && <p role="alert">{error}</p>}
      {group?.joinCode !== undefined && (
        <p>
          Join code: <code data-testid="join-code">{group.joinCode}</code>
        </p>
      )}

      <nav aria-label="Group sections">
        {GROUP_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            aria-pressed={activeTab === tab}
            onClick={() => {
              setActiveTab(tab);
            }}
          >
            {GROUP_TAB_LABELS[tab]}
          </button>
        ))}
      </nav>
      <h2>{GROUP_TAB_LABELS[activeTab]}</h2>

      {activeTab === 'members' ? (
        loading ? (
          <p>Loading members…</p>
        ) : error === null ? (
          <ul data-testid="member-list">
            {members.map((member) => (
              <li key={member.id} data-testid="member-item">
                <span>{member.displayName}</span>
                {member.isCreator && <span data-testid="member-creator-badge">Creator</span>}
              </li>
            ))}
          </ul>
        ) : null
      ) : (
        <p>{TAB_PLACEHOLDERS[activeTab]}</p>
      )}

      {isCreator && (
        <section id="join-requests" aria-labelledby="join-requests-heading">
          <h2 id="join-requests-heading">Join requests</h2>
          {requestsError !== null && <p role="alert">{requestsError}</p>}
          {requestsLoading ? (
            <p>Loading join requests…</p>
          ) : requests.length === 0 ? (
            <p data-testid="join-requests-empty">No pending join requests.</p>
          ) : (
            <ul data-testid="join-request-list">
              {requests.map((request) => (
                <li key={request.id} data-testid="join-request-item">
                  <span>{request.requester.displayName}</span>
                  <button
                    type="button"
                    disabled={decidingId === request.id}
                    onClick={() => {
                      void decide(request.id, 'APPROVED');
                    }}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={decidingId === request.id}
                    onClick={() => {
                      void decide(request.id, 'REJECTED');
                    }}
                  >
                    Reject
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </section>
  );
}
