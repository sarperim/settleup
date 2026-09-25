# Accounts & Access Analysis

## 1. Overview

Accounts & Access is the identity foundation of Settle Up. It delivers open registration (email + password + display name), login and logout, self-serve password change, and the owner's manual password-reset procedure for forgotten passwords. Every other domain — Groups & Membership, Expense Tracking, Balances & Settlement — depends on it to know who the acting user is.

Business value: the friend group's ~8 members hold real, registered accounts — the foundation of **OBJ-001** ("all ~8 members hold registered accounts"). Identity is also the prerequisite for the **OBJ-005** privacy boundary: the system must know who someone is before it can decide what they may see.

## 2. Actors

| Actor | Goal | Frequency |
|---|---|---|
| Friend-group member (any registered user) | Register once; log in to record and view expenses; change own password | Registration: once. Login: each visit (daily-ish during trips). Password change: rare. |
| Anonymous visitor | Reach the app; can only register or log in | Occasional (first visits, logged-out sessions) |
| The Owner | Reset a forgotten password manually on request; is also a regular member | Rare |
| Downstream domains (system actors) | Obtain the authenticated user's identity for authorization in groups, expenses, and balances | Every request |

## 3. Business Rules

- **BR-ACC-001** — Registration is open: anyone may create an account with an email address, a password, and a display name. Source: brief §5. Enforced: system (registration page).
- **BR-ACC-002** — An email address identifies at most one account; it cannot be used to register twice. Source: derived from brief §5 (login is by email + password, so the email must identify a single account). Enforced: system.
- **BR-ACC-003** — The display name is the identity other members see inside groups; the email address is login credentials, not a displayed identity. Source: brief §5, §10. Enforced: system (all member-facing displays).
- **BR-ACC-004** — Login succeeds only with an email and password matching an existing account. Source: brief §5. Enforced: system.
- **BR-ACC-005** — Changing a password requires entering the current password. Source: brief ASM-003 (validation scheduled for security review per the brief). Enforced: system (change-password page).
- **BR-ACC-006** — Sessions support logout. Source: brief ASM-004 (validation scheduled for architecture phase). Enforced: system.
- **BR-ACC-007** — Forgotten-password reset is a manual procedure performed by the owner on request; there is no self-serve reset in this release. Source: brief §4 (Owner persona), §6 (scope-out). Enforced: manual procedure outside the application (OQ-ACC-001, decided 2026-09-25).
- **BR-ACC-008** — Email addresses are not verified at registration this release. Source: user decision at report gate, 2026-09-25 (brief was silent). Enforced: n/a — feature intentionally absent (Won't, this release); the owner's manual reset (UC-ACC-005) is the recovery path for a mistyped email.

## 4. Use Cases

### UC-ACC-001 — Register an account
- Primary actor: anonymous visitor
- Preconditions: none
- Main success scenario:
  1. Visitor opens the registration page.
  2. Visitor enters an email address, a password, and a display name.
  3. System validates the input and creates the account.
  4. System confirms registration and establishes an authenticated session for the new account (FR-ACC-010).
- Alternate flows:
  - A1: Email already belongs to an account → system rejects with an error; no account is created.
- Error flows:
  - E1: Missing or invalid input → system rejects with an error; no account is created.
- Postconditions: an account exists with the given email, password, and display name, and the visitor holds an authenticated session for it.

### UC-ACC-002 — Log in
- Primary actor: registered user
- Preconditions: an account exists
- Main success scenario:
  1. User opens the login page and enters email and password.
  2. System authenticates the credentials.
  3. System establishes a session and takes the user to their groups overview.
- Alternate flows: —
- Error flows:
  - E1: Credentials do not match any account → system rejects; no session is established.
- Postconditions: an authenticated session exists for that user.

### UC-ACC-003 — Log out
- Primary actor: logged-in user
- Preconditions: an authenticated session exists
- Main success scenario:
  1. User chooses logout.
  2. System ends the session.
- Alternate flows: —
- Error flows: —
- Postconditions: the session is no longer valid; further access requires login (UC-ACC-002).

### UC-ACC-004 — Change own password
- Primary actor: logged-in user
- Preconditions: authenticated session; user knows their current password
- Main success scenario:
  1. User opens the change-password page.
  2. User enters their current password and a new password.
  3. System verifies the current password (BR-ACC-005).
  4. System stores the new password and confirms.
- Alternate flows: —
- Error flows:
  - E1: Current password incorrect → system rejects; the password is unchanged.
- Postconditions: future logins require the new password. (Behavior of other active sessions: OQ-ACC-003.)

### UC-ACC-005 — Reset a forgotten password (manual, owner-operated)
- Primary actor: the Owner, on behalf of a member
- Preconditions: a member has forgotten their password and reaches the owner outside the app
- Main success scenario:
  1. Member requests a reset from the owner out-of-band.
  2. Owner verifies the member's identity by manual judgment.
  3. Owner sets a new password for the account directly on the database/host, outside the application (OQ-ACC-001, decided).
  4. Owner communicates the new password to the member out-of-band.
  5. Member logs in (UC-ACC-002) and may change the password to a private one (UC-ACC-004).
- Alternate flows: —
- Error flows:
  - E1: Owner cannot verify the member's identity → owner refuses; nothing changes.
- Postconditions: the account's password is the new one.
- **Scope note:** by decision (OQ-ACC-001, 2026-09-25), the reset is performed entirely outside the application; this use case intentionally has no system FR.

### UC-ACC-006 — Access the app anonymously
- Primary actor: anonymous visitor
- Preconditions: none
- Main success scenario:
  1. Visitor opens any application page other than registration or login.
  2. System redirects the visitor to the login page.
- Alternate flows: —
- Error flows: —
- Postconditions: no group, expense, or balance data is displayed.

## 5. Functional Requirements

- **FR-ACC-001** — The system shall allow any visitor to create an account by providing an email address, a password, and a display name. Traces to: UC-ACC-001. MoSCoW: **Must**.
- **FR-ACC-002** — The system shall reject a registration attempt whose email address already belongs to an existing account. Traces to: UC-ACC-001 (A1). MoSCoW: **Must**.
- **FR-ACC-003** — The system shall establish an authenticated session for a user who provides an email address and password matching an existing account. Traces to: UC-ACC-002. MoSCoW: **Must**.
- **FR-ACC-004** — The system shall reject a login attempt whose credentials do not match an existing account, without establishing a session. Traces to: UC-ACC-002 (E1). MoSCoW: **Must**.
- **FR-ACC-005** — The system shall allow a logged-in user to end their own session. Traces to: UC-ACC-003. MoSCoW: **Must**.
- **FR-ACC-006** — The system shall allow a logged-in user to replace their own password by providing the current password and a new password. Traces to: UC-ACC-004. MoSCoW: **Must**.
- **FR-ACC-007** — The system shall reject a password change when the provided current password does not match. Traces to: UC-ACC-004 (E1). MoSCoW: **Must**.
- **FR-ACC-008** — The system shall present a member's display name — not their email address — as that member's identity to other members in group contexts. Traces to: UC-ACC-001, BR-ACC-003. MoSCoW: **Must**.
- **FR-ACC-009** — The system shall require an authenticated session for every function except account registration and login. Traces to: UC-ACC-006. MoSCoW: **Must**.
- **FR-ACC-010** — The system shall establish an authenticated session immediately after a successful registration, without requiring a separate login. Traces to: UC-ACC-001. MoSCoW: **Must**.

**UC coverage:** UC-ACC-001 → FR-ACC-001/002/008/010 · UC-ACC-002 → FR-ACC-003/004 · UC-ACC-003 → FR-ACC-005 · UC-ACC-004 → FR-ACC-006/007 · UC-ACC-005 → **not in scope this release** (manual out-of-app procedure, no system FR by design; OQ-ACC-001 decided) · UC-ACC-006 → FR-ACC-009.

## 6. Non-Functional Requirements

- **NFR-ACC-001** — Passwords shall be stored only in a protected, non-recoverable form; the concrete scheme is an architecture decision. Source: internet-facing, owner-maintained app (brief §4, §7).
- **NFR-ACC-002** — The account system shall operate within the brief's hosting constraint — near-free (free tier or small VPS), maintained unattended by the single owner (brief §7).
- **NFR-ACC-003** — Registration, login, and change-password pages shall meet the ≤ 2-second page-load target on a normal connection (OBJ-003, SC-004).
- **NFR-ACC-004** — Account records shall be retained for the life of the application; account deletion is **Won't (this release)** — the brief's scope-out contains no account deletion.
- **NFR-ACC-005** — The system shall support the expected scale of ~8 registered users and up to ~5 concurrent groups without dedicated operations support (brief §7).

## 7. Data Entities

- **User Account** — attributes: email address (unique login identifier), password (credential), display name (visible identity). Owned by this domain.
- **Session** — an authenticated session tied to a User Account. Attributes: associated user, session state. Owned by this domain (existence per ASM-004; mechanics are an architecture decision).
- Cardinality: User Account 1 — 0..* Session. User Account 1 — 0..* Membership (Membership is owned by Groups & Membership; referenced here for context).

## 8. Dependencies

- **Upstream:** none — this is the base domain.
- **Downstream consumers:** Groups & Membership (memberships tie user accounts to groups; join requests come from registered users), Expense Tracking (logger, payer, and participants are user accounts), Balances & Settlement (balances and payments belong to accounts via memberships). All rely on the FR-ACC-009 authentication gate and on the session identifying the acting user.
- **External systems:** none this release. No email verification and no notifications (brief §6 scope-out) — see OQ-ACC-002.

## 9. Open Questions & Risks

- **OQ-ACC-001 — Decided 2026-09-25 (user, at report gate): (A) out-of-app.** The owner resets passwords directly on the database/host; no in-app owner/admin capability exists this release.
- **OQ-ACC-002 — Decided 2026-09-25 (user, at report gate): no email verification this release.** Recorded as BR-ACC-008. Revisit only if the group grows or accounts multiply.
- **OQ-ACC-003** — Whether other active sessions are invalidated when a password is changed. Deferred to security review together with ASM-003. Impact: a password changed after compromise might leave an old session alive.
- **OQ-ACC-004 — Decided 2026-09-25 (user, at report gate): yes — registration logs the user in.** Implemented as FR-ACC-010.
- **OQ-ACC-005** — Minimum password policy (e.g., length). Brief is silent; deferred to security review. Impact: trivially weak passwords are possible — acceptable for a private friend-group app, but should be decided before build.
- **R-ACC-001** — The owner is a single point of failure for account recovery (no self-serve reset). Mitigation: the owner is also a group member and directly reachable; acceptable at this scale.
- **R-ACC-002** — Without email verification (OQ-ACC-002), account records may contain unreachable email addresses. Mitigation: owner's manual reset (UC-ACC-005).
