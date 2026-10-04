/**
 * `/join/:code` page — join-by-code confirmation (TKT-groups-006;
 * UC-GRP-002, 03-api-design.md §6; 1:1 restyle TKT-ui-019).
 *
 * Resolves the code through `GET /api/join-info` and shows the group's name
 * before the user confirms (UC-GRP-002 steps 1–2 — the code holder learns the
 * name and nothing else, FR-GRP-004). Confirming places the request via
 * `POST /api/join-requests` (FR-GRP-003): membership takes effect only when
 * the creator approves (BR-GRP-004). A previously rejected user may revisit
 * this page and re-request; the API flips the existing row back to `PENDING`
 * (FR-GRP-011, BR-GRP-010), so the page never blocks a re-request. An unknown
 * or malformed code surfaces the API's `CODE_NOT_FOUND` (FR-GRP-004).
 *
 * Presentation is pinned to board 08 "Join by Code" (file key
 * `XzY4HLCoW70yfI9NgeLXqC`; desktop layout `2:25997`, content `2:26008`;
 * mobile layout `2:26087`): a raised card carrying the private-preview chip,
 * the group name (the only group detail shown before approval), a state alert
 * and the confirm action, with the privacy note beneath the card (PG-009
 * iteration-3 addition). The board renders its five request states side by
 * side as a catalog — scaffolding, never all on one page: this page shows the
 * one state the current request is in. No structural, testid, role or frozen
 * copy change (the code-not-found alert retains the frozen assertion string).
 */

import { useEffect, useState, type ReactElement } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { JoinInfoDto } from 'shared';

import './JoinPage.css';
import { groupsApi } from '../api/groups';
import { ApiError } from '../api/errors';
import { SPA_ROUTES } from '../routes';

type Phase = 'loading' | 'resolved' | 'code-not-found' | 'error';

/** The state of the confirm action within the resolved card (board 08). */
type RequestState = 'idle' | 'pending' | 'already-pending' | 'already-member';

/** Alert tone — the board's status colour families (styles/tokens.css). */
type Tone = 'info' | 'warning' | 'success' | 'danger';

/** Decorative icon set (board 08): lucide-style 24px viewBox geometry. */
function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function AlertCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  );
}

const TONE_ICONS: Record<Tone, () => ReactElement> = {
  info: InfoIcon,
  warning: ClockIcon,
  success: CheckCircleIcon,
  danger: AlertCircleIcon,
};

/** A themed card alert: an icon plus an optional title and a message. */
function JoinAlert({
  tone,
  title,
  text,
  testId,
}: {
  tone: Tone;
  title?: string;
  text: string;
  testId?: string;
}) {
  const Icon = TONE_ICONS[tone];
  return (
    <div
      className={`join-card__alert join-card__alert--${tone}`}
      data-testid={testId}
      role="status"
    >
      <span className="join-card__alert-icon">
        <Icon />
      </span>
      <div className="join-card__alert-message">
        {title !== undefined && <p className="join-card__alert-title">{title}</p>}
        <p className="join-card__alert-text">{text}</p>
      </div>
    </div>
  );
}

export function JoinPage() {
  const { code } = useParams<{ code: string }>();
  const [phase, setPhase] = useState<Phase>('loading');
  const [info, setInfo] = useState<JoinInfoDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [requestState, setRequestState] = useState<RequestState>('idle');

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
    setRequestState('idle');
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
      setRequestState('pending');
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'PENDING_REQUEST_EXISTS') {
        // A live request already exists for this (user, group) — board 08's
        // "Already pending" state, distinct from a fresh "Waiting" submittal.
        setRequestState('already-pending');
      } else if (caught instanceof ApiError && caught.code === 'ALREADY_MEMBER') {
        setRequestState('already-member');
      } else {
        setError(caught instanceof ApiError ? caught.message : 'Could not place your join request.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (phase === 'loading') {
    return (
      <section className="join-page">
        <div className="card join-card">
          <div className="join-card__preview">
            <UsersIcon />
          </div>
          <p role="status" className="join-card__description">
            Resolving join code…
          </p>
        </div>
      </section>
    );
  }

  if (phase === 'code-not-found') {
    return (
      <section className="join-page">
        <div className="card join-card">
          <div className="join-card__alert join-card__alert--danger">
            <span className="join-card__alert-icon">
              <AlertCircleIcon />
            </span>
            <div className="join-card__alert-message">
              <p className="join-card__alert-title">Code not found</p>
              {/* Frozen assertion string (TC-GRP-032): the design's richer
               * title/description copy is routed back, not adopted here. */}
              <p role="alert" className="join-card__alert-text">
                This join code does not match any group.
              </p>
            </div>
          </div>
          <Link
            to={SPA_ROUTES.groupsOverview}
            className="join-card__action join-card__action--secondary"
          >
            Try another code
          </Link>
        </div>
      </section>
    );
  }

  if (phase === 'error' || info === null) {
    return (
      <section className="join-page">
        <div className="card join-card">
          <div className="join-card__alert join-card__alert--danger">
            <span className="join-card__alert-icon">
              <AlertCircleIcon />
            </span>
            <p role="alert" className="join-card__alert-text">
              {error ?? 'Could not resolve this join code.'}
            </p>
          </div>
        </div>
      </section>
    );
  }

  const stateAlert =
    requestState === 'pending' ? (
      <JoinAlert
        tone="info"
        title="Waiting for approval"
        text="Your request was sent to the group creator."
        testId="join-request-pending"
      />
    ) : requestState === 'already-pending' ? (
      <JoinAlert
        tone="warning"
        title="Request already pending"
        text="There’s nothing else you need to do right now."
        testId="join-already-pending"
      />
    ) : requestState === 'already-member' ? (
      <JoinAlert
        tone="success"
        title="You’re already a member"
        text={`Open ${info.groupName} from Groups.`}
        testId="join-already-member"
      />
    ) : (
      <JoinAlert tone="info" text="The group creator will review your request." />
    );

  return (
    <section className="join-page">
      <div className="card join-card">
        <div className="join-card__preview">
          <UsersIcon />
        </div>
        <div className="join-card__heading">
          <h1 className="join-card__title" data-testid="join-group-name">
            {info.groupName}
          </h1>
          <p className="join-card__description">
            This is the only group detail shown before you’re approved.
          </p>
        </div>

        {error !== null ? (
          <p role="alert" className="alert">
            {error}
          </p>
        ) : (
          stateAlert
        )}

        {requestState === 'idle' && (
          <button
            type="button"
            className="join-card__action join-card__action--primary"
            onClick={() => void onConfirm()}
            disabled={submitting}
          >
            Request to join
          </button>
        )}

        {requestState === 'already-member' && (
          <Link
            to={SPA_ROUTES.groupView(info.groupId)}
            className="join-card__action join-card__action--secondary"
          >
            Open group
          </Link>
        )}
      </div>

      <p className="join-page__privacy">
        Member names, balances, and expenses stay hidden until approval.
      </p>
    </section>
  );
}
