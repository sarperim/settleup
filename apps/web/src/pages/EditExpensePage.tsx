/**
 * `/groups/:groupId/expenses/:expenseId/edit` — edit-expense form
 * (TKT-exp-006; UC-EXP-002, 03-api-design.md §6 edit-expense row).
 *
 * The form is a **single screen** (no wizard steps), prefilled from the
 * expense detail (`GET …/expenses/:expenseId`): description, amount, payer,
 * participants and split type all default to the stored expense, and an EXACT
 * split prefills each participant's amount from the stored shares. Saving
 * issues a `PATCH` and returns to the group view, where the updated expense is
 * visible in the ledger.
 *
 * Affordance enforcement is a UI, not a security, boundary: only the logger
 * sees the entry point to this page (BR-EXP-007's UI aspect). The API itself
 * returns `403 NOT_LOGGER` to any other member, so a hand-typed URL fails
 * closed. Member references are display names only (FR-ACC-008).
 */

import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FIELD_LIMITS, type EditExpenseRequestDto, type MemberDto, type SplitType } from 'shared';

import { expensesApi } from '../api/expenses';
import { groupsApi } from '../api/groups';
import { ApiError } from '../api/errors';
import { formatKurus, parseKurus, type Kurus } from '../money';
import { SPA_ROUTES } from '../routes';

interface FieldErrors {
  description?: string;
  amount?: string;
  payer?: string;
  participants?: string;
  exact?: string;
}

export function EditExpensePage() {
  const { groupId, expenseId } = useParams<{ groupId: string; expenseId: string }>();
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
    // Reset per-expense state: a param-only transition must not display the
    // previous expense's values (PR #17 K-2 / S-1; review exp-005 C-2).
    setMembers([]);
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

    if (groupId === undefined || expenseId === undefined) {
      setLoadError('Missing group or expense id.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [membersResponse, expenseResponse] = await Promise.all([
          groupsApi.members(groupId),
          expensesApi.detail(groupId, expenseId),
        ]);
        if (cancelled) {
          return;
        }
        const { expense } = expenseResponse;
        setMembers(membersResponse.members);
        setDescription(expense.description);
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
  }, [groupId, expenseId]);

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

  return (
    <section>
      <h1>Edit expense</h1>
      {loadError !== null && <p role="alert">{loadError}</p>}
      {loading ? (
        <p>Loading expense…</p>
      ) : loadError === null ? (
        <form onSubmit={onSubmit} noValidate aria-label="Edit an expense">
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
            Save changes
          </button>
        </form>
      ) : null}
    </section>
  );
}
