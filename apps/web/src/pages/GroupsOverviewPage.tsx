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
 */

import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FIELD_LIMITS, type GroupDto } from 'shared';

import { groupsApi } from '../api/groups';
import { ApiError } from '../api/errors';
import { SPA_ROUTES } from '../routes';

export function GroupsOverviewPage() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<GroupDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

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

  return (
    <section>
      <h1>Groups</h1>

      {loadError !== null && <p role="alert">{loadError}</p>}

      {loading ? (
        <p>Loading your groups…</p>
      ) : groups.length === 0 ? (
        <p>You are not a member of any groups yet.</p>
      ) : (
        <ul data-testid="groups-list">
          {groups.map((group) => (
            <li key={group.id}>
              <Link to={SPA_ROUTES.groupView(group.id)}>{group.name}</Link>
            </li>
          ))}
        </ul>
      )}

      {showCreate ? (
        <form onSubmit={onCreate} noValidate aria-label="Create a group">
          <h2>Create a group</h2>
          {createError !== null && <p role="alert">{createError}</p>}
          <label htmlFor="new-group-name">Group name</label>
          <input
            id="new-group-name"
            name="name"
            type="text"
            minLength={FIELD_LIMITS.groupName.minLength}
            maxLength={FIELD_LIMITS.groupName.maxLength}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
          />
          <button type="submit" disabled={creating}>
            Create
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => {
            setShowCreate(true);
          }}
        >
          Create group
        </button>
      )}
    </section>
  );
}
