/**
 * `/groups/:groupId/expenses/new` — add-expense form (TKT-exp-005; 1:1 restyle
 * TKT-ui-017; UC-EXP-001, 03-api-design.md §6 add-expense row).
 *
 * The SC-003 / NFR-EXP-001 critical path: a **single screen** where
 * participants default to **all members** (preselected) and the payer defaults
 * to the **acting user**, so the common case is description + amount + submit.
 * Split type toggles EQUAL / EXACT; EXACT reveals a per-participant amount
 * input. Validation is client-side (`parseKurus`, shared `FIELD_LIMITS`) with
 * inline errors and **no round-trips until submit** — the API is called only
 * when the form is valid (BR-EXP-010, BR-EXP-006).
 *
 * Structure is frozen by PG-007; the TKT-ui-017 restyle reproduces board 06
 * "Add Expense" (file `XzY4HLCoW70yfI9NgeLXqC`; desktop layout `2:25213`,
 * mobile layout `2:25401`) — a breadcrumb, the card heading + lede, a
 * three-up / stacked core-fields row, chip participants with a selection
 * count, a segmented split toggle, an equal-share hint (or the exact-amounts
 * grid with a remaining figure), the primary action and a return note.
 *
 * Copy that existing e2e TCs assert is preserved even where the reference
 * differs (the ticket's "keep the string, route the delta back" rule): the
 * payer label stays **Payer** (`getByLabel('Payer')`), the submit stays
 * **Save expense** (`getByRole('button', { name: 'Save expense' })`) and the
 * exact-amounts group keeps the accessible name **Exact amounts**
 * (`getByRole('group', { name: 'Exact amounts' })`). The payer option text also
 * stays the bare display name — a "(me)" suffix would break TC-EXP-028's
 * `toHaveText('Sara')`. Member references are display names only (FR-ACC-008);
 * the created expense is logged by the acting user and paid by the selected
 * member (BR-EXP-001/002).
 */

import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  FIELD_LIMITS,
  KURUS_STORAGE_BOUND,
  type CreateExpenseRequestDto,
  type Kurus,
  type MemberDto,
  type SplitType,
} from 'shared';

import './AddExpensePage.css';

import { expensesApi } from '../api/expenses';
import { groupsApi } from '../api/groups';
import { ApiError } from '../api/errors';
import { useAuth } from '../auth/AuthContext';
import { formatKurus, parseKurus } from '../money';
import { SPA_ROUTES } from '../routes';

interface FieldErrors {
  description?: string;
  amount?: string;
  payer?: string;
  participants?: string;
  exact?: string;
}

