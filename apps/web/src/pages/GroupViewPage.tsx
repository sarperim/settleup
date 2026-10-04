/**
 * `/groups/:groupId` page — group view (TKT-groups-004; extended by
 * TKT-groups-006; 03-api-design.md §6).
 *
 * Tab scaffold for the four §6 sections (Expenses / Balances / Settle-up /
 * Members). The **Members** tab lists the group's members by display name
 * (never email — FR-ACC-008) with a creator marker, from
 * `GET /api/groups/:groupId/members` (UC-GRP-005, FR-GRP-010). The **Expenses**
 * tab is the group ledger (TKT-exp-005): the group's expenses, newest first,
 * from `GET /api/groups/:groupId/expenses` (UC-EXP-004, FR-EXP-011), with the
 * entry point to the add-expense form. TKT-exp-006 adds the logger-only
 * edit/delete affordances on each entry (BR-EXP-007's UI aspect): only the
 * logged-in expense's `logger` sees Edit (→ the edit form) and Delete
 * (`DELETE …/expenses/:expenseId`); the API enforces the same rule.
 * The **Balances** tab (TKT-bal-006) shows every member's derived running
 * balance by display name with a visible zero-sum total (UC-BAL-001,
 * FR-BAL-001/002/003, OBJ-004). The **Settle-up** tab (TKT-bal-006) shows the
 * live outstanding suggestion plan and the settled-payment facts, distinguished
 * (UC-BAL-002, FR-BAL-004/005/010): a suggestion offers **Mark paid** only to
 * the acting user when they are its payer or recipient (BR-BAL-006); a settled
 * entry offers **Undo** to its parties and an undone entry is labelled
 * (UC-BAL-003/004, FR-BAL-006…009). TKT-ui-005 dresses these two sections in the
 * TKT-ui-001 design direction (colocated `GroupViewPage.css`, `var(--…)` tokens
 * only): signed balance rows plus an emphasised zero-sum total, and outstanding
 * / settled panels whose party-only actions and undone label carry class hooks —
 * presentation only, so every testid/role/label/text stays as the TCs assert.
 * TKT-ui-006 closes the page by dressing the **Members** section and the
 * creator-only **Join requests** region in the same design direction (colocated
 * `GroupViewPage.css`, `var(--…)` tokens only): member rows pairing the display
 * name with a creator badge, and a join-requests panel whose request rows place
 * the requester's display name beside the approve/reject actions — again
 * presentation only, so every testid/role/label/text stays as the TCs assert.
 * The group's name
 * and — for the creator only — its join code come from
 * `GET /api/groups/:groupId` (FR-GRP-002).
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

import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type {
  BalancesResponseDto,
  ExpenseDto,
  GroupDto,
  JoinRequestDto,
  MemberDto,
  OutstandingSuggestionDto,
  SettlementDto,
  SettleUpViewDto,
} from 'shared';

import { expensesApi } from '../api/expenses';
import { groupsApi } from '../api/groups';
import { settlementsApi } from '../api/settlements';
import { ApiError } from '../api/errors';
import { useAuth } from '../auth/AuthContext';
import { formatKurus, type Kurus } from '../money';
import { GROUP_TABS, GROUP_TAB_LABELS, SPA_ROUTES, type GroupTab } from '../routes';
import './GroupViewPage.css';

/**
 * Render a signed kuruş amount for display. Balances are plain signed numbers
 * (positive = the group owes the member — settlements DTO); `formatKurus`
 * accepts only non-negative `Kurus`, so the sign is applied here. Zero renders
 * without a sign.
 */
function formatSignedKurus(kurus: number): string {
  const sign = kurus > 0 ? '+' : kurus < 0 ? '-' : '';
  return `${sign}${formatKurus(Math.abs(kurus) as Kurus)}`;
}

/**
 * The sign of a member's derived balance, used only as a styling hook
 * (TKT-ui-005): positive = the group owes the member, negative = the member
 * owes the group, zero = settled up. The amount itself always carries the
 * explicit sign, so the colour is a redundant cue, never the only signal.
 */
