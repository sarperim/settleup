/**
 * `/` page — groups overview (UC-ACC-002 step 3; UC-GRP-001 entry point;
 * 03-api-design.md §6, FR-GRP-009).
 *
 * Lists the caller's memberships (`GET /api/groups`) and hosts the create-group
 * entry point: choosing "Create group" reveals a name field, and submitting
 * calls `POST /api/groups` then navigates to the new group's view (the group
 * view shows the creator's join code — FR-GRP-002). An empty overview is a
 * valid state (test plan TC-GRP-005). The overview never renders group data the
 * caller is not a member of — the API only ever returns the caller's own
 * groups.
 *
 * It also hosts the join-by-code entry (UC-GRP-002 step 1 "entering the code",
 * PG-005): a code input that navigates to the existing `/join/:code` route,
 * where PG-009 resolves the code and shows the group's name before confirming.
 * No route-table change is involved; an unknown code is surfaced by the join
 * page's code-not-found state (FR-GRP-004), not here.
 *
 * Structure is frozen by PG-005; the TKT-ui-015 restyle regroups the page into
 * the board-04 layout (title + lede, group cards, create/join cards, empty
 * state) without changing any action, label, role or testid. The reference
 * shows the create card in its *open* state; the shipped interaction keeps the
 * reveal-then-submit flow the TBs pin (TC-GRP-026). Copy the reference would
 * change but a frozen assertion pins (the create submit "Create", the join
 * submit "Join", the empty-state line) is kept and routed back as a delta.
 */

import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FIELD_LIMITS, type GroupDto } from 'shared';

import { groupsApi } from '../api/groups';
import { ApiError } from '../api/errors';
import { SPA_ROUTES } from '../routes';
import './GroupsOverviewPage.css';

