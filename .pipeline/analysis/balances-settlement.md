# Balances & Settlement Analysis

## 1. Overview

Balances & Settlement is the "settle up" half of Settle Up. It computes each member's running per-group balance from expense shares and settled payments, never mixes balances across groups, and enforces the exact 0.00 TRY zero-sum invariant (**OBJ-004**, SC-005). It generates settlement suggestions that zero out all group balances with the minimum achievable number of transactions (**OBJ-002**, SC-002), and tracks each suggested payment's lifecycle — outstanding ↔ settled — with mark-paid and undo allowed by either the payer or the recipient.

Business value: this is the capability that ends the "who owes whom" confusion — the friend group settles with the fewest real payments and provably fair, kuruş-exact math. It completes the **OBJ-001** adoption loop (SC-001, SC-007: expenses logged → settlement marked paid → undone when needed). Balances and suggestions are group-private (**OBJ-005**, SC-006).

## 2. Actors

| Actor | Goal | Frequency |
|---|---|---|
| Group member (balance viewer) | See who owes whom | Every visit; especially at trip/dinner end |
| Group member (payer of a suggested payment) | Mark a payment as paid after handing over the money | At settlement time |
| Group member (recipient of a suggested payment) | Mark a payment as paid after receiving the money | At settlement time |
| Non-member (anonymous or registered) | Must be denied — cannot read balances or suggestions | Adversarial (SC-006) |
| Expense Tracking (upstream system actor) | Supplies expenses and shares as balance inputs | On every ledger change |

## 3. Business Rules

