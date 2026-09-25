# Expense Tracking Analysis

## 1. Overview

Expense Tracking is the shared ledger inside each group — the day-to-day capability of Settle Up. Any member logs an expense with a short description, an amount in TRY, one payer, participant members, and a split (equal or exact). Only the member who logged an expense can edit or delete it. Created/edited timestamps are recorded automatically; there is no user-editable expense date.

Business value: this is where the friend group's shared trip and dinner costs get recorded instead of tracked informally — the core of **OBJ-001**. Fast logging is the **OBJ-003** target (≤ 30 seconds end-to-end, SC-003). This domain also implements the decided **ASM-001 random-spread remainder rule** on uneven equal splits, and its Expense Shares are the input from which Balances & Settlement computes net positions.

## 2. Actors

| Actor | Goal | Frequency |
|---|---|---|
| Group member (logger) | Log who paid and how the cost splits | Frequent during trips: 20–50 expenses per trip (brief §7) |
| Group member (editor/deleter of own expenses) | Correct mistakes in expenses they logged | Occasional |
| Group member (viewer) | Review the group's expense list | Every visit |
| Non-member (anonymous or registered) | Must be denied — cannot read or modify expenses | Adversarial (SC-006) |
| Balances & Settlement (system consumer) | Read expenses and shares to compute member balances | On every ledger change |

## 3. Business Rules

