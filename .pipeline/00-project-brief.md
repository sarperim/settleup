# Project Brief: Settle Up

## 1. Elevator Pitch
Settle Up is a small, web-only MVP for a friend group of around 8 people who share expenses on trips and dinners. Members log who paid and how the cost splits, and the app shows simplified balances — exactly who pays whom to settle everything up with the fewest transactions. Single currency (TRY), real accounts, groups private to their members.

## 2. Problem Statement
Today the friend group (~8 people) tracks shared expenses on trips and dinners with nothing formal — memory and cash on the table. The group loses track of who owes whom after shared events, and as a direct result someone always ends up over- or under-paying real money. The cost is ongoing: unfair outcomes in actual money after every trip and dinner, and recurring confusion about who owes what.

## 3. Business Objectives
- **OBJ-001 — Replace informal tracking.** The friend group adopts Settle Up as the single record of its shared expenses. Target: all ~8 members hold registered accounts, and the group's shared trip/dinner expenses are logged in the app instead of tracked informally.
- **OBJ-002 — Settle with the fewest payments.** For any set of group balances, the app suggests a payment plan using the minimum achievable number of transactions to zero out all balances.
- **OBJ-003 — Stay fast and simple.** Logging an expense takes ≤ 30 seconds; pages load in ≤ 2 seconds on a normal connection.
- **OBJ-004 — Be exactly correct.** After every operation, the sum of all member balances within a group is exactly 0.00 TRY — no rounding drift, ever.
- **OBJ-005 — Keep groups private.** Only approved members of a group can see its expenses, balances, and members.

## 4. Stakeholders & Personas
- **The Owner (project author).** Builds, hosts, and maintains the app; manually resets forgotten passwords on request; is also one of the ~8 group members and a regular user. Success looks like: the friend group stops losing track of who owes whom, and the app runs cheaply and unattended.
- **Friend-group member** (the other ~7 people, plus the owner). Registers with email + password + display name, creates or joins groups via a join code, logs trip and dinner expenses, checks balances, marks settlements. Success looks like: always knowing exactly who owes whom, and settling with as few payments as possible.
- **Group creator** (a role any registered member can take by creating a group). Creates the group, holds its join code/link, and approves or rejects join requests. Success looks like: only the intended friends become members.

## 5. Scope — In
**Accounts & access**
- Open registration: anyone can create an account with email + password + display name (display name is what other members see).
- Log in with email + password.
- Change password: a logged-in user can change their own password from the web page.

**Groups**
- Any registered user can create a group and becomes its creator.
- The creator receives a join code/link to share.
- A registered user holding the code can request to join; the creator approves before membership takes effect.
- A user can belong to multiple groups at the same time.
- Groups persist indefinitely.

**Expenses**
- Log an expense in a group with: short description (e.g. "dinner Friday"), amount in TRY, one payer, participant members, and split type.
- Split types: **equal** (same share per participant) or **exact amounts** (per-participant amounts).
- Any member can add an expense; only the member who logged it can edit or delete it.
- Created/edited timestamps are recorded automatically; there is no user-editable expense date.

**Balances**
- Per-group running balance for every member; balances never mix across groups.
- Group balances always sum to exactly 0.00 TRY.
- Uneven equal splits (e.g., 100.00 ÷ 3) apply a deterministic, documented remainder rule (see ASM-001).

**Settlement**
- Settlement suggestions: who pays whom, and how much, to zero out all group balances with the minimum number of payments.
- Mark a suggested payment as paid — by either its payer or its recipient.
- Undo a settlement (settled → outstanding) — by the same two actors.
- Debt lifecycle: **outstanding ↔ settled**.

## 6. Scope — Out
- Native mobile apps (web only).
- Email or push notifications of any kind.
- Multi-currency (TRY only).
- Receipt photo uploads or attachments.
- Recurring expenses.
- Actual money movement or payment-provider integration — the app records debts, it never transfers money.
- Offline mode.
- Removing members from a group (once joined, always a member).
- Deleting or archiving groups.
- Self-serve forgotten-password reset (the owner resets manually on request).
- Split methods beyond equal and exact (no percentages, no weighted shares).
- User-editable expense dates.
- Netting or combining balances across different groups.