/** Short "Mon D" date for a group card's meta line (reference: "updated Aug 18"). */
function formatCreated(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * The creator's initial for the card avatar. The overview read is not obliged
 * to carry a resolved display name, so an unresolved creator degrades to a
 * neutral glyph rather than an empty bubble.
 */
function creatorInitial(group: GroupDto): string {
  const name = group.creator.displayName.trim();
  return name.length > 0 ? name.slice(0, 1).toUpperCase() : '?';
}

/** Card meta line — the group fields the overview contract actually carries. */
function creatorDetail(group: GroupDto): string {
  const name = group.creator.displayName.trim();
  const created = formatCreated(group.createdAt);
  const parts = [name.length > 0 ? `Created by ${name}` : 'Group'];
  if (created.length > 0) {
    parts.push(created);
  }
  return parts.join(' · ');
}

export function GroupsOverviewPage() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<GroupDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { groups: fetched } = await groupsApi.list();
        if (!cancelled) {
          setGroups(fetched);
        }
      } catch (caught) {
        if (!cancelled) {
          setLoadError(
            caught instanceof ApiError ? caught.message : 'Could not load your groups.',
          );
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
  }, []);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (
      trimmed.length < FIELD_LIMITS.groupName.minLength ||
      trimmed.length > FIELD_LIMITS.groupName.maxLength
    ) {
      setCreateError(
        `Group name must be ${FIELD_LIMITS.groupName.minLength}–${FIELD_LIMITS.groupName.maxLength} characters.`,
      );
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const { group } = await groupsApi.create(trimmed);
      // The creator lands on the group view, where the join code is shown
      // (FR-GRP-002).
      navigate(SPA_ROUTES.groupView(group.id));
    } catch (caught) {
      setCreateError(
        caught instanceof ApiError ? caught.message : 'Could not create the group. Please try again.',
      );
      setCreating(false);
    }
  }

  function onJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = joinCode.trim();
    if (trimmed.length === 0) {
      setJoinError('Enter a join code.');
      return;
    }
    setJoinError(null);
    // The join page (PG-009) resolves the code; an unknown code surfaces its
    // code-not-found state there (FR-GRP-004).
    navigate(SPA_ROUTES.join(trimmed));
  }

  return (
    <section className="groups-overview">
      <header className="groups-overview__heading">
        <div className="groups-overview__heading-text">
          <h1>Your groups</h1>
          <p className="groups-overview__lede muted">
            <span className="groups-overview__lede-desktop">
              Open a group to add expenses, check balances, and settle up.
            </span>
            <span className="groups-overview__lede-mobile">Open one to see what’s owed.</span>
          </p>
        </div>
        {!loading && loadError === null && groups.length > 0 && (
          <span className="groups-overview__summary">
            {groups.length} active group{groups.length === 1 ? '' : 's'}
          </span>
        )}
      </header>

      {loadError !== null && <p role="alert">{loadError}</p>}

      {loading ? (
        <p className="groups-overview__status muted">Loading your groups…</p>
      ) : groups.length === 0 ? (
        <div className="groups-overview__empty">
          <span className="groups-overview__empty-icon" aria-hidden="true">
            ✦
          </span>
          <h2>No groups yet</h2>
          {/* Frozen empty-state line (TC-GRP-027) — kept over the reference's
           * alternative copy and routed back as a delta. */}
          <p className="muted">You are not a member of any groups yet.</p>
          <button
            type="button"
            className="btn--secondary"
            onClick={() => {
              setShowCreate(true);
            }}
          >
            Create your first group
          </button>
        </div>
      ) : (
        <ul className="groups-overview__list" data-testid="groups-list">
          {groups.map((group) => (
            <li key={group.id} className="groups-overview__card">
              <div className="groups-overview__card-head">
                <div className="groups-overview__card-info">
                  {/* The name is the group link (TC-GRP-027); its stretched
                   * ::after makes the whole card open the group view. */}
                  <h2 className="groups-overview__card-name">
                    <Link to={SPA_ROUTES.groupView(group.id)}>{group.name}</Link>
                  </h2>
                  <p className="groups-overview__card-detail muted">{creatorDetail(group)}</p>
                </div>
                <span className="groups-overview__card-arrow" aria-hidden="true">
                  ↗
                </span>
              </div>
              <div className="groups-overview__card-foot">
                <span className="groups-overview__avatar" aria-hidden="true">
                  {creatorInitial(group)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="groups-overview__actions">
        <div className="groups-overview__panel">
          {showCreate ? (
            <form onSubmit={onCreate} noValidate aria-label="Create a group">
              <h2>Create group</h2>
              {createError !== null && <p role="alert">{createError}</p>}
              <div className="groups-overview__field">
                <label htmlFor="new-group-name">Group name</label>
                <input
                  id="new-group-name"
                  name="name"
                  type="text"
                  minLength={FIELD_LIMITS.groupName.minLength}
                  maxLength={FIELD_LIMITS.groupName.maxLength}
                  placeholder="e.g. Kaş weekend"
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                  }}
                />
              </div>
              <button type="submit" disabled={creating}>
                Create
              </button>
            </form>
          ) : (
            <>
              <h2>Create group</h2>
              <button
                type="button"
                onClick={() => {
                  setShowCreate(true);
                }}
              >
                Create group
              </button>
            </>
          )}
        </div>

        <div className="groups-overview__panel">
          <form onSubmit={onJoin} noValidate aria-label="Join a group by code">
            <h2>Have a code?</h2>
            {joinError !== null && <p role="alert">{joinError}</p>}
            <div className="groups-overview__field">
              <label htmlFor="join-code">Join code</label>
              <input
                id="join-code"
                name="code"
                type="text"
                autoComplete="off"
                placeholder="e.g. KAS-7Q2"
                value={joinCode}
                onChange={(event) => {
                  setJoinCode(event.target.value);
                }}
              />
              <p className="groups-overview__hint muted">Codes are shared by the group creator.</p>
            </div>
            <button type="submit" className="btn--secondary">
              Join
              <span aria-hidden="true">→</span>
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