- **BR-BAL-001** — Every member has one running balance per group; balances never combine or net across groups. Source: brief §5. Enforced: system.
- **BR-BAL-002** — Balance computation (derived from brief §5 and §10 glossary): a member's balance = (sum of amounts of group expenses they paid as payer) − (sum of their expense shares in the group) + (sum of settled payments they made as payer) + (− sum of settled payments they received as recipient). Positive means owed money; negative means owing. Enforced: system.
- **BR-BAL-003** — After every operation — expense create, edit, delete; payment mark-paid; payment undo — the group's member balances sum to exactly 0.00 TRY. Source: brief §3 (OBJ-004), §9 (SC-005). Enforced: system (invariant, verified by tests).
- **BR-BAL-004** — The settlement suggestion set shall zero out all group balances using the minimum achievable number of payments, computed from the group's current balances. Source: brief §3 (OBJ-002), §5. Enforced: system.
- **BR-BAL-005** — Members with a zero balance are excluded from settlement suggestions. Source: derived from SC-002's zero-balance-members edge case. Enforced: system.
- **BR-BAL-006** — A suggested payment's lifecycle is outstanding ↔ settled: only its payer or its recipient may mark it paid, and only its payer or its recipient may undo it (settled → outstanding). Source: brief §5. Enforced: system.
- **BR-BAL-007** — Settled payments are facts that enter balance computation; outstanding suggestions do not. Source: brief §5 (marking paid is what makes a payment count). Enforced: system.
- **BR-BAL-008** — Outstanding suggestions are a plan, not a fact: they are regenerated whenever group balances change (new/edited/deleted expenses, or an undo). Settled payments are never auto-modified. Source: derived from OBJ-002 — a suggestion set must always zero out the *current* balances, so a stale plan is meaningless. Enforced: system. (Confirmed at report gate, 2026-09-25 — see OQ-BAL-001.)
- **BR-BAL-009** — Balances and settlement suggestions are visible to the group's members only. Source: brief §3 (OBJ-005), §9 (SC-006). Enforced: system.
- **BR-BAL-010** — The app records debts only; it never initiates, executes, or integrates actual money movement (Won't — this release). Source: brief §6. Enforced: n/a — feature intentionally absent.
- **BR-BAL-011** — Settlement suggestions are exact to the kuruş: when exact settlement requires a sub-lira payment (e.g., 0.01 TRY), the suggestion includes it — no rounding of suggestions, consistent with OBJ-004. Source: derived from OBJ-004 exactness. Enforced: system. (Confirmed at report gate, 2026-09-25 — see OQ-BAL-002.)

## 4. Use Cases

### UC-BAL-001 — View group balances
- Primary actor: group member
- Preconditions: authenticated session; membership in the group
- Main success scenario:
  1. Member opens the group's balances view.
  2. System computes and displays each member's running per-group balance (BR-BAL-002).
- Alternate flows: —
- Error flows:
  - E1: Actor is not a member → system denies; no balance data is disclosed (FR-GRP-008).
- Postconditions: read-only; balances unchanged; the displayed balances sum to exactly 0.00 TRY.

### UC-BAL-002 — View settlement suggestions
- Primary actor: group member
- Preconditions: authenticated session; membership in the group
- Main success scenario:
  1. Member opens the group's settle-up view.
  2. System generates the suggestion set from current balances: who pays whom, and how much, using the minimum achievable number of payments (BR-BAL-004), excluding zero-balance members (BR-BAL-005).
  3. System displays the suggestions, distinguishing outstanding from settled payments.
- Alternate flows:
  - A1: All balances are zero → system shows that nothing is owed; no suggestions.
- Error flows:
  - E1: Actor is not a member → system denies (FR-GRP-008).
- Postconditions: read-only; no payment records change.

### UC-BAL-003 — Mark a suggested payment as paid
- Primary actor: the payment's payer or its recipient (either one)
- Preconditions: an outstanding suggested payment exists in the group; actor is one of its two parties
- Main success scenario:
  1. Actor opens the group's settle-up view.
  2. Actor marks the outstanding payment as paid.
  3. System sets the payment's status to settled and includes it in balance computation (BR-BAL-007).
  4. Balances update; the zero-sum invariant holds (BR-BAL-003).
- Alternate flows: —
- Error flows:
  - E1: Actor is neither the payment's payer nor its recipient → system denies.
- Postconditions: the payment is settled; balances reflect it; outstanding suggestions regenerate against the new balances (BR-BAL-008).

### UC-BAL-004 — Undo a settlement
- Primary actor: the payment's payer or its recipient (either one)
- Preconditions: a settled payment exists in the group; actor is one of its two parties
- Main success scenario:
  1. Actor opens the group's settle-up view.
  2. Actor undoes the settled payment.
  3. System returns the payment to outstanding and excludes it from balance computation.
  4. Balances update; the zero-sum invariant holds (BR-BAL-003); outstanding suggestions regenerate (BR-BAL-008).
- Alternate flows: —
- Error flows:
  - E1: Actor is neither the payment's payer nor its recipient → system denies.
- Postconditions: the payment is outstanding again; balances exclude it.

## 5. Functional Requirements

- **FR-BAL-001** — The system shall compute and display a running balance for every member of a group. Traces to: UC-BAL-001. MoSCoW: **Must**.
- **FR-BAL-002** — The system shall compute a group's member balances solely from that group's expenses and settled payments, never combining balances across groups. Traces to: UC-BAL-001, BR-BAL-001. MoSCoW: **Must**.
- **FR-BAL-003** — The system shall preserve the invariant that a group's member balances sum to exactly 0.00 TRY after every expense create, edit, or delete and after every payment mark-paid or undo. Traces to: UC-BAL-001, UC-BAL-003, UC-BAL-004, BR-BAL-003 (cross-domain operations per SC-005). MoSCoW: **Must**.
- **FR-BAL-004** — The system shall generate, from a group's current balances, a settlement suggestion set that zeroes all balances using the minimum achievable number of payments. Traces to: UC-BAL-002, BR-BAL-004. MoSCoW: **Must**.
- **FR-BAL-005** — The system shall exclude members with a zero balance from settlement suggestions. Traces to: UC-BAL-002 (A1 context), BR-BAL-005. MoSCoW: **Must**.
- **FR-BAL-006** — The system shall allow a suggested payment to be marked paid only by its payer or its recipient. Traces to: UC-BAL-003, BR-BAL-006. MoSCoW: **Must**.
- **FR-BAL-007** — The system shall, when a payment is marked paid, set its status to settled and include its amount in balance computation. Traces to: UC-BAL-003, BR-BAL-007. MoSCoW: **Must**.
- **FR-BAL-008** — The system shall allow a settled payment to be undone only by its payer or its recipient, returning it to outstanding. Traces to: UC-BAL-004, BR-BAL-006. MoSCoW: **Must**.
- **FR-BAL-009** — The system shall, when a payment is undone, exclude its amount from balance computation and regenerate outstanding suggestions against the updated balances. Traces to: UC-BAL-004, BR-BAL-008. MoSCoW: **Must**.
- **FR-BAL-010** — The system shall display balances and settlement suggestions to members of the group only. Traces to: UC-BAL-001 (E1), UC-BAL-002 (E1), BR-BAL-009. MoSCoW: **Must**.

**UC coverage:** UC-BAL-001 → FR-BAL-001/002/003/010 · UC-BAL-002 → FR-BAL-004/005/010 · UC-BAL-003 → FR-BAL-006/007/003 · UC-BAL-004 → FR-BAL-008/009/003.

## 6. Non-Functional Requirements

- **NFR-BAL-001** — The zero-sum invariant shall be verified by tests after every create / edit / delete / settle / undo operation (SC-005) — exact 0.00 TRY, no rounding drift, ever (OBJ-004).
- **NFR-BAL-002** — The suggestion engine shall be verified by a test suite covering the edge cases named in SC-002: uneven equal split with remainder (asserted by properties: exact sum, distinct recipients, max one extra kuruş each), circular debts, single debtor/creditor, and zero-balance members — and shall return the minimum achievable transaction count in each case.
- **NFR-BAL-003** — Exact (exhaustive) search is acceptable for the suggestion engine given ≤ 8 members per group (SC-002 note, brief §7 scale) — no heuristic approximation is required.
- **NFR-BAL-004** — Balances and settle-up pages shall meet the ≤ 2-second page-load target on a normal connection (OBJ-003, SC-004).
- **NFR-BAL-005** — Settled payment records shall be retained for the life of the application, consistent with groups persisting indefinitely (brief §5); there is no archiving or purge.

## 7. Data Entities

- **Member Balance** — one per (group, member): the member's net position in TRY (positive = owed money, negative = owing). Derived from Expense Shares and Settlement Records (whether stored or computed on demand is an architecture decision). Owned by this domain.
- **Settlement Record (suggested payment)** — attributes: group, payer (member), recipient (member), amount (TRY, 2 decimals), status (outstanding | settled). Owned by this domain.
- Cardinality: Group 1 — 0..* Settlement Record · Member 1 — 0..* Settlement Record (as payer and/or recipient across records) · Group 1 — 1..* Member Balance (one per member).

## 8. Dependencies

- **Expense Tracking:** expenses (payer amounts) and Expense Shares are the primary balance inputs; this domain relies on shares summing exactly to each expense's amount (FR-EXP-004/005/006/007).
- **Groups & Membership:** the membership record defines whose balances exist and who may view them (FR-GRP-008); the privacy rule is restated as FR-BAL-010.
- **Accounts & Access:** member identity for balances and payment parties; the authentication gate (FR-ACC-009).
- **External systems:** none — no payment providers, banks, or money movement of any kind (BR-BAL-010, brief §6).

## 9. Open Questions & Risks

- **OQ-BAL-001 — Decided 2026-09-25 (user, at report gate): confirmed.** Outstanding suggestions are a live plan that regenerates whenever balances change; settled payments are permanent facts, changed only by manual undo. Implemented as BR-BAL-008/009.
- **OQ-BAL-002 — Decided 2026-09-25 (user, at report gate): confirmed — suggestions stay kuruş-exact.** Sub-lira payments (e.g., "Ayşe pays Ali 0.01 TRY") will be suggested when balances require. Implemented as BR-BAL-011.
- **R-BAL-001** — Either party can mark a payment paid, so a recipient could mark it before money actually changed hands (or a payer optimistically after handing over cash). This is by design (brief §5) — it enables cash confirmation without a second confirmation step — but relies on the two members being honest with each other. Accepted at friend-group scale.
- **R-BAL-002** — The minimum-transaction engine is correctness-critical: a non-minimal or non-zeroing plan breaks OBJ-002. Mitigation: the SC-002 edge-case test suite (NFR-BAL-002), with exact search permitted at ≤ 8 members.