## 7. Constraints
- Web only; no mobile target.
- Backend: .NET **or** NestJS (either is acceptable; one to be chosen during architecture).
- Frontend: no preference.
- Database: PostgreSQL.
- Hosting: near-free (free tier or small VPS), maintained by the owner.
- No hard deadline.
- Expected scale: ~8 registered users; up to ~5 concurrent groups; 20–50 expenses per trip; ≤ 8 members per group.
- Project size: intentionally small — scoped so the whole MVP can be delivered in one continuous build effort.

## 8. Assumptions
- **ASM-001:** On an uneven equal split, the **payer absorbs the leftover cent** (e.g., 100.00 ÷ 3 → 33.34 for the payer-participant, 33.33 for the others). The user delegated the rule choice with the requirements that it be deterministic and documented. *Validate: confirm with the user before build; whichever rule is chosen must hold the OBJ-004 zero-sum invariant in tests.*
- **ASM-002:** All amounts are entered and stored in TRY with 2 decimal places (kuruş); no other precision exists in the system. *Validate: API/data-model design review.*
- **ASM-003:** Changing password requires entering the current password. *Validate: security review.*
- **ASM-004:** Standard session management exists, including logout. *Validate: architecture phase.*

## 9. Success Criteria
- **SC-001 (→ OBJ-001):** All ~8 friend-group members hold registered accounts, and the group logs its shared expenses in the app across at least one full trip/dinner cycle that ends in settlement.
- **SC-002 (→ OBJ-002):** The settlement suggestion engine returns the minimum achievable number of transactions for a given balance set — verified by a test suite covering edge cases (uneven equal split with remainder, circular debts, single debtor/creditor, zero-balance members). Exact search is acceptable given ≤ 8 members per group.
- **SC-003 (→ OBJ-003):** A member can log an expense (description, amount, payer, participants, split) in ≤ 30 seconds.
- **SC-004 (→ OBJ-003):** Pages load in ≤ 2 seconds on a normal connection.
- **SC-005 (→ OBJ-004):** After every create / edit / delete / settle / undo operation, the group's member balances sum to exactly 0.00 TRY — enforced by tests.
- **SC-006 (→ OBJ-005):** A non-member (anonymous or registered) cannot read or modify a group's expenses, balances, or membership — enforced by authorization tests.
- **SC-007 (→ OBJ-001):** The full lifecycle works end-to-end: group created → members join via code + creator approval → expenses logged (editable/deletable only by their logger) → settlement marked paid by payer or recipient → undo returns the debt to outstanding.

## 10. Glossary
| Term | Definition |
|---|---|
| Group | A shared-expense circle (e.g., a trip or the standing dinner group). Created by any registered user; persists indefinitely. |
| Member | A registered user who has joined a group via its join code and the creator's approval. |
| Group creator | The member who created the group; holds the join code and approves join requests. |
| Join code | The code/link the creator shares; required to request membership. |
| Account | Email + password + display name. Registration is open to anyone. |
| Display name | The name shown to other members inside groups. |
| Expense | A shared cost: short description, amount in TRY, one payer, participants, and a split. |
| Payer | The member who paid the expense up front. |
| Participants | The members among whom the expense is split. |
| Split | How the amount divides among participants: **equal** or **exact amounts**. |
| Remainder cent | The kuruş left over when an equal split doesn't divide evenly; resolved by a deterministic rule (ASM-001: payer absorbs). |
| Balance | A member's net position within one group — positive means owed money, negative means owing. Never mixed across groups. |
| Settlement suggestion | The app's plan of who pays whom, and how much, to zero out all group balances with the minimum number of payments. |
| Settlement | A suggested payment that has been marked as paid. |
| Outstanding | A debt that has not been marked paid. |
| Settled | A debt marked paid by its payer or its recipient; reversible. |
| Change password | A logged-in user replacing their own password (current password required per ASM-003). |
| Password reset | Forgotten-password recovery; performed manually by the owner in this MVP. |
| TRY | Turkish lira — the single currency; amounts recorded to 2 decimal places (kuruş). |
