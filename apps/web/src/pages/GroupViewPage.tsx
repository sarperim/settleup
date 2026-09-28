/**
 * `/groups/:groupId` page — group view (TKT-groups-004; 03-api-design.md §6).
 *
 * Tab scaffold for the four §6 sections (Expenses / Balances / Settle-up /
 * Members). The **Members** tab is functional here: it lists the group's
 * members by display name (never email — FR-ACC-008) with a creator marker,
 * from `GET /api/groups/:groupId/members` (UC-GRP-005, FR-GRP-010). The
 * Expenses / Balances / Settle-up tabs stay labelled placeholders until their
 * domain UI tickets land. The group's name and — for the creator only — its
 * join code come from `GET /api/groups/:groupId` (FR-GRP-002).
 */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { GroupDto, MemberDto } from 'shared';

import { groupsApi } from '../api/groups';
import { ApiError } from '../api/errors';
import { GROUP_TABS, GROUP_TAB_LABELS, type GroupTab } from '../routes';

const TAB_PLACEHOLDERS: Record<Exclude<GroupTab, 'members'>, string> = {
  expenses: 'Group ledger placeholder.',
  balances: 'Per-member balances placeholder.',
  'settle-up': 'Settle-up suggestions placeholder.',
};

export function GroupViewPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const [activeTab, setActiveTab] = useState<GroupTab>('expenses');
  const [group, setGroup] = useState<GroupDto | null>(null);
  const [members, setMembers] = useState<MemberDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
        ) : (
          <ul data-testid="member-list">
            {members.map((member) => (
              <li key={member.id} data-testid="member-item">
                <span>{member.displayName}</span>
                {member.isCreator && <span data-testid="member-creator-badge">Creator</span>}
              </li>
            ))}
          </ul>
        )
      ) : (
        <p>{TAB_PLACEHOLDERS[activeTab]}</p>
      )}
    </section>
  );
}
