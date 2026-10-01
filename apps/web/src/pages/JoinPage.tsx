/**
 * `/join/:code` page — join-by-code confirmation (TKT-groups-006;
 * UC-GRP-002, 03-api-design.md §6).
 *
 * Resolves the code through `GET /api/join-info` and shows the group's name
 * before the user confirms (UC-GRP-002 steps 1–2 — the code holder learns the
 * name and nothing else, FR-GRP-004). Confirming places the request via
 * `POST /api/join-requests` (FR-GRP-003): membership takes effect only when
 * the creator approves (BR-GRP-004). A previously rejected user may revisit
 * this page and re-request; the API flips the existing row back to `PENDING`
 * (FR-GRP-011, BR-GRP-010), so the page never blocks a re-request. An unknown
 * or malformed code surfaces the API's `CODE_NOT_FOUND` (FR-GRP-004).
 */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { JoinInfoDto } from 'shared';

import { groupsApi } from '../api/groups';
import { ApiError } from '../api/errors';
import './JoinPage.css';

type Phase = 'loading' | 'resolved' | 'code-not-found' | 'error';

export function JoinPage() {
  const { code } = useParams<{ code: string }>();
  const [phase, setPhase] = useState<Phase>('loading');
  const [info, setInfo] = useState<JoinInfoDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [alreadyMember, setAlreadyMember] = useState(false);

  useEffect(() => {
    if (code === undefined) {
      setError('Missing join code.');
      setPhase('error');
      return;
    }
    let cancelled = false;
    setPhase('loading');
    setInfo(null);
    setError(null);
    setSubmitted(false);
    setAlreadyMember(false);
    void (async () => {
      try {
        const resolved = await groupsApi.joinInfo(code);
        if (!cancelled) {
          setInfo(resolved);
          setPhase('resolved');
        }
      } catch (caught) {
        if (cancelled) {
          return;
        }
        if (caught instanceof ApiError && caught.code === 'CODE_NOT_FOUND') {
          setPhase('code-not-found');
        } else {
          setError(caught instanceof ApiError ? caught.message : 'Could not resolve this join code.');
          setPhase('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  async function onConfirm() {
    if (code === undefined) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await groupsApi.placeJoinRequest(code);
      setSubmitted(true);
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'PENDING_REQUEST_EXISTS') {
        // Still a live request for this (user, group) — the pending message is
        // the same as a fresh submit.
        setSubmitted(true);
      } else if (caught instanceof ApiError && caught.code === 'ALREADY_MEMBER') {
        setAlreadyMember(true);
      } else {
        setError(caught instanceof ApiError ? caught.message : 'Could not place your join request.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (phase === 'loading') {
    return (
      <section className="join-page card">
        <h1 className="join-page__title">Join group</h1>
        <p role="status" className="join-page__state">
          Resolving join code…
        </p>
      </section>
    );
  }

  if (phase === 'code-not-found') {
    return (
      <section className="join-page card">
        <h1 className="join-page__title">Join group</h1>
        <p role="alert" className="join-page__state">
          This join code does not match any group.
        </p>
      </section>
    );
  }

  if (phase === 'error' || info === null) {
    return (
      <section className="join-page card">
        <h1 className="join-page__title">Join group</h1>
        <p role="alert" className="join-page__state">
          {error ?? 'Could not resolve this join code.'}
        </p>
      </section>
    );
  }

  return (
    <section className="join-page card">
      <h1 className="join-page__title">Join group</h1>
      <p className="join-page__lede">
        You are joining{' '}
        <strong className="join-page__name" data-testid="join-group-name">{info.groupName}</strong>.
      </p>

      {error !== null && (
        <p role="alert" className="join-page__state">
          {error}
        </p>
      )}

      {alreadyMember ? (
        <p data-testid="join-already-member" className="join-page__state muted">
          You are already a member of this group.
        </p>
      ) : submitted ? (
        <p
          data-testid="join-request-pending"
          role="status"
          className="alert alert--success join-page__state"
        >
          Your request to join {info.groupName} is pending the creator&apos;s approval.
        </p>
      ) : (
        <div className="join-page__actions">
          <button type="button" onClick={() => void onConfirm()} disabled={submitting}>
            Request to join
          </button>
        </div>
      )}
    </section>
  );
}
