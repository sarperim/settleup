/**
 * `/groups/:groupId/expenses/:expenseId/edit` — edit-expense form
 * (TKT-exp-006; 1:1 restyle TKT-ui-018; UC-EXP-002, 03-api-design.md §6
 * edit-expense row).
 *
 * The form is a **single screen** (no wizard steps), prefilled from the
 * expense detail (`GET …/expenses/:expenseId`): description, amount, payer,
 * participants and split type all default to the stored expense, and an EXACT
 * split prefills each participant's amount from the stored shares. Saving
 * issues a `PATCH` and returns to the group view, where the updated expense is
 * visible in the ledger.
 *
 * Structure is frozen by PG-008; the TKT-ui-018 restyle reproduces board 07
 * "Edit Expense" (file `XzY4HLCoW70yfI9NgeLXqC`; desktop layout `2:25593`,
 * mobile layout `2:25793`): the group / expense / edit **breadcrumb** above a
 * 568px (desktop) / fluid (mobile) card carrying the heading + lede, the
 * three-up / stacked core fields, chip participants with a selection count, the
 * segmented split toggle, the equal-share hint (or the exact-amounts grid with
 * a remaining figure), the primary save action with its abandon sibling and a
 * return note.
 *
 * Iteration-3 design-pinned additions (PG-008): the breadcrumb, and the
 * logger-only **permission-denied state card** — denial is rendered in-page as
 * a badge + message, never as a redirect. The board's state catalog (prefilled,
 * exact-split with inline errors, permission-denied) is rendered one state at a
 * time; the success state is the navigation back to the group ledger.
 *
 * Affordance enforcement is a UI, not a security, boundary: only the logger
 * sees the entry point to this page (BR-EXP-007's UI aspect). The API itself
 * returns `403 NOT_LOGGER` to any other member, so a hand-typed URL fails
 * closed — presented here as the in-page permission-denied card. Member
 * references are display names only (FR-ACC-008).
 *
 * Copy that existing e2e TCs assert is preserved even where the reference
 * differs (the ticket's "keep the string, route the delta back" rule): the
 * payer label stays **Payer** (`getByLabel('Payer')`) and the submit stays
 * **Save changes** (`getByRole('button', { name: 'Save changes' })`). The
 * exact-amounts group keeps the accessible name **Exact amounts**. This is
 * presentation only — the submit payload, validation and route behaviour are
 * unchanged.
 */

import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FIELD_LIMITS, type EditExpenseRequestDto, type Kurus, type MemberDto, type SplitType } from 'shared';

import './EditExpensePage.css';

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