/** Alert glyph; `variant="info"` moves the dot to the top (info mark). */
function AlertIcon({ variant = 'alert' }: { variant?: 'info' | 'alert' }) {
  return (
    <svg
      className="add-expense__alert-icon"
      viewBox="0 0 17 17"
      width="17"
      height="17"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="8.5" cy="8.5" r="7" fill="none" stroke="currentColor" strokeWidth="1" />
      <path
        d={variant === 'info' ? 'M8.5 7.6v4.6M8.5 4.7v.2' : 'M8.5 4.7v4.6M8.5 12.2v.2'}
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      className="add-expense__check"
      viewBox="0 0 13 13"
      width="13"
      height="13"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M2.4 6.9 5.1 9.6 10.6 4.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AddExpensePage() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [members, setMembers] = useState<MemberDto[]>([]);
  const [groupName, setGroupName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [description, setDescription] = useState('');
  const [amountText, setAmountText] = useState('');
  const [payerId, setPayerId] = useState('');
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [splitType, setSplitType] = useState<SplitType>('EQUAL');
  const [exactTexts, setExactTexts] = useState<Record<string, string>>({});

  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (groupId === undefined) {
      setLoadError('Missing group id.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    // N-4: clear the previous group's name so a groupId change without a remount
    // never leaves a stale breadcrumb.
    setGroupName(null);
    void (async () => {
      try {
        // Members gate the form; the group name only dresses the breadcrumb, so
        // it is best-effort and never blocks the single-screen form.
        const [membersResult, detailResult] = await Promise.allSettled([
          groupsApi.members(groupId),
          groupsApi.detail(groupId),
        ]);
        if (cancelled) {
          return;
        }
        if (membersResult.status === 'rejected') {
          throw membersResult.reason;
        }
        const fetched = membersResult.value.members;
        setMembers(fetched);
        if (detailResult.status === 'fulfilled') {
          setGroupName(detailResult.value.group.name);
        }
        // NFR-EXP-001 enablers: every member participates by default, and the
        // acting user pays by default (falling back to the first member).
        setParticipantIds(fetched.map((member) => member.id));
        const acting = fetched.find((member) => member.id === user?.id);
        setPayerId(acting?.id ?? fetched[0]?.id ?? '');
      } catch (caught) {
        if (!cancelled) {
          setLoadError(caught instanceof ApiError ? caught.message : 'Could not load this group.');
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
  }, [groupId, user]);

  function toggleParticipant(memberId: string, checked: boolean) {
    setParticipantIds((current) =>
      checked ? [...current, memberId] : current.filter((id) => id !== memberId),
    );
  }

  /** Client-side validation; returns the parsed amount when valid (no I/O). */
  function validate(): { ok: true; amountKurus: number } | { ok: false } {
    const next: FieldErrors = {};
    const trimmed = description.trim();
    if (
      trimmed.length < FIELD_LIMITS.description.minLength ||
      trimmed.length > FIELD_LIMITS.description.maxLength
    ) {
      next.description = `Description must be ${FIELD_LIMITS.description.minLength}–${FIELD_LIMITS.description.maxLength} characters.`;
    }

    const amount = parseKurus(amountText);
    if (!amount.ok) {
      next.amount = 'Enter a valid amount, e.g. 12.50.';
    }

    if (payerId === '') {
      next.payer = 'Select a payer.';
    }
    if (participantIds.length === 0) {
      next.participants = 'Select at least one participant.';
    }

    if (amount.ok && splitType === 'EXACT' && participantIds.length > 0) {
      let sum = 0;
      let malformed = false;
      for (const id of participantIds) {
        const raw = (exactTexts[id] ?? '').trim();
        const parsed = parseKurus(raw === '' ? '0' : raw);
        if (!parsed.ok) {
          malformed = true;
          break;
        }
        sum += parsed.value;
      }
      if (malformed) {
        next.exact = 'Enter a valid amount for each participant.';
      } else if (sum !== amount.value) {
        next.exact = 'Exact amounts must sum to the total amount.';
      }
    }

    setErrors(next);
    if (Object.keys(next).length > 0 || !amount.ok) {
      return { ok: false };
    }
    return { ok: true, amountKurus: amount.value };
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (groupId === undefined) {
      return;
    }
    const validation = validate();
    if (!validation.ok) {
      return;
    }

    const body: CreateExpenseRequestDto = {
      description: description.trim(),
      amountKurus: validation.amountKurus,
      payerId,
      participantIds,
      splitType,
    };
    if (splitType === 'EXACT') {
      const exactAmounts: Record<string, number> = {};
      for (const id of participantIds) {
        const raw = (exactTexts[id] ?? '').trim();
        const parsed = parseKurus(raw === '' ? '0' : raw);
        if (parsed.ok) {
          exactAmounts[id] = parsed.value;
        }
      }
      body.exactAmounts = exactAmounts;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      await expensesApi.create(groupId, body);
      // Back to the group view, where the new expense is visible in the ledger.
      navigate(SPA_ROUTES.groupView(groupId));
    } catch (caught) {
      setSubmitError(
        caught instanceof ApiError ? caught.message : 'Could not add the expense. Please try again.',
      );
      setSubmitting(false);
    }
  }

  const allSelected = members.length > 0 && participantIds.length === members.length;
  const parsedAmount = parseKurus(amountText);
  const shareKurus =
    parsedAmount.ok && participantIds.length > 0
      ? Math.floor(parsedAmount.value / participantIds.length)
      : 0;

  // Exact entries are well-formed only when every participant parses (an empty
  // row is a valid zero). A malformed row must not be silently scored as 0 —
  // that would let the remaining figure read "settled" while validate() flags
  // the form (C-1).
  const exactParses = participantIds.map((id) => {
    const raw = (exactTexts[id] ?? '').trim();
    return parseKurus(raw === '' ? '0' : raw);
  });
  const exactMalformed = exactParses.some((parsed) => !parsed.ok);
  const exactSum = exactParses.reduce((sum, parsed) => sum + (parsed.ok ? parsed.value : 0), 0);

  // Signed derived difference (not a `Kurus`): it sums one per-participant
  // value, so its magnitude can exceed `KURUS_STORAGE_BOUND` even though every
  // individual input is bounded. `null` means "not computable yet" (the amount
  // is missing/invalid or an exact row is malformed) and must not be shown as
  // settled. B-1: formatting above-bound input throws, so the magnitude is
  // clamped before it reaches `formatKurus`.
  const remainingKurus =
    parsedAmount.ok && !exactMalformed ? parsedAmount.value - exactSum : null;
  const remainingState: 'settled' | 'remaining' | 'over' | 'pending' =
    remainingKurus === null
      ? 'pending'
      : remainingKurus === 0
        ? 'settled'
        : remainingKurus < 0
          ? 'over'
          : 'remaining';
  const remainingMagnitude =
    remainingKurus === null ? 0 : Math.min(Math.abs(remainingKurus), KURUS_STORAGE_BOUND);
  const remainingText =
    remainingState === 'pending'
      ? '— remaining'
      : remainingState === 'over'
        ? `₺${formatKurus(remainingMagnitude as Kurus)} over`
        : `₺${formatKurus(remainingMagnitude as Kurus)} remaining`;

  return (
    <section className="add-expense">
      {loadError !== null && <p role="alert">{loadError}</p>}
      {loading ? (
        <p>Loading members…</p>
      ) : loadError === null ? (
        <>
          <nav className="add-expense__breadcrumb" aria-label="Breadcrumb">
            <Link className="add-expense__crumb-link" to={SPA_ROUTES.groupView(groupId ?? '')}>
              {groupName ?? 'Group'}
            </Link>
            <span className="add-expense__crumb-sep" aria-hidden="true">
              /
            </span>
            <span className="add-expense__crumb-current" aria-current="page">
              Add expense
            </span>
          </nav>

          <form onSubmit={onSubmit} noValidate aria-label="Add an expense" className="add-expense__form">
            {submitError !== null && <p role="alert">{submitError}</p>}

            <div className="add-expense__heading">
              <h1 className="add-expense__title">Add expense</h1>
              <p className="add-expense__lede">
                A few details and you’re done — usually under 30 seconds.
              </p>
            </div>

            <div className="add-expense__core">
              <div className="add-expense__field">
                <label htmlFor="expense-description">Description</label>
                <input
                  id="expense-description"
                  name="description"
                  type="text"
                  maxLength={FIELD_LIMITS.description.maxLength}
                  aria-invalid={errors.description !== undefined}
                  value={description}
                  onChange={(event) => {
                    setDescription(event.target.value);
                  }}
                />
                {errors.description !== undefined && (
                  <p className="add-expense__field-error" data-testid="description-error" role="alert">
                    {errors.description}
                  </p>
                )}
              </div>

              <div className="add-expense__field">
                <label htmlFor="expense-amount">Amount in ₺</label>
                <input
                  id="expense-amount"
                  name="amount"
                  type="text"
                  inputMode="decimal"
                  aria-invalid={errors.amount !== undefined}
                  value={amountText}
                  onChange={(event) => {
                    setAmountText(event.target.value);
                  }}
                />
                {errors.amount !== undefined && (
                  <p className="add-expense__field-error" data-testid="amount-error" role="alert">
                    {errors.amount}
                  </p>
                )}
              </div>

              <div className="add-expense__field">
                <label htmlFor="expense-payer">Payer</label>
                <select
                  id="expense-payer"
                  name="payer"
                  aria-invalid={errors.payer !== undefined}
                  value={payerId}
                  onChange={(event) => {
                    setPayerId(event.target.value);
                  }}
                >
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.displayName}
                    </option>
                  ))}
                </select>
                {errors.payer !== undefined && (
                  <p className="add-expense__field-error" data-testid="payer-error" role="alert">
                    {errors.payer}
                  </p>
                )}
              </div>
            </div>

            <div className="add-expense__participants">
              <div className="add-expense__participants-head">
                <span className="add-expense__label">Participants</span>
                <span className="add-expense__selection">
                  {allSelected
                    ? `All ${members.length} selected`
                    : `${participantIds.length} selected`}
                </span>
              </div>
              <div className="add-expense__choices">
                {members.map((member) => (
                  <label className="add-expense__choice" key={member.id}>
                    <input
                      type="checkbox"
                      data-testid="participant-checkbox"
                      checked={participantIds.includes(member.id)}
                      onChange={(event) => {
                        toggleParticipant(member.id, event.target.checked);
                      }}
                    />
                    <CheckIcon />
                    {member.id === user?.id ? `${member.displayName} (me)` : member.displayName}
                  </label>
                ))}
              </div>
              {errors.participants !== undefined && (
                <p className="add-expense__field-error" data-testid="participants-error" role="alert">
                  {errors.participants}
                </p>
              )}
            </div>

            <fieldset className="add-expense__split">
              <legend className="add-expense__label">Split</legend>
              <div className="add-expense__segmented">
                <label>
                  <input
                    type="radio"
                    name="splitType"
                    value="EQUAL"
                    checked={splitType === 'EQUAL'}
                    onChange={() => {
                      setSplitType('EQUAL');
                    }}
                  />
                  Equal
                </label>
                <label>
                  <input
                    type="radio"
                    name="splitType"
                    value="EXACT"
                    checked={splitType === 'EXACT'}
                    onChange={() => {
                      setSplitType('EXACT');
                    }}
                  />
                  Exact
                </label>
              </div>
            </fieldset>

            {splitType === 'EQUAL' && (
              <p className="alert alert--info add-expense__hint">
                <AlertIcon variant="info" />
                <span>
                  Equal split: ₺{formatKurus(shareKurus as Kurus)} each for {participantIds.length}{' '}
                  participants. This updates when you enter the amount.
                </span>
              </p>
            )}

            {splitType === 'EXACT' && (
              <div className="add-expense__exact-group" role="group" aria-label="Exact amounts">
                <div className="add-expense__exact-head">
                  <span className="add-expense__exact-label">Exact amounts per participant</span>
                  <span
                    className={`add-expense__remaining${
                      remainingState === 'settled'
                        ? ' add-expense__remaining--settled'
                        : remainingState === 'pending'
                          ? ' add-expense__remaining--pending'
                          : ''
                    }`}
                  >
                    {remainingText}
                  </span>
                </div>
                <div className="add-expense__exact">
                  {members
                    .filter((member) => participantIds.includes(member.id))
                    .map((member) => (
                      <div className="add-expense__exact-row" key={member.id}>
                        <label htmlFor={`exact-${member.id}`}>{member.displayName}</label>
                        <input
                          id={`exact-${member.id}`}
                          data-testid={`exact-${member.id}`}
                          type="text"
                          inputMode="decimal"
                          aria-invalid={errors.exact !== undefined}
                          value={exactTexts[member.id] ?? ''}
                          onChange={(event) => {
                            setExactTexts((current) => ({
                              ...current,
                              [member.id]: event.target.value,
                            }));
                          }}
                        />
                      </div>
                    ))}
                </div>
                {errors.exact !== undefined && (
                  <p className="alert add-expense__exact-alert" data-testid="exact-error" role="alert">
                    <AlertIcon />
                    <span>{errors.exact}</span>
                  </p>
                )}
              </div>
            )}

            <div className="add-expense__actions">
              <button type="submit" className="add-expense__submit" disabled={submitting}>
                Save expense
              </button>
            </div>
            <p className="add-expense__return muted">Submit returns to the Expenses tab.</p>
          </form>
        </>
      ) : null}
    </section>
  );
}
