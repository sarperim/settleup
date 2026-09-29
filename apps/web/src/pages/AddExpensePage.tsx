/**
 * `/groups/:groupId/expenses/new` — add-expense form (TKT-exp-005; UC-EXP-001,
 * 03-api-design.md §6 add-expense row).
 *
 * The SC-003 / NFR-EXP-001 critical path: a **single screen** where
 * participants default to **all members** (preselected) and the payer defaults
 * to the **acting user**, so the common case is description + amount + submit.
 * Split type toggles EQUAL / EXACT; EXACT reveals a per-participant amount
 * input. Validation is client-side (`parseKurus`, shared `FIELD_LIMITS`) with
 * inline errors and **no round-trips until submit** — the API is called only
 * when the form is valid (BR-EXP-010, BR-EXP-006).
 *
 * Member references are display names only (FR-ACC-008); the created expense is
 * logged by the acting user and paid by the selected member (BR-EXP-001/002).
 */

import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FIELD_LIMITS, type CreateExpenseRequestDto, type MemberDto, type SplitType } from 'shared';

import { expensesApi } from '../api/expenses';
import { groupsApi } from '../api/groups';
import { ApiError } from '../api/errors';
import { useAuth } from '../auth/AuthContext';
import { parseKurus } from '../money';
import { SPA_ROUTES } from '../routes';

interface FieldErrors {
  description?: string;
  amount?: string;
  payer?: string;
  participants?: string;
  exact?: string;
}

export function AddExpensePage() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [members, setMembers] = useState<MemberDto[]>([]);
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
    void (async () => {
      try {
        const { members: fetched } = await groupsApi.members(groupId);
        if (!cancelled) {
          setMembers(fetched);
          // NFR-EXP-001 enablers: every member participates by default, and the
          // acting user pays by default (falling back to the first member).
          setParticipantIds(fetched.map((member) => member.id));
          const acting = fetched.find((member) => member.id === user?.id);
          setPayerId(acting?.id ?? fetched[0]?.id ?? '');
        }
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

  return (
    <section>
      <h1>Add expense</h1>
      {loadError !== null && <p role="alert">{loadError}</p>}
      {loading ? (
        <p>Loading members…</p>
      ) : loadError === null ? (
        <form onSubmit={onSubmit} noValidate aria-label="Add an expense">
          {submitError !== null && <p role="alert">{submitError}</p>}

          <p>
            <label htmlFor="expense-description">Description</label>
            <input
              id="expense-description"
              name="description"
              type="text"
              maxLength={FIELD_LIMITS.description.maxLength}
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
              }}
            />
          </p>
          {errors.description !== undefined && (
            <p data-testid="description-error" role="alert">
              {errors.description}
            </p>
          )}

          <p>
            <label htmlFor="expense-amount">Amount</label>
            <input
              id="expense-amount"
              name="amount"
              type="text"
              inputMode="decimal"
              value={amountText}
              onChange={(event) => {
                setAmountText(event.target.value);
              }}
            />
          </p>
          {errors.amount !== undefined && (
            <p data-testid="amount-error" role="alert">
              {errors.amount}
            </p>
          )}

          <p>
            <label htmlFor="expense-payer">Payer</label>
            <select
              id="expense-payer"
              name="payer"
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
          </p>
          {errors.payer !== undefined && (
            <p data-testid="payer-error" role="alert">
              {errors.payer}
            </p>
          )}

          <fieldset>
            <legend>Split type</legend>
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
          </fieldset>

          <fieldset>
            <legend>Participants</legend>
            {members.map((member) => (
              <label key={member.id}>
                <input
                  type="checkbox"
                  data-testid="participant-checkbox"
                  checked={participantIds.includes(member.id)}
                  onChange={(event) => {
                    toggleParticipant(member.id, event.target.checked);
                  }}
                />
                {member.displayName}
              </label>
            ))}
          </fieldset>
          {errors.participants !== undefined && (
            <p data-testid="participants-error" role="alert">
              {errors.participants}
            </p>
          )}

          {splitType === 'EXACT' && (
            <fieldset>
              <legend>Exact amounts</legend>
              {members
                .filter((member) => participantIds.includes(member.id))
                .map((member) => (
                  <label key={member.id}>
                    {member.displayName}
                    <input
                      data-testid={`exact-${member.id}`}
                      type="text"
                      inputMode="decimal"
                      value={exactTexts[member.id] ?? ''}
                      onChange={(event) => {
                        setExactTexts((current) => ({
                          ...current,
                          [member.id]: event.target.value,
                        }));
                      }}
                    />
                  </label>
                ))}
              {errors.exact !== undefined && (
                <p data-testid="exact-error" role="alert">
                  {errors.exact}
                </p>
              )}
            </fieldset>
          )}

          <button type="submit" disabled={submitting}>
            Save expense
          </button>
        </form>
      ) : null}
    </section>
  );
}