- **BR-EXP-001** — Any member of a group may add an expense to that group. Source: brief §5. Enforced: system.
- **BR-EXP-002** — An expense consists of: a short description, an amount in TRY (2 decimal places, ASM-002), exactly one payer (a group member), one or more participants (group members), and a split type. Payer and participants are chosen independently — the payer may or may not be among the participants. Source: brief §5, §10. Enforced: system.
- **BR-EXP-003** — Split types are exactly two: **equal** and **exact amounts**. No percentages, weighted shares, or other methods (Won't — this release). Source: brief §5, §6. Enforced: system.
- **BR-EXP-004** — Equal split computation (ASM-001, decided 2026-09-25): each participant's base share is the amount divided by the participant count, rounded down to the kuruş; leftover kuruş are assigned one each to randomly chosen distinct participants, with no participant receiving more than one extra kuruş. Source: brief §5, §8 (amended). Enforced: system.
- **BR-EXP-005** — The random draw of BR-EXP-004 happens once, when the expense is created; the resulting shares are stored as the expense's permanent record. Shares are recomputed (with a fresh draw) only when the amount, participants, or split type change on edit. Source: brief §8 (amended ASM-001). Enforced: system.
- **BR-EXP-006** — Exact split: the logger enters per-participant amounts, and the system accepts them only if they sum exactly to the expense amount. Source: brief §5; OBJ-004 zero-sum. Enforced: system.
- **BR-EXP-007** — Only the member who logged an expense can edit or delete it. Source: brief §5. Enforced: system.
- **BR-EXP-008** — Created and edited timestamps are recorded automatically by the system; there is no user-editable expense date (Won't — this release). Source: brief §5, §6. Enforced: system.
- **BR-EXP-009** — Expenses are visible within their group to members only. Source: brief §3 (OBJ-005), §9 (SC-006). Enforced: system.
- **BR-EXP-010** — Amounts are non-negative TRY with at most 2 decimal places; zero (0.00) is a valid amount, negative amounts are not. Source: user decision at report gate, 2026-09-25 (brief silent on zero/negative). Enforced: system.
- **BR-EXP-011** — Deleting an expense permanently removes it and its shares from the ledger; balances thereafter exclude it. Source: brief §5 (delete capability), §9 (SC-005 names delete among zero-sum-preserving operations). Enforced: system.

## 4. Use Cases

### UC-EXP-001 — Log an expense
- Primary actor: group member
- Preconditions: authenticated session; membership in the group
- Main success scenario:
  1. Member opens "add expense" in the group.
  2. Member enters a short description, the amount in TRY, selects the payer, selects one or more participants, and chooses the split type.
  3. If split type is exact, member enters each participant's amount.
  4. System validates: non-negative 2-decimal amount (BR-EXP-010), payer and participants are group members (BR-EXP-002), and — for exact splits — per-participant amounts sum exactly to the total (BR-EXP-006).
  5. System computes the shares: equal → base shares plus the random-spread remainder (BR-EXP-004/005); exact → as entered.
  6. System records the expense with its shares, the logger's identity, and the created timestamp.
  7. System shows the expense in the group ledger; balances reflect it (via Balances & Settlement).
- Alternate flows:
  - A1: Equal split does not divide evenly → remainder kuruş assigned per BR-EXP-004 (random distinct recipients, max one extra each).
- Error flows:
  - E1: Exact amounts do not sum to the total → system rejects; no expense is created.
  - E2: No participant selected → system rejects; no expense is created.
  - E3: Amount invalid (negative, or more than 2 decimals) → system rejects; no expense is created.
  - E4: Actor is not a member of the group → system denies (FR-GRP-008).
- Postconditions: the expense and its shares exist and are stored permanently (until edited or deleted by their logger); balances are updated and the group's member balances still sum to exactly 0.00 TRY (SC-005).

### UC-EXP-002 — Edit an expense
- Primary actor: the member who logged the expense
- Preconditions: the expense exists; the actor is its logger
- Main success scenario:
  1. Logger opens the expense for editing.
  2. Logger changes any of: description, amount, payer, participants, split type (and per-participant amounts for exact splits).
  3. System validates as in UC-EXP-001.
  4. If amount, participants, or split type changed, the system recomputes the shares with a fresh random draw (BR-EXP-005); otherwise the shares are unchanged.
  5. System records the edited timestamp.
- Alternate flows: —
- Error flows:
  - E1: Validation fails → system rejects; the expense is unchanged.
  - E2: A member who is not the logger attempts the edit — even the payer or a participant — → system denies (BR-EXP-007).
- Postconditions: the expense reflects the changes; edited timestamp set; balances reflect the recomputed shares; zero-sum holds (SC-005).

### UC-EXP-003 — Delete an expense
- Primary actor: the member who logged the expense
- Preconditions: the expense exists; the actor is its logger
- Main success scenario:
  1. Logger chooses to delete the expense.
  2. System permanently removes the expense and its shares (BR-EXP-011).
  3. Balances thereafter exclude the deleted expense.
- Alternate flows: —
- Error flows:
  - E1: A member who is not the logger attempts the deletion → system denies (BR-EXP-007).
- Postconditions: the expense and shares no longer exist; zero-sum holds (SC-005).

### UC-EXP-004 — View the group's expenses
- Primary actor: group member
- Preconditions: authenticated session; membership in the group
- Main success scenario:
  1. Member opens the group's expense list.
  2. System shows the group's expenses with their description, amount, payer, participants, shares, and timestamps.
- Alternate flows: —
- Error flows:
  - E1: Actor is not a member → system denies; no expense data is disclosed (FR-GRP-008).
- Postconditions: read-only; no data changes.

## 5. Functional Requirements

- **FR-EXP-001** — The system shall allow a member of a group to record an expense in that group consisting of a description, a TRY amount, one payer, one or more participants, and a split type of equal or exact. Traces to: UC-EXP-001. MoSCoW: **Must**.
- **FR-EXP-002** — The system shall reject an expense whose amount is negative or has more than two decimal places. Traces to: UC-EXP-001 (E3). MoSCoW: **Must**.
- **FR-EXP-003** — The system shall restrict the payer and all participants of an expense to members of that group. Traces to: UC-EXP-001. MoSCoW: **Must**.
- **FR-EXP-004** — The system shall compute each participant's base share of an equal split as the expense amount divided by the participant count, rounded down to the kuruş. Traces to: UC-EXP-001, BR-EXP-004. MoSCoW: **Must**.
- **FR-EXP-005** — The system shall distribute the leftover kuruş of an equal split one each to randomly chosen distinct participants, such that no participant receives more than one extra kuruş. Traces to: UC-EXP-001 (A1), BR-EXP-004. MoSCoW: **Must**.
- **FR-EXP-006** — The system shall store an expense's computed shares as its permanent record, recomputing them (with a fresh random draw for equal splits) only when the amount, participants, or split type change on edit. Traces to: UC-EXP-001, UC-EXP-002, BR-EXP-005. MoSCoW: **Must**.
- **FR-EXP-007** — The system shall accept an exact split only when the entered per-participant amounts sum exactly to the expense amount. Traces to: UC-EXP-001 (E1), BR-EXP-006. MoSCoW: **Must**.
- **FR-EXP-008** — The system shall allow only the member who logged an expense to edit it. Traces to: UC-EXP-002 (E2). MoSCoW: **Must**.
- **FR-EXP-009** — The system shall allow only the member who logged an expense to delete it. Traces to: UC-EXP-003 (E1). MoSCoW: **Must**.
- **FR-EXP-010** — The system shall record the creation time of an expense automatically at creation, the edit time automatically at each edit, and expose no user-editable expense date. Traces to: UC-EXP-001, UC-EXP-002, BR-EXP-008. MoSCoW: **Must**.
- **FR-EXP-011** — The system shall display a group's expense list and expense details to members of that group only. Traces to: UC-EXP-004, BR-EXP-009. MoSCoW: **Must**.
- **FR-EXP-012** — The system shall, on deletion of an expense, permanently remove the expense and its shares so that balances exclude it. Traces to: UC-EXP-003, BR-EXP-011. MoSCoW: **Must**.

**UC coverage:** UC-EXP-001 → FR-EXP-001/002/003/004/005/006/007 · UC-EXP-002 → FR-EXP-006/008/010 · UC-EXP-003 → FR-EXP-009/012 · UC-EXP-004 → FR-EXP-011.

## 6. Non-Functional Requirements

- **NFR-EXP-001** — A member shall be able to log an expense (description, amount, payer, participants, split) end-to-end in ≤ 30 seconds (OBJ-003, SC-003).
- **NFR-EXP-002** — Expense-related pages shall meet the ≤ 2-second page-load target on a normal connection (OBJ-003, SC-004).
- **NFR-EXP-003** — Every expense create/edit/delete operation shall preserve the group zero-sum invariant — member balances sum to exactly 0.00 TRY afterwards (OBJ-004, SC-005). The invariant itself is owned and tested by Balances & Settlement; this domain supplies exact shares (shares sum exactly to the expense amount) as its contribution.
- **NFR-EXP-004** — The ledger shall support the expected scale — 20–50 expenses per trip, ≤ 8 members per group, up to ~5 concurrent groups (brief §7).
- **NFR-EXP-005** — Expenses persist until deleted by their logger; there is no archiving or automatic expiry (brief §5, §6).

## 7. Data Entities

- **Expense** — attributes: group reference, short description, amount (TRY, 2 decimals, non-negative), payer (member), split type (equal | exact), logger (member), created timestamp, edited timestamp (last edit, absent if never edited). Owned by this domain.
- **Expense Share** — attributes: expense reference, participant (member), share amount (TRY, 2 decimals). The shares of one expense sum to exactly the expense amount. Owned by this domain.
- Cardinality: Group 1 — 0..* Expense · Expense 1 — 1..* Expense Share · Member (as logger) 1 — 0..* Expense.

## 8. Dependencies

- **Accounts & Access:** identity of the logger, payer, and participants; the authentication gate (FR-ACC-009).
- **Groups & Membership:** the membership record authorizes who may log and view expenses in a group (FR-GRP-008); the member list populates payer/participant selection.
- **Balances & Settlement (downstream):** consumes Expenses and Expense Shares to compute each member's running per-group balance; depends on this domain's shares summing exactly to the expense amount.
- **External systems:** none.

## 9. Open Questions & Risks

- **OQ-EXP-001 — Decided 2026-09-25 (user, at report gate): one or more participants.** A single-participant expense is allowed and simply nets to zero balance change.
- **OQ-EXP-002 — Decided 2026-09-25 (user, at report gate): zero amounts allowed; negative amounts rejected.** Recorded in BR-EXP-010 and FR-EXP-002.
- **OQ-EXP-003 — Decided 2026-09-25 (user, at report gate): zero-kuruş shares in exact splits are allowed.** A participant may be included at 0.00.
- **R-EXP-001** — The random-spread rule (BR-EXP-004/005) is correctness-critical: a faulty draw could break the zero-sum invariant or the no-doubling promise. Mitigation: property-based tests per the amended SC-002 (exact sum, distinct recipients, max one extra kuruş each).
- **R-EXP-002** — Only the logger can fix an expense; if a logger is unavailable, no one else can correct their entries (no admin override this release — not in brief). Accepted for an 8-person friend group.