function InfoIcon() {
  return (
    <svg
      className="edit-expense__alert-icon"
      viewBox="0 0 17 17"
      width="17"
      height="17"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="8.5" cy="8.5" r="7" fill="none" stroke="currentColor" strokeWidth="1" />
      <path d="M8.5 7.6v4.6M8.5 4.7v.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg
      className="edit-expense__alert-icon"
      viewBox="0 0 17 17"
      width="17"
      height="17"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="8.5" cy="8.5" r="7" fill="none" stroke="currentColor" strokeWidth="1" />
      <path d="M8.5 4.7v4.6M8.5 12.2v.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      className="edit-expense__check"
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

export function EditExpensePage() {
  const { groupId, expenseId } = useParams<{ groupId: string; expenseId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [members, setMembers] = useState<MemberDto[]>([]);
  const [groupName, setGroupName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [loggerName, setLoggerName] = useState<string | null>(null);

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
    // Reset per-expense state: a param-only transition must not display the
    // previous expense's values (PR #17 K-2 / S-1; review exp-005 C-2).
    setMembers([]);
    setGroupName(null);
    setDescription('');
    setAmountText('');
    setPayerId('');
    setParticipantIds([]);
    setSplitType('EQUAL');
    setExactTexts({});
    setErrors({});
    setSubmitError(null);
    setLoading(true);
    setLoadError(null);
    setDenied(false);
    setLoggerName(null);

    if (groupId === undefined || expenseId === undefined) {
      setLoadError('Missing group or expense id.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        // Members gate the form; the group name only dresses the breadcrumb, so
        // it is best-effort and never blocks the single-screen form.
        const [membersResult, expenseResult, groupResult] = await Promise.allSettled([
          groupsApi.members(groupId),
          expensesApi.detail(groupId, expenseId),
          groupsApi.detail(groupId),
        ]);
        if (cancelled) {
          return;
        }
        if (groupResult.status === 'fulfilled') {
          setGroupName(groupResult.value.group.name);
        }
        if (expenseResult.status === 'rejected') {
          const reason: unknown = expenseResult.reason;
          if (reason instanceof ApiError && (reason.code === 'NOT_LOGGER' || reason.status === 403)) {
            // Iteration-3 design-pinned addition: denial is an in-page state.
            setDenied(true);
            return;
          }
          throw reason;
        }
        if (membersResult.status === 'rejected') {
          throw membersResult.reason;
        }
        const { expense } = expenseResult.value;
        setMembers(membersResult.value.members);
        setDescription(expense.description);
        // The detail read is open to any group member, but PG-008 restricts
        // editing to the logger (BR-EXP-007). A non-logger arriving at this
        // route sees the in-page permission-denied state, never the form.
        if (user !== null && expense.logger.id !== user.id) {
          setLoggerName(expense.logger.displayName);
          setDenied(true);
          return;
        }
        setAmountText(formatKurus(expense.amountKurus as Kurus));
        setPayerId(expense.payer.id);
        setParticipantIds(expense.shares.map((share) => share.participant.id));
        setSplitType(expense.splitType);
        if (expense.splitType === 'EXACT') {
          setExactTexts(
            Object.fromEntries(
              expense.shares.map((share) => [
                share.participant.id,
                formatKurus(share.shareKurus as Kurus),
              ]),
            ),
          );
        }
      } catch (caught) {
        if (!cancelled) {
          setLoadError(caught instanceof ApiError ? caught.message : 'Could not load this expense.');
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
  }, [groupId, expenseId, user]);

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
    if (groupId === undefined || expenseId === undefined) {
      return;
    }
    const validation = validate();
    if (!validation.ok) {
      return;
    }

    const body: EditExpenseRequestDto = {
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
      await expensesApi.update(groupId, expenseId, body);
      // Back to the group view, where the updated expense is visible.
      navigate(SPA_ROUTES.groupView(groupId));
    } catch (caught) {
      setSubmitError(
        caught instanceof ApiError ? caught.message : 'Could not save the expense. Please try again.',
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
  const exactSum = participantIds.reduce((sum, id) => {
    const raw = (exactTexts[id] ?? '').trim();
    const parsed = parseKurus(raw === '' ? '0' : raw);
    return sum + (parsed.ok ? parsed.value : 0);
  }, 0);
  const remainingKurus = parsedAmount.ok ? parsedAmount.value - exactSum : 0;

  const breadcrumbExpense = description.trim() === '' ? 'Expense' : description;

  return (
    <section className="edit-expense">
      {loading ? (
        <p>Loading expense…</p>
      ) : (
        <>
          <nav className="edit-expense__breadcrumb" aria-label="Breadcrumb">
            <Link className="edit-expense__crumb-link" to={SPA_ROUTES.groupView(groupId ?? '')}>
              {groupName ?? 'Group'}
            </Link>
            <span className="edit-expense__crumb-sep" aria-hidden="true">
              /
            </span>
            <span className="edit-expense__crumb-mid">{breadcrumbExpense}</span>
            <span className="edit-expense__crumb-sep" aria-hidden="true">
              /
            </span>
            <span className="edit-expense__crumb-current" aria-current="page">
              Edit
            </span>
          </nav>

          {denied ? (
            <div className="edit-expense__denied" role="alert">
              <div className="edit-expense__denied-head">
                <span className="edit-expense__denied-label">Permission</span>
                <span className="edit-expense__denied-badge">Author only</span>
              </div>
              <p className="edit-expense__denied-message">
                {loggerName !== null
                  ? `Only ${loggerName}, the expense author, can reach this screen. Other members do not see the Edit action.`
                  : 'Only the member who logged this expense can edit it. Other members do not see the Edit action.'}
              </p>
            </div>
          ) : loadError !== null ? (
            <p role="alert">{loadError}</p>
          ) : (
            <form
              onSubmit={onSubmit}
              noValidate
              aria-label="Edit an expense"
              className="edit-expense__form"
            >
              {submitError !== null && <p role="alert">{submitError}</p>}

              <div className="edit-expense__heading">
                <h1 className="edit-expense__title">Edit expense</h1>
                <p className="edit-expense__lede">
                  Update the details below. Changes will be marked as edited.
                </p>
              </div>

              <div className="edit-expense__core">
                <div className="edit-expense__field">
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
                    <p
                      className="edit-expense__field-error"
                      data-testid="description-error"
                      role="alert"
                    >
                      {errors.description}
                    </p>
                  )}
                </div>

                <div className="edit-expense__field">
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
                    <p className="edit-expense__field-error" data-testid="amount-error" role="alert">
                      {errors.amount}
                    </p>
                  )}
                </div>

                <div className="edit-expense__field">
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
                    <p className="edit-expense__field-error" data-testid="payer-error" role="alert">
                      {errors.payer}
                    </p>
                  )}
                </div>
              </div>

              <div className="edit-expense__participants">
                <div className="edit-expense__participants-head">
                  <span className="edit-expense__label">Participants</span>
                  <span className="edit-expense__selection">
                    {allSelected
                      ? `All ${members.length} selected`
                      : `${participantIds.length} selected`}
                  </span>
                </div>
                <div className="edit-expense__choices">
                  {members.map((member) => (
                    <label className="edit-expense__choice" key={member.id}>
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
                  <p className="edit-expense__field-error" data-testid="participants-error" role="alert">
                    {errors.participants}
                  </p>
                )}
              </div>

              <fieldset className="edit-expense__split">
                <legend className="edit-expense__label">Split</legend>
                <div className="edit-expense__segmented">
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
                <p className="alert alert--info edit-expense__hint">
                  <InfoIcon />
                  <span>
                    Equal split: ₺{formatKurus(shareKurus as Kurus)} each for {participantIds.length}{' '}
                    participants.
                  </span>
                </p>
              )}

              {splitType === 'EXACT' && (
                <div className="edit-expense__exact-group" role="group" aria-label="Exact amounts">
                  <div className="edit-expense__exact-head">
                    <span className="edit-expense__exact-label">Exact amounts per participant</span>
                    <span
                      className={
                        remainingKurus === 0
                          ? 'edit-expense__remaining edit-expense__remaining--settled'
                          : 'edit-expense__remaining'
                      }
                    >
                      ₺{formatKurus(Math.abs(remainingKurus) as Kurus)} remaining
                    </span>
                  </div>
                  <div className="edit-expense__exact">
                    {members
                      .filter((member) => participantIds.includes(member.id))
                      .map((member) => (
                        <div className="edit-expense__exact-row" key={member.id}>
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
                    <p className="alert edit-expense__exact-alert" data-testid="exact-error" role="alert">
                      <AlertIcon />
                      <span>{errors.exact}</span>
                    </p>
                  )}
                </div>
              )}

              <div className="edit-expense__actions">
                <Link
                  className="btn btn--secondary edit-expense__cancel"
                  to={SPA_ROUTES.groupView(groupId ?? '')}
                >
                  Cancel
                </Link>
                <button type="submit" className="edit-expense__submit" disabled={submitting}>
                  Save changes
                </button>
              </div>
              <p className="edit-expense__return muted">Save returns to Expenses.</p>
            </form>
          )}
        </>
      )}
    </section>
  );
}
