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
      <header className="group-header card">
        <h1>{group?.name ?? 'Group'}</h1>
        {group?.joinCode !== undefined && (
          <div className="group-join-code">
            <p className="group-join-code__value">
              Join code: <code data-testid="join-code">{group.joinCode}</code>
            </p>
            <button
              type="button"
              className="btn btn--secondary group-join-code__copy"
              data-testid="copy-join-code"
              onClick={() => {
                void copyJoinCode();
              }}
            >
              Copy
            </button>
            {copyStatus === 'copied' && (
              <span className="muted group-join-code__status" role="status">
                Copied
              </span>
            )}
            {copyStatus === 'failed' && (
              <span className="muted group-join-code__status" role="status">
                Copy unavailable — select the code to copy it.
              </span>
            )}
          </div>
        )}
      </header>
      {error !== null && <p role="alert">{error}</p>}

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
        <h2 id="group-section-heading">{GROUP_TAB_LABELS[activeTab]}</h2>

      {activeTab === 'members' ? (
        loading ? (
          <p>Loading members…</p>
        ) : error === null ? (
          <ul data-testid="member-list">
            {members.map((member) => (
              <li key={member.id} data-testid="member-item">
                <span>{member.displayName}</span>
                {member.isCreator && <span data-testid="member-creator-badge">Creator</span>}
              </li>
            ))}
          </ul>
        ) : null
      ) : activeTab === 'expenses' ? (
        <div className="group-expenses">
          <div className="group-expenses__toolbar row">
            {groupId !== undefined && (
              <Link
                to={SPA_ROUTES.addExpense(groupId)}
                className="btn"
                data-testid="add-expense-link"
              >
                Add expense
              </Link>
            )}
          </div>
          {deleteError !== null && <p role="alert">{deleteError}</p>}
          {loading ? (
            <p className="muted">Loading expenses…</p>
          ) : error === null ? (
            expenses.length === 0 ? (
              <p className="muted" data-testid="expenses-empty">
                No expenses yet.
              </p>
            ) : (
              <ul className="list group-expense-list" role="list" data-testid="expense-list">
                {expenses.map((expense) => (
                  <li className="group-expense" key={expense.id} data-testid="expense-item">
                    <span className="group-expense__description" data-testid="expense-description">
                      {expense.description}
                    </span>
                    <span className="group-expense__amount" data-testid="expense-amount">
                      {formatKurus(expense.amountKurus as Kurus)}
                    </span>
                    <span className="group-expense__payer" data-testid="expense-payer">
                      Paid by {expense.payer.displayName}
                    </span>
                    <span
                      className="group-expense__participants"
                      data-testid="expense-participants"
                    >
                      For {expense.shares.map((share) => share.participant.displayName).join(', ')}
                    </span>
                    <time className="muted group-expense__timestamp" dateTime={expense.createdAt}>
                      {new Date(expense.createdAt).toLocaleString()}
                    </time>
                    {expense.editedAt !== undefined && (
                      <time
                        className="muted group-expense__timestamp"
                        data-testid="expense-edited-at"
                        dateTime={expense.editedAt}
                      >
                        edited {new Date(expense.editedAt).toLocaleString()}
                      </time>
                    )}
                    {groupId !== undefined && user !== null && expense.logger.id === user.id && (
                      <span className="row group-expense__actions" data-testid="expense-actions">
                        <Link
                          to={SPA_ROUTES.editExpense(groupId, expense.id)}
                          data-testid="edit-expense-link"
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          className="btn btn--danger group-expense__delete"
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
              <ul className="list group-balance-list" role="list" data-testid="balance-list">
                {balances.balances.map((entry) => (
                  <li
                    className={`group-balance group-balance--${balanceSign(entry.balanceKurus)}`}
                    key={entry.member.id}
                    data-testid="balance-item"
                  >
                    <span className="group-balance__member" data-testid="balance-member">
                      {entry.member.displayName}
                    </span>
                    <span className="group-balance__amount" data-testid="balance-amount">
                      {formatSignedKurus(entry.balanceKurus)}
                    </span>
                  </li>
                ))}
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
              <section
                className="group-settle-up__panel"
                aria-labelledby="settle-up-outstanding-heading"
              >
                <h3 id="settle-up-outstanding-heading">Outstanding</h3>
                {settleUp.outstanding.length === 0 ? (
                  <p className="muted" data-testid="outstanding-empty">
                    Nothing outstanding.
                  </p>
                ) : (
                  <ul
                    className="list group-settlement-list"
                    role="list"
                    data-testid="outstanding-list"
                  >
                    {settleUp.outstanding.map((suggestion) => {
                      const key = `${suggestion.payer.id}:${suggestion.recipient.id}:${String(suggestion.amountKurus)}`;
                      return (
                        <li className="group-settlement" key={key} data-testid="outstanding-item">
                          <span className="group-settlement__text" data-testid="outstanding-text">
                            {paymentLabel(
                              suggestion.payer.displayName,
                              suggestion.recipient.displayName,
                              suggestion.amountKurus,
                            )}
                          </span>
                          {isSuggestionParty(suggestion, user?.id) && (
                            <button
                              type="button"
                              className="btn group-settlement__action"
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

              <section
                className="group-settle-up__panel"
                aria-labelledby="settle-up-settled-heading"
              >
                <h3 id="settle-up-settled-heading">Settled</h3>
                {settleUp.settled.length === 0 ? (
                  <p className="muted" data-testid="settled-empty">
                    No settled payments yet.
                  </p>
                ) : (
                  <ul
                    className="list group-settlement-list"
                    role="list"
                    data-testid="settled-list"
                  >
                    {settleUp.settled.map((settlement) => (
                      <li
                        className={`group-settlement group-settlement--${settlementStatus(settlement).toLowerCase()}`}
                        key={settlement.id}
                        data-testid="settled-item"
                        data-status={settlementStatus(settlement)}
                      >
                        <span className="group-settlement__text" data-testid="settled-text">
                          {paymentLabel(
                            settlement.payer.displayName,
                            settlement.recipient.displayName,
                            settlement.amountKurus,
                          )}
                        </span>
                        {settlementStatus(settlement) === 'UNDONE' && (
                          <span className="group-settlement__badge" data-testid="settled-undone">
                            Undone
                          </span>
                        )}
                        {settlementStatus(settlement) === 'SETTLED' &&
                          isSuggestionParty(settlement, user?.id) && (
                            <button
                              type="button"
                              className="btn group-settlement__action"
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
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      )}
      </section>

      {isCreator && (
        <section id="join-requests" className="group-join-requests" aria-labelledby="join-requests-heading">
          <h2 id="join-requests-heading">Join requests</h2>
          {requestsError !== null && <p role="alert">{requestsError}</p>}
          {requestsLoading ? (
            <p>Loading join requests…</p>
          ) : requests.length === 0 ? (
            <p data-testid="join-requests-empty">No pending join requests.</p>
          ) : (
            <ul data-testid="join-request-list">
              {requests.map((request) => (
                <li key={request.id} data-testid="join-request-item">
                  <span>{request.requester.displayName}</span>
                  <button
                    type="button"
                    disabled={decidingId === request.id}
                    onClick={() => {
                      void decide(request.id, 'APPROVED');
                    }}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={decidingId === request.id}
                    onClick={() => {
                      void decide(request.id, 'REJECTED');
                    }}
                  >
                    Reject
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </section>
  );
}