function balanceSign(balanceKurus: number): 'positive' | 'negative' | 'zero' {
  if (balanceKurus > 0) {
    return 'positive';
  }
  return balanceKurus < 0 ? 'negative' : 'zero';
}

/**
 * A settlement's status. The write routes (mark-paid/undo) carry `status`
 * explicitly; the `GET …/settlements` view omits it and distinguishes an undone
 * fact by the presence of `undoneAt` (03-api-design.md §3c; NFR-BAL-005) — so
 * fall back to that signal when `status` is absent.
 */
function settlementStatus(settlement: SettlementDto): 'SETTLED' | 'UNDONE' {
  if (settlement.status === 'SETTLED' || settlement.status === 'UNDONE') {
    return settlement.status;
  }
  return settlement.undoneAt === undefined ? 'SETTLED' : 'UNDONE';
}

/** A suggestion/settlement payment line: "Payer pays Recipient ₺123.45". */
function paymentLabel(payerName: string, recipientName: string, amountKurus: number): string {
  return `${payerName} pays ${recipientName} ₺${formatKurus(Math.abs(amountKurus) as Kurus)}`;
}

/** Whether the acting user is the payer or recipient of `suggestion` (BR-BAL-006). */
function isSuggestionParty(
  suggestion: { payer: { id: string }; recipient: { id: string } },
  userId: string | undefined,
): boolean {
  return userId !== undefined && (suggestion.payer.id === userId || suggestion.recipient.id === userId);
}

/**
 * Decorative per-member avatar (TKT-ui-016). The reference paints each member
 * a distinct hue; the frozen token layer carries no avatar palette, so the
 * page reuses the existing semantic/accent tokens (groups `c0`…`c5`, styled in
 * `GroupViewPage.css`) picked deterministically from the display name — the
 * colour is redundant decoration, never a signal, and the initial is derived
 * from the name (PG-006 renders display names only, never email).
 */
function avatarVariant(name: string): number {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash + name.charCodeAt(index) * (index + 1)) % 6;
  }
  return hash;
}

function avatarInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed.charAt(0).toLocaleUpperCase() : '?';
}

/** Short "Mon D" member-joined line (reference: "Joined Aug 30"). */
function formatJoined(joinedAt: string): string {
  const date = new Date(joinedAt);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ── Decorative glyphs (reference iconography) ───────────────────────────── */

function CopyIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M10.5 5.5V4A1.5 1.5 0 0 0 9 2.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ReceiptIcon() {
  return (
    <svg viewBox="0 0 17 17" width="17" height="17" aria-hidden="true" focusable="false">
      <path
        d="M4 2.5h9v12l-1.5-1-1.5 1-1.5-1-1.5 1-1.5-1-1.5 1z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M6.5 6h5M6.5 8.5h5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        d="M8 1.5l1.7 4.3L14 7.5l-4.3 1.7L8 13.5l-1.7-4.3L2 7.5l4.3-1.7z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M14 11.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" fill="currentColor" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true" focusable="false">
      <path d="M2 7h9M8 4l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true" focusable="false">
      <path d="M2.5 7.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 17 17" width="17" height="17" aria-hidden="true" focusable="false">
      <circle cx="8.5" cy="8.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M8.5 7.5v4M8.5 5.3v.2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function GroupViewPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<GroupTab>('expenses');
  const [group, setGroup] = useState<GroupDto | null>(null);
  const [members, setMembers] = useState<MemberDto[]>([]);
  const [expenses, setExpenses] = useState<ExpenseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [requests, setRequests] = useState<JoinRequestDto[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Balances & settle-up (TKT-bal-006): derived data fetched lazily per tab.
  const [balances, setBalances] = useState<BalancesResponseDto | null>(null);
  const [settleUp, setSettleUp] = useState<SettleUpViewDto | null>(null);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [settleUpLoading, setSettleUpLoading] = useState(false);
  const [financialError, setFinancialError] = useState<string | null>(null);
  const [mutatingKey, setMutatingKey] = useState<string | null>(null);

  // The join-code copy affordance (TKT-ui-004). `navigator.clipboard` is only
  // present in a secure context; when it is missing or the write is rejected
  // the affordance degrades to a non-blocking hint — the code stays on screen
  // and selectable, and the page never throws.
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  // The server returns `joinCode` iff the caller is the creator (FR-GRP-002);
  // the caller's own id compared with `group.creator.id` is the same signal
  // from the detail payload and gates the creator-only handling section.
  const isCreator = group !== null && user !== null && group.creator.id === user.id;

  /** Write the creator-visible join code to the clipboard (PG-006). */
  const copyJoinCode = useCallback(async () => {
    const code = group?.joinCode;
    if (code === undefined) {
      return;
    }
    try {
      if (typeof navigator === 'undefined' || navigator.clipboard?.writeText === undefined) {
        setCopyStatus('failed');
        return;
      }
      await navigator.clipboard.writeText(code);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
  }, [group?.joinCode]);

  /** Load the derived balances (UC-BAL-001; FR-BAL-001/002/003). */
  const loadBalances = useCallback(async () => {
    if (groupId === undefined) {
      return;
    }
    setBalancesLoading(true);
    setFinancialError(null);
    try {
      setBalances(await settlementsApi.balances(groupId));
    } catch (caught) {
      setFinancialError(caught instanceof ApiError ? caught.message : 'Could not load balances.');
    } finally {
      setBalancesLoading(false);
    }
  }, [groupId]);

  /**
   * Load the settle-up view — outstanding suggestions and settled facts
   * (UC-BAL-002; FR-BAL-004/005/010).
   */
  const loadSettleUp = useCallback(async () => {
    if (groupId === undefined) {
      return;
    }
    setSettleUpLoading(true);
    setFinancialError(null);
    try {
      setSettleUp(await settlementsApi.view(groupId));
    } catch (caught) {
      setFinancialError(
        caught instanceof ApiError ? caught.message : 'Could not load settle-up.',
      );
    } finally {
      setSettleUpLoading(false);
    }
  }, [groupId]);

  // Fetch the tab's derived data when it becomes active (lazy per-tab load).
  useEffect(() => {
    if (activeTab === 'balances') {
      void loadBalances();
    } else if (activeTab === 'settle-up') {
      void loadSettleUp();
    }
  }, [activeTab, loadBalances, loadSettleUp]);

  useEffect(() => {
    // Reset per-group state: a param-only transition must not display the
    // previous group's data (PR #17 K-2 / S-1).
    setGroup(null);
    setMembers([]);
    setExpenses([]);
    setError(null);
    setLoading(true);
    setActiveTab('expenses');
    setRequests([]);
    setRequestsError(null);
    setDeletingId(null);
    setDeleteError(null);
    setBalances(null);
    setSettleUp(null);
    setFinancialError(null);
    setMutatingKey(null);
    setCopyStatus('idle');

    if (groupId === undefined) {
      setError('Missing group id.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [groupResponse, membersResponse, expensesResponse] = await Promise.all([
          groupsApi.detail(groupId),
          groupsApi.members(groupId),
          expensesApi.list(groupId),
        ]);
        if (!cancelled) {
          setGroup(groupResponse.group);
          setMembers(membersResponse.members);
          setExpenses(expensesResponse.expenses);
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

  /**
   * Delete an expense (UC-EXP-003 main; FR-EXP-009/012). The affordance is
   * rendered for the logger only (BR-EXP-007's UI aspect); the API enforces
   * the same rule with `403 NOT_LOGGER`. On success the entry leaves the local
   * ledger — no refetch needed.
   */
  async function removeExpense(expenseId: string) {
    if (groupId === undefined) {
      return;
    }
    setDeletingId(expenseId);
    setDeleteError(null);
    try {
      await expensesApi.remove(groupId, expenseId);
      setExpenses((current) => current.filter((expense) => expense.id !== expenseId));
    } catch (caught) {
      setDeleteError(caught instanceof ApiError ? caught.message : 'Could not delete the expense.');
    } finally {
      setDeletingId(null);
    }
  }

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

  /**
   * Mark an outstanding suggestion paid (UC-BAL-003; FR-BAL-006/007). Only a
   * party sees the affordance; the API re-validates the party rule and the
   * exact plan match (§3.4). Balances and the settle-up view are refetched so
   * both tabs show the new state.
   */
  async function markPaid(suggestion: OutstandingSuggestionDto) {
    if (groupId === undefined) {
      return;
    }
    const key = `${suggestion.payer.id}:${suggestion.recipient.id}:${String(suggestion.amountKurus)}`;
    setMutatingKey(key);
    setFinancialError(null);
    try {
      await settlementsApi.markPaid(groupId, {
        payerId: suggestion.payer.id,
        recipientId: suggestion.recipient.id,
        amountKurus: suggestion.amountKurus,
      });
      await Promise.all([loadSettleUp(), loadBalances()]);
    } catch (caught) {
      setFinancialError(
        caught instanceof ApiError ? caught.message : 'Could not mark the payment paid.',
      );
    } finally {
      setMutatingKey(null);
    }
  }

  /**
   * Undo a settled payment (UC-BAL-004; FR-BAL-008/009). The row is retained
   * and marked undone (NFR-BAL-005); balances and the settle-up view are
   * refetched so the equivalent suggestion returns to outstanding.
   */
  async function undoSettlement(settlementId: string) {
    if (groupId === undefined) {
      return;
    }
    setMutatingKey(settlementId);
    setFinancialError(null);
    try {
      await settlementsApi.undo(groupId, settlementId);
      await Promise.all([loadSettleUp(), loadBalances()]);
    } catch (caught) {
      setFinancialError(
        caught instanceof ApiError ? caught.message : 'Could not undo the payment.',
      );
    } finally {
      setMutatingKey(null);
    }
  }

  return (
    <section className="group-view">
      {/* ── Header region ───────────────────────────────────────────────── */}
      <header className="group-header">
        <div className="group-identity">
          <nav className="group-breadcrumb" aria-label="Breadcrumb">
            <Link to={SPA_ROUTES.groupsOverview}>Groups</Link>
            <span className="group-breadcrumb__sep" aria-hidden="true">
              /
            </span>
            <span className="group-breadcrumb__current">{group?.name ?? 'Group'}</span>
          </nav>
          <h1 className="group-identity__title">{group?.name ?? 'Group'}</h1>
          {members.length > 0 && (
            <p className="group-identity__meta">
              {members.length} {members.length === 1 ? 'member' : 'members'}
            </p>
          )}
        </div>
        {group?.joinCode !== undefined && (
          <aside className="group-join-code">
            <p className="group-join-code__label">Join code</p>
            <div className="group-join-code__row">
              <code className="group-join-code__value" data-testid="join-code">
                {group.joinCode}
              </code>
              <button
                type="button"
                className="btn btn--secondary group-join-code__copy"
                data-testid="copy-join-code"
                onClick={() => {
                  void copyJoinCode();
                }}
              >
                <CopyIcon />
                Copy
              </button>
            </div>
            {copyStatus === 'copied' && (
              <p className="group-join-code__status" role="status">
                Copied
              </p>
            )}
            {copyStatus === 'failed' && (
              <p className="group-join-code__status" role="status">
                Copy unavailable — select the code to copy it.
              </p>
            )}
          </aside>
        )}
      </header>
      {error !== null && <p role="alert">{error}</p>}

      {/* ── Section panel (tabs + active region) ────────────────────────── */}
      <div className="group-panel">
        <nav className="group-tabs" aria-label="Group sections">
          {GROUP_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              className="group-tab"
              aria-pressed={activeTab === tab}
              onClick={() => {
                setActiveTab(tab);
              }}
            >
              {GROUP_TAB_LABELS[tab]}
            </button>
          ))}
        </nav>

        <section className="group-section" aria-labelledby="group-section-heading">
          <div className="group-section__head">
            <div className="group-section__title">
              <h2 id="group-section-heading">{GROUP_TAB_LABELS[activeTab]}</h2>
              {activeTab === 'expenses' && !loading && expenses.length > 0 && (
                <p className="group-section__count">
                  {expenses.length} {expenses.length === 1 ? 'expense' : 'expenses'} ·{' '}
                  {formatKurus(
                    expenses.reduce((sum, expense) => sum + expense.amountKurus, 0) as Kurus,
                  )}{' '}
                  total
                </p>
              )}
              {activeTab === 'balances' && (
                <p className="group-section__hint">
                  Positive means the group owes them; negative means they owe the group.
                </p>
              )}
              {activeTab === 'settle-up' && (
                <p className="group-section__hint">
                  A simple way to bring everyone back to 0.00.
                </p>
              )}
            </div>
            {activeTab === 'expenses' && groupId !== undefined && (
              <Link
                to={SPA_ROUTES.addExpense(groupId)}
                className="btn group-section__action"
                data-testid="add-expense-link"
              >
                <PlusIcon />
                Add expense
              </Link>
            )}
          </div>

          {activeTab === 'members' ? (
            <div className="group-members">
              {loading ? (
                <p className="muted">Loading members…</p>
              ) : error === null ? (
                <ul className="group-member-list" role="list" data-testid="member-list">
                  {members.map((member) => (
                    <li className="group-member" key={member.id} data-testid="member-item">
                      <span
                        className={`group-avatar group-avatar--md group-avatar--c${String(avatarVariant(member.displayName))}`}
                        aria-hidden="true"
                      >
                        {avatarInitial(member.displayName)}
                      </span>
                      <span className="group-member__info">
                        <span className="group-member__name-row">
                          <span className="group-member__name" data-testid="member-name">
                            {member.displayName}
                          </span>
                          {member.isCreator && (
                            <span
                              className="group-member__badge"
                              data-testid="member-creator-badge"
                            >
                              Creator
                            </span>
                          )}
                        </span>
                        <span className="group-member__detail">
                          Joined {formatJoined(member.joinedAt)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : activeTab === 'expenses' ? (
            <div className="group-expenses">
              {deleteError !== null && <p role="alert">{deleteError}</p>}
              {loading ? (
                <p className="muted">Loading expenses…</p>
              ) : error === null ? (
                expenses.length === 0 ? (
                  <div className="group-empty" data-testid="expenses-empty">
                    <span className="group-empty__icon" aria-hidden="true">
                      <SparklesIcon />
                    </span>
                    <p className="group-empty__title">No expenses yet</p>
                    <p className="group-empty__text">
                      Add the first shared cost when the group is ready.
                    </p>
                    {groupId !== undefined && (
                      <Link
                        to={SPA_ROUTES.addExpense(groupId)}
                        className="btn btn--secondary group-empty__action"
                      >
                        Add expense
                      </Link>
                    )}
                  </div>
                ) : (
                  <ul className="group-expense-list" role="list" data-testid="expense-list">
                    {expenses.map((expense) => (
                      <li className="group-expense" key={expense.id} data-testid="expense-item">
                        <span className="group-expense__icon" aria-hidden="true">
                          <ReceiptIcon />
                        </span>
                        <div className="group-expense__details">
                          <div className="group-expense__title-row">
                            <span
                              className="group-expense__description"
                              data-testid="expense-description"
                            >
                              {expense.description}
                            </span>
                            {expense.editedAt !== undefined && (
                              <span
                                className="group-expense__badge"
                                data-testid="expense-edited-at"
                                title={`edited ${new Date(expense.editedAt).toLocaleString()}`}
                              >
                                Edited
                              </span>
                            )}
                          </div>
                          <p className="group-expense__meta">
                            <span data-testid="expense-payer">
                              Paid by {expense.payer.displayName}
                            </span>
                            <span aria-hidden="true"> · </span>
                            <span data-testid="expense-participants">
                              {expense.shares
                                .map((share) => share.participant.displayName)
                                .join(', ')}
                            </span>
                          </p>
                          <p className="group-expense__timestamp">
                            <time dateTime={expense.createdAt}>
                              {new Date(expense.createdAt).toLocaleString()}
                            </time>
                            {expense.editedAt !== undefined && (
                              <time
                                className="group-expense__edited-time"
                                dateTime={expense.editedAt}
                              >
                                {' '}
                                · edited {new Date(expense.editedAt).toLocaleString()}
                              </time>
                            )}
                          </p>
                        </div>
                        <div className="group-expense__amount-wrap">
                          <span className="group-expense__amount" data-testid="expense-amount">
                            {formatKurus(expense.amountKurus as Kurus)}
                          </span>
                          {groupId !== undefined &&
                            user !== null &&
                            expense.logger.id === user.id && (
                              <span
                                className="group-expense__actions"
                                data-testid="expense-actions"
                              >
                                <Link
                                  className="group-expense__edit"
                                  to={SPA_ROUTES.editExpense(groupId, expense.id)}
                                  data-testid="edit-expense-link"
                                >
                                  Edit
                                </Link>
                                <button
                                  type="button"
                                  className="group-expense__delete"
                                  data-testid="delete-expense"
                                  disabled={deletingId === expense.id}
                                  onClick={() => {
                                    void removeExpense(expense.id);
                                  }}
                                >
                                  Delete
                                </button>
                              </span>
                            )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )
              ) : null}
            </div>
          ) : activeTab === 'balances' ? (
            <div className="group-balances">
              {financialError !== null && <p role="alert">{financialError}</p>}
              {balancesLoading && balances === null ? (
                <p className="muted">Loading balances…</p>
              ) : balances === null ? null : (
                <>
                  <ul className="group-balance-list" role="list" data-testid="balance-list">
                    {balances.balances.map((entry) => {
                      const sign = balanceSign(entry.balanceKurus);
                      const meaning =
                        sign === 'positive'
                          ? 'is owed money'
                          : sign === 'negative'
                            ? 'owes money'
                            : 'settled';
                      return (
                        <li
                          className={`group-balance group-balance--${sign}`}
                          key={entry.member.id}
                          data-testid="balance-item"
                        >
                          <span className="group-balance__member-wrap">
                            <span
                              className={`group-avatar group-avatar--sm group-avatar--c${String(avatarVariant(entry.member.displayName))}`}
                              aria-hidden="true"
                            >
                              {avatarInitial(entry.member.displayName)}
                            </span>
                            <span className="group-balance__member" data-testid="balance-member">
                              {entry.member.displayName}
                            </span>
                          </span>
                          <span className="group-balance__value">
                            <span className="group-balance__amount" data-testid="balance-amount">
                              {formatSignedKurus(entry.balanceKurus)}
                            </span>
                            <span className="group-balance__meaning">{meaning}</span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="group-balance-sum" data-testid="balance-sum">
                    Total: {formatSignedKurus(balances.sumKurus)}
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="group-settle-up">
              {financialError !== null && <p role="alert">{financialError}</p>}
              {settleUpLoading && settleUp === null ? (
                <p className="muted">Loading settle-up…</p>
              ) : settleUp === null ? null : (
                <>
                  <section className="group-settle-up__panel">
                    <h3 id="settle-up-outstanding-heading">Outstanding</h3>
                    {settleUp.outstanding.length === 0 ? (
                      <div className="group-empty" data-testid="outstanding-empty">
                        <span className="group-empty__icon" aria-hidden="true">
                          <SparklesIcon />
                        </span>
                        <p className="group-empty__title">Everyone is settled</p>
                        <p className="group-empty__text">
                          There are no suggested payments right now.
                        </p>
                      </div>
                    ) : (
                      <ul className="group-settlement-list" role="list" data-testid="outstanding-list">
                        {settleUp.outstanding.map((suggestion) => {
                          const key = `${suggestion.payer.id}:${suggestion.recipient.id}:${String(suggestion.amountKurus)}`;
                          return (
                            <li
                              className="group-settlement"
                              key={key}
                              data-testid="outstanding-item"
                            >
                              <span className="group-settlement__icon" aria-hidden="true">
                                <ArrowRightIcon />
                              </span>
                              <span
                                className="group-settlement__text"
                                data-testid="outstanding-text"
                              >
                                {paymentLabel(
                                  suggestion.payer.displayName,
                                  suggestion.recipient.displayName,
                                  suggestion.amountKurus,
                                )}
                              </span>
                              {isSuggestionParty(suggestion, user?.id) && (
                                <button
                                  type="button"
                                  className="btn btn--secondary group-settlement__action"
                                  data-testid="mark-paid"
                                  disabled={mutatingKey === key}
                                  onClick={() => {
                                    void markPaid(suggestion);
                                  }}
                                >
                                  Mark paid
                                </button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </section>

                  <p className="group-settle-up__hint">
                    <InfoIcon />
                    Mark paid appears only when you are the payer or recipient.
                  </p>

                  <section className="group-settle-up__panel">
                    <h3 id="settle-up-settled-heading">Settled</h3>
                    {settleUp.settled.length === 0 ? (
                      <p className="muted" data-testid="settled-empty">
                        No settled payments yet.
                      </p>
                    ) : (
                      <ul className="group-settlement-list" role="list" data-testid="settled-list">
                        {settleUp.settled.map((settlement) => {
                          const status = settlementStatus(settlement);
                          return (
                            <li
                              className={`group-settlement group-settlement--${status.toLowerCase()}`}
                              key={settlement.id}
                              data-testid="settled-item"
                              data-status={status}
                            >
                              <span className="group-settlement__icon" aria-hidden="true">
                                {status === 'SETTLED' ? <CheckIcon /> : <ArrowRightIcon />}
                              </span>
                              <span className="group-settlement__text" data-testid="settled-text">
                                {paymentLabel(
                                  settlement.payer.displayName,
                                  settlement.recipient.displayName,
                                  settlement.amountKurus,
                                )}
                              </span>
                              {status === 'UNDONE' ? (
                                <span
                                  className="group-settlement__badge group-settlement__badge--undone"
                                  data-testid="settled-undone"
                                >
                                  Undone
                                </span>
                              ) : (
                                <span className="group-settlement__badge group-settlement__badge--paid">
                                  Paid
                                </span>
                              )}
                              {status === 'SETTLED' && isSuggestionParty(settlement, user?.id) && (
                                <button
                                  type="button"
                                  className="btn btn--secondary group-settlement__action"
                                  data-testid="undo-settlement"
                                  disabled={mutatingKey === settlement.id}
                                  onClick={() => {
                                    void undoSettlement(settlement.id);
                                  }}
                                >
                                  Undo
                                </button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </section>
                </>
              )}
            </div>
          )}
        </section>
      </div>

      {isCreator && (
        <section
          id="join-requests"
          className="group-join-requests"
          aria-labelledby="join-requests-heading"
        >
          <div className="group-join-requests__head">
            <h2 id="join-requests-heading">Join requests</h2>
            <span className="group-join-requests__badge">Creator only</span>
          </div>
          {requestsError !== null && <p role="alert">{requestsError}</p>}
          {requestsLoading ? (
            <p className="muted">Loading join requests…</p>
          ) : requests.length === 0 ? (
            <div className="group-empty" data-testid="join-requests-empty">
              <span className="group-empty__icon" aria-hidden="true">
                <SparklesIcon />
              </span>
              <p className="group-empty__title">No pending requests</p>
              <p className="group-empty__text">
                New requests will appear here for the creator.
              </p>
            </div>
          ) : (
            <ul className="group-join-request-list" role="list" data-testid="join-request-list">
              {requests.map((request) => (
                <li className="group-join-request" key={request.id} data-testid="join-request-item">
                  <div className="group-join-request__person">
                    <span
                      className={`group-avatar group-avatar--sm group-avatar--c${String(avatarVariant(request.requester.displayName))}`}
                      aria-hidden="true"
                    >
                      {avatarInitial(request.requester.displayName)}
                    </span>
                    <span className="group-join-request__name">
                      {request.requester.displayName} wants to join
                    </span>
                  </div>
                  <div className="group-join-request__actions">
                    <button
                      type="button"
                      className="btn group-join-request__approve"
                      disabled={decidingId === request.id}
                      onClick={() => {
                        void decide(request.id, 'APPROVED');
                      }}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="btn btn--secondary group-join-request__reject"
                      disabled={decidingId === request.id}
                      onClick={() => {
                        void decide(request.id, 'REJECTED');
                      }}
                    >
                      Reject
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </section>
  );
}
