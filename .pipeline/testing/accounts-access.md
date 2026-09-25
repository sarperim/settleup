# Accounts & Access Test Plan

Status: **approved at Gate 2** (2026-09-25) · Date: 2026-09-25
Domain report: `.pipeline/analysis/accounts-access.md` · Architecture: `01-system-architecture.md` (C2, §8.1–8.5), `02-data-model.md` (users/sessions), `03-api-design.md` (§2, §4) · Inherits every rule of `.pipeline/testing/00-test-strategy.md` (approved at Gate 1).

> **Gate 2 resolution (2026-09-25):** approved with all review findings resolved as strengthenings/clarifications — no test case was weakened. (F1) session behavior after an owner CLI password reset is unspecified upstream → recorded as a §1 exclusion; (F2) TC-ACC-030's stored-email observation point is now a direct `users`-row read; (F3) e2e TC-ACC-024…027 are self-contained (unique identities, in-test UI setup) per determinism rule 1; (nit) TC-ACC-031 asserts the 429 carries no `details` field, and TC-ACC-022 gained a `403 CSRF_HEADER_MISSING` trigger. No tickets exist yet — nothing to re-validate.

**Conventions for all integration cases below** (from the strategy): every state-changing HTTP call carries `X-Requested-With: XMLHttpRequest`; the app under test boots in-process (supertest) against a real PostgreSQL; every test starts from truncated tables; the test bootstrap sets `COOKIE_SECURE=true` so cookie attributes are assertable; fixture identities are fixed (`alice@test.local`, `bob@test.local`, `carol@test.local`; passwords `password-1`, `password-2`, …). Factories per strategy §5. The login-throttle's in-memory counters are reset between tests by the harness — a required testability hook on the auth module (the counters are not database state and would otherwise couple tests through shared (email, IP) keys).

## 1. Scope

**Covered here:** FR-ACC-001…010 · UC-ACC-001…006 (UC-ACC-005 limited to its automatable CLI surface — decided at Gate 1) · NFR-ACC-001, 003, 004, 005 · BR-ACC-001…008 · D-ARCH-002 (session invalidation on password change) · D-ARCH-003 (password policy) · ASM-003 (current password required) · ASM-004 (session management incl. logout) · the auth portion of the API error contract (§4 envelope) and the CSRF baseline on auth routes.

**Deliberately NOT tested here, and why:**

| Exclusion | Reason |
|---|---|
| Login-throttle 15-minute window expiry (wall-clock rollover) | No clock injection (strategy T6/G-6). The rest of the throttle contract — threshold, blocking, keying, reset-on-success, check order — is fully tested (TC-ACC-031/032/033) against the architect amendment of 2026-09-25 |
| 30-day wall-clock session expiry rollover | Strategy T6/G-6: no clock injection; structural check only (TC-ACC-017) |
| Owner's out-of-app identity verification (UC-ACC-005 step 2) and refusal flow (E1) | Human judgment performed outside the application — not automatable by design |
| Absence of email verification (BR-ACC-008) | Feature intentionally absent; its observable consequence — registration completes with a session and no verification round-trip — is asserted by TC-ACC-001/023 |
| NFR-ACC-002 (near-free hosting) | Deployment-design property — architecture review, not an app behavior |
| Group-scoped UI flows (member lists, expenses) | Owned by the Groups & Membership and Expense Tracking plans; this plan verifies FR-ACC-008 at the API payload level (TC-ACC-018) |
| NFR-ACC-005 (scale) | No accounts-specific scale behavior; verified by the multi-user/multi-group fixtures of the Groups & Membership plan (cross-referenced in `99-coverage-matrix.md`) |
| Session behavior after an owner CLI password reset (`set-password.js`, TC-ACC-028) | Unspecified upstream: arch §10's runbook says the script writes the Argon2id hash but is silent on whether it also deletes the user's session rows (D-ARCH-002 covers the API password-change path only). Intentionally untested. **Recommendation recorded for the owner:** if the runbook is ever amended to have the script clear the user's sessions (mirroring D-ARCH-002's compromise rationale), TC-ACC-028 gains that assertion via the change-propagation rule |

## 2. Test Cases

### TC-ACC-001 — Register with valid input creates the account and opens a session
- Traces to: FR-ACC-001, FR-ACC-010, UC-ACC-001 (main), BR-ACC-001, BR-ACC-008, ASM-004
- Level: integration
- Preconditions: empty database
- Steps:
  1. `POST /api/auth/register` with `{ email: "alice@test.local", password: "password-1", displayName: "Alice" }`
  2. `GET /api/auth/me` with the returned session cookie
- Expected result:
  1. `201`; body `{ user }` with `user.displayName = "Alice"` and `user.id` a non-empty string; `Set-Cookie` header present for `settleup_session`; registration completes with **no** email-verification round-trip of any kind
  2. `200` `{ user }` with the same `id` — the registration session is authenticated (FR-ACC-010)

### TC-ACC-002 — Registration with an email that already belongs to an account is rejected
- Traces to: FR-ACC-002, UC-ACC-001 (A1), BR-ACC-002
- Level: integration
- Preconditions: `alice@test.local` registered (factory)
- Steps:
  1. `POST /api/auth/register` with `{ email: "alice@test.local", password: "password-9", displayName: "Impostor" }`
  2. `POST /api/auth/login` with `{ email: "alice@test.local", password: "password-9" }`
- Expected result:
  1. `409`, code `EMAIL_TAKEN`, `error.details.field = "email"`; **no** `Set-Cookie` header in the response
  2. `401 INVALID_CREDENTIALS` — no second account was created (the impostor password does not authenticate)

### TC-ACC-003 — Duplicate-email detection is case-insensitive
- Traces to: FR-ACC-002, BR-ACC-002, data-model §4 ("email lowercased at write" + `@unique`)
- Level: integration
- Preconditions: `alice@test.local` registered
- Steps: `POST /api/auth/register` with `{ email: "ALICE@Test.Local", … }`
- Expected result: `409 EMAIL_TAKEN` — the case-variant email resolves to the same account identity

### TC-ACC-004 — Registration field validation (parameterized)
- Traces to: FR-ACC-001, UC-ACC-001 (E1), D-ARCH-003, API §1 field limits
- Level: integration
- Preconditions: empty database for each row (each row is an isolated iteration)
- Steps: `POST /api/auth/register` with the row's payload (valid rows use a fresh unique email):

| Row | Input | Expected |
|---|---|---|
| a | password `"1234567"` (7 chars) | `400 VALIDATION_FAILED`, details name `password` |
| b | password 8 chars (`"aaaaaaaa"` — also proves: no composition rules) | `201` |
| c | password 128 chars | `201` |
| d | password 129 chars | `400 VALIDATION_FAILED` |
| e | displayName `""` | `400 VALIDATION_FAILED` |
| f | displayName 1 char | `201` |
| g | displayName 50 chars | `201` |
| h | displayName 51 chars | `400 VALIDATION_FAILED` |
| i | email `"not-an-email"` | `400 VALIDATION_FAILED` |
| j | email field missing | `400 VALIDATION_FAILED` |
| k | password field missing | `400 VALIDATION_FAILED` |
| l | displayName field missing | `400 VALIDATION_FAILED` |

- Expected result: per table — every invalid row rejected with **no account created** (a follow-up login with that row's credentials → `401`); every valid row creates the account and a session

### TC-ACC-005 — Login with matching credentials opens a session
- Traces to: FR-ACC-003, UC-ACC-002 (main), BR-ACC-004, ASM-004
- Level: integration
- Preconditions: `alice@test.local` registered with `password-1`
- Steps:
  1. `POST /api/auth/login` `{ email: "alice@test.local", password: "password-1" }`
  2. `GET /api/auth/me` with the returned cookie
- Expected result:
  1. `200` `{ user }` with `displayName = "Alice"`; `Set-Cookie: settleup_session=…`
  2. `200` — session is valid

### TC-ACC-006 — Login with a wrong password is rejected without a session
- Traces to: FR-ACC-004, UC-ACC-002 (E1)
- Level: integration
- Preconditions: `alice@test.local` registered
- Steps: `POST /api/auth/login` `{ email: "alice@test.local", password: "wrong-password" }`
- Expected result: `401`, code `INVALID_CREDENTIALS`; response contains **no** `Set-Cookie` header

### TC-ACC-007 — Login with a nonexistent email is rejected identically (no account enumeration)
- Traces to: FR-ACC-004, UC-ACC-002 (E1), API §2 ("generic — no enumeration on login")
- Level: integration
- Preconditions: `alice@test.local` registered (for the comparison baseline)
- Steps:
  1. `POST /api/auth/login` `{ email: "alice@test.local", password: "wrong-password" }` (capture full error body)
  2. `POST /api/auth/login` `{ email: "ghost@test.local", password: "wrong-password" }`
- Expected result: both `401`; status, `error.code`, and `error.message` are **identical** between the two responses — a nonexistent email is indistinguishable from a wrong password; no `Set-Cookie` on either

### TC-ACC-008 — Logout ends the session
- Traces to: FR-ACC-005, UC-ACC-003 (main), BR-ACC-006, ASM-004
- Level: integration
- Preconditions: alice holds a valid session cookie
- Steps:
  1. `POST /api/auth/logout` with the cookie
  2. `GET /api/auth/me` with the same (now revoked) cookie
  3. `GET /api/groups` with the same cookie
- Expected result:
  1. `204`, empty body
  2. `401 UNAUTHENTICATED`
  3. `401 UNAUTHENTICATED` — the revoked token grants nothing anywhere

### TC-ACC-009 — Logout without a valid session is rejected
- Traces to: FR-ACC-009 (guard), UC-ACC-003 (error side)
- Level: integration
- Preconditions: alice logged in, then logged out (factory)
- Steps: `POST /api/auth/logout` with no cookie; then again with the revoked cookie
- Expected result: both `401 UNAUTHENTICATED`

### TC-ACC-010 — Change password with the correct current password
- Traces to: FR-ACC-006, UC-ACC-004 (main), ASM-003, BR-ACC-005
- Level: integration
- Preconditions: alice registered with `password-1`, holding a session
- Steps:
  1. `POST /api/auth/password` `{ currentPassword: "password-1", newPassword: "password-2" }`
  2. `POST /api/auth/login` with `password-1`
  3. `POST /api/auth/login` with `password-2`
- Expected result:
  1. `204`
  2. `401 INVALID_CREDENTIALS` — old password no longer accepted
  3. `200` + session — new password accepted

### TC-ACC-011 — Change password with a wrong current password is rejected, password unchanged
- Traces to: FR-ACC-007, UC-ACC-004 (E1), ASM-003
- Level: integration
- Preconditions: alice registered with `password-1`
- Steps:
  1. `POST /api/auth/password` `{ currentPassword: "not-my-password", newPassword: "password-2" }`
  2. `POST /api/auth/login` with `password-1`; with `password-2`
- Expected result:
  1. `400`, code `INVALID_CURRENT_PASSWORD`
  2. `password-1` → `200`; `password-2` → `401` — nothing changed

### TC-ACC-012 — Password change invalidates all other sessions, keeps the current one
- Traces to: D-ARCH-002, FR-ACC-006, UC-ACC-004 (postcondition)
- Level: integration
- Preconditions: alice logged in twice — cookies A and B (two distinct sessions)
- Steps:
  1. `POST /api/auth/password` with cookie A: `{ currentPassword: "password-1", newPassword: "password-2" }`
  2. `GET /api/auth/me` with cookie A
  3. `GET /api/auth/me` with cookie B
- Expected result:
  1. `204`
  2. `200` — the acting session survives
  3. `401 UNAUTHENTICATED` — the other session is revoked

### TC-ACC-013 — New-password policy enforced at change (boundary values)
- Traces to: D-ARCH-003, FR-ACC-006, API §2 (`VALIDATION_FAILED` policy)
- Level: integration
- Preconditions: alice with a valid session and known current password; truncated DB per row
- Steps: `POST /api/auth/password` with correct `currentPassword` and the row's `newPassword`:

| Row | newPassword length | Expected |
|---|---|---|
| a | 7 | `400 VALIDATION_FAILED` |
| b | 8 | `204` |
| c | 128 | `204` |
| d | 129 | `400 VALIDATION_FAILED` |

### TC-ACC-014 — CSRF header required on all state-changing auth routes
- Traces to: API §1 (CSRF), arch. §8.2
- Level: integration
- Preconditions: per route — valid body; session cookie where the route is authenticated
- Steps: call each of `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `POST /api/auth/password` **without** the `X-Requested-With` header (all other input valid)
- Expected result: each → `403`, code `CSRF_HEADER_MISSING`; no side effect occurs (in particular: the header-less register/login attempts create no account and no session)

### TC-ACC-015 — Anonymous access to every protected endpoint is rejected
- Traces to: FR-ACC-009, UC-ACC-006 (API aspect), arch. §8.1 layer 1
- Level: integration
- Preconditions: empty database; no cookie
- Steps: call each protected endpoint with no session cookie and a syntactically valid body/path (dummy ids permitted — the auth guard fires first):

`POST /api/auth/logout` · `GET /api/auth/me` · `POST /api/auth/password` · `POST /api/groups` · `GET /api/groups` · `GET /api/groups/:groupId` · `GET /api/groups/:groupId/members` · `GET /api/groups/:groupId/join-requests` · `POST /api/join-requests` · `POST /api/join-requests/:requestId/approve` · `POST /api/join-requests/:requestId/reject` · `GET /api/join-info?code=AAAAAAAA` · `POST /api/groups/:groupId/expenses` · `GET /api/groups/:groupId/expenses` · `GET /api/groups/:groupId/expenses/:expenseId` · `PATCH /api/groups/:groupId/expenses/:expenseId` · `DELETE /api/groups/:groupId/expenses/:expenseId` · `GET /api/groups/:groupId/balances` · `GET /api/groups/:groupId/settlements` · `POST /api/groups/:groupId/settlements` · `POST /api/groups/:groupId/settlements/:settlementId/undo`

- Expected result: **all 21** → `401`, code `UNAUTHENTICATED`, error-envelope shape. This is the exhaustive enumeration of the API surface minus the two public routes (`register`, `login`)

### TC-ACC-016 — Session cookie attributes
- Traces to: ASM-004, arch. §4 (auth-cookie row), NFR-ACC-001 context
- Level: integration
- Preconditions: test bootstrap sets `COOKIE_SECURE=true`
- Steps: `POST /api/auth/login` (valid); inspect the `Set-Cookie` header
- Expected result: cookie name is `settleup_session`; the header's attributes include `HttpOnly`, `Secure`, and `SameSite=Lax`

### TC-ACC-017 — Session row and expiry window (structural)
- Traces to: ASM-004, arch. §8.1 (server-side sessions, sliding 30-day expiry)
- Level: integration
- Preconditions: empty database
- Steps:
  1. `POST /api/auth/login` as alice (one login)
  2. Read the `sessions` table directly (documented data model)
  3. `GET /api/auth/me` with the cookie
- Expected result:
  2. exactly one row for alice; `tokenHash` is a 64-character hex string (SHA-256) and **not** the raw cookie token (tokens stored hashed); `expiresAt` ∈ [row `createdAt` + 29 days, row `createdAt` + 31 days]
  3. `200` — the session remains valid across requests
- Note: the 30-day wall-clock rollover itself is not automated (strategy G-6)

### TC-ACC-018 — Group-scoped payloads never expose email addresses
- Traces to: FR-ACC-008, BR-ACC-003, arch. §6 (FR-ACC-008 row)
- Level: integration
- Preconditions: fixture — alice (creator), bob (approved member), carol (pending join request), one expense paid by alice splitting alice+bob. Built with the factories (which use only the public API)
- Steps: as alice, call `GET /api/groups/:groupId`, `GET …/members`, `GET …/join-requests`, `GET …/expenses`, `GET …/expenses/:expenseId`, `GET …/balances`, `GET …/settlements`
- Expected result: in **every** response — (a) the raw string of any member's email address (`alice@test.local`, `bob@test.local`, `carol@test.local`) appears nowhere in the body; (b) every user reference carries `displayName`; (c) the three members are distinguishable by display name ("Alice", "Bob", "Carol")

### TC-ACC-019 — Password hashing uses Argon2id with the specified parameters
- Traces to: NFR-ACC-001, arch. §4 (Argon2id row)
- Level: unit
- Preconditions: none (pure call to the app's hashing utility)
- Steps: hash a known password with the application's hashing function; decode the encoded hash string; verify the same password and a wrong password against it
- Expected result: encoded hash identifies algorithm `argon2id` with `m=19456` (KiB), `t=2`, `p=1`; verification succeeds for the correct password and fails for the wrong one

### TC-ACC-020 — Stored credential is an Argon2id hash, never plaintext
- Traces to: NFR-ACC-001, data-model §4 (`users.passwordHash`)
- Level: integration
- Preconditions: alice registered with known password
- Steps: read the `users` row for alice
- Expected result: `passwordHash` matches `^\$argon2id\$`; `passwordHash ≠ "password-1"`; the plaintext password is not derivable from the row (format check only — deterministic)

### TC-ACC-021 — Passwords never appear in logs
- Traces to: NFR-ACC-001, arch. §8.4 ("emails and session tokens never logged" — extended here to passwords, per NFR-ACC-001's "no password ever logged")
- Level: integration
- Preconditions: app bootstrap routes pino output to a captured in-memory destination (test harness)
- Steps: register and then log in as a fresh user with the distinctive password `"Sup3r-Secret-Pw-9x"`; then log out; scan every captured log line
- Expected result: zero occurrences of the substring `Sup3r-Secret-Pw-9x` in the captured log output

### TC-ACC-022 — Error responses follow the single error contract
- Traces to: API §4, arch. §8.3
- Level: integration
- Preconditions: mixed (per trigger)
- Steps: trigger, in isolation: duplicate registration (`409 EMAIL_TAKEN`), invalid registration field (`400 VALIDATION_FAILED`), wrong login password (`401 INVALID_CREDENTIALS`), anonymous `GET /api/auth/me` (`401 UNAUTHENTICATED`), wrong current password (`400 INVALID_CURRENT_PASSWORD`), state-changing call without the CSRF header (`403 CSRF_HEADER_MISSING` — e.g. `POST /api/auth/login`, valid body, no `X-Requested-With`)
- Expected result: every response body is exactly `{ "error": { "code": <string>, "message": <string>, "details"?: <object> } }` — no other top-level keys, no stack traces, no internal identifiers beyond the documented `details`

### TC-ACC-023 — Register through the UI lands the user in the app
- Traces to: UC-ACC-001 (main), FR-ACC-001, FR-ACC-010
- Level: e2e
- Preconditions: fresh e2e database; browser not authenticated
- Steps: open `/register`; fill displayName "Alice", email `alice@test.local`, password; submit
- Expected result: the SPA navigates to the groups overview (`/`); Alice's display name is visible; no login step is required; no email-verification step appears

### TC-ACC-024 — Login through the UI reaches the groups overview
- Traces to: UC-ACC-002 (main, step 3)
- Level: e2e
- Preconditions: self-contained — as in-test setup the test registers `bob@test.local` ("Bob") through the UI (`/register`), which lands the user in the app, then logs out via the UI. Unique identity; no dependency on any other e2e case (order-independent)
- Steps: open `/login`; fill bob's credentials; submit
- Expected result: navigates to the groups overview (`/`)

### TC-ACC-025 — Logout ends the UI session; protected routes redirect anonymous visitors
- Traces to: UC-ACC-003 (main), UC-ACC-006 (SPA aspect), FR-ACC-009
- Level: e2e
- Preconditions: self-contained — as in-test setup the test registers `carol@test.local` ("Carol") through the UI and creates a group ("Trip") from the groups overview, noting its `:groupId`; the browser is logged in as carol
- Steps:
  1. Trigger logout from the UI
  2. Navigate to a protected deep link (`/groups/:groupId`)
- Expected result:
  1. browser is at `/login`
  2. redirected to `/login`; **no** group, expense, or balance data is rendered at any point

### TC-ACC-026 — Change password through the UI
- Traces to: UC-ACC-004 (main)
- Level: e2e
- Preconditions: self-contained — as in-test setup the test registers `dave@test.local` ("Dave") through the UI with `password-1`; the browser is logged in as dave
- Steps: open `/change-password`; enter current (`password-1`) + new (`password-2`); submit; log out; log in with `password-2`; attempt login with `password-1` (separate check)
- Expected result: change confirmed in UI; new password logs in; old password shows the login error and stays on `/login`

### TC-ACC-027 — Auth pages meet the page-load budget
- Traces to: NFR-ACC-003, SC-004, OBJ-003
- Level: e2e
- Preconditions: app built and served (e2e phase); self-contained — the test first registers a fresh user through the UI (own identity, `erin@test.local`) so that `/change-password`, a protected route, renders instead of redirecting to `/login` (UC-ACC-006)
- Steps: load `/login`, `/register`, `/change-password`; measure page load per the T4 policy (median of 3, one retry on breach)
- Expected result: each page's median load time ≤ **2.0 s**

### TC-ACC-028 — Owner password-reset CLI sets a new working password
- Traces to: UC-ACC-005 (automatable steps 3 + 5), BR-ACC-007, arch. §10 runbook, OQ-ACC-001 (decided)
- Level: system (runs in the e2e phase, post-build, against `E2E_DATABASE_URL`)
- Preconditions: built artifact exists; user `alice@test.local` with old password `password-1`
- Steps:
  1. Exec `node dist/scripts/set-password.js alice@test.local` from `apps/api`, supplying the new password `password-cli-1` via **stdin** (the script must accept non-interactive stdin input — this is a testability requirement on the script)
  2. `POST /api/auth/login` with `password-cli-1`
  3. `POST /api/auth/login` with `password-1`
- Expected result:
  1. process exits `0`
  2. `200` + session — the CLI-set password authenticates
  3. `401` — the old password is dead
- Note: UC-ACC-005 steps 1–2 and E1 (identity verification, refusal) are the owner's out-of-app human procedure — not automatable, not tested. Session behavior after a CLI reset is unspecified upstream (arch §10 runbook is silent; D-ARCH-002 covers the API path only) — intentionally untested, see §1

### TC-ACC-029 — Account persists across the full exercised lifecycle
- Traces to: NFR-ACC-004 (positive aspect)
- Level: integration
- Preconditions: empty database
- Steps: register alice → log in → change password → log out → log in with the new password; then `GET /api/auth/me`
- Expected result: every step succeeds as specified above; the account's id, email, and displayName are unchanged throughout. (The absence of any account-deletion route is a contract-review fact — `03-api-design.md` defines none — not a runtime test)

### TC-ACC-030 — Email case normalization at login
- Traces to: BR-ACC-002 context, data-model §4 ("email lowercased at write"), API §1 ("email valid + lowercased")
- Level: integration
- Preconditions: empty database
- Steps:
  1. `POST /api/auth/register` with `{ email: "Alice@Test.Local", password: "password-1", displayName: "Alice" }`
  2. `POST /api/auth/login` with `{ email: "Alice@Test.Local", password: "password-1" }` — the email exactly as typed at registration
- Expected result:
  1. `201` + session — reading the `users` row directly (documented data model), `email = "alice@test.local"` (the stored form is lowercased)
  2. `200` + session — login input is normalized to lowercase before lookup, so mixed-case credentials authenticate to the same account
- Contract decided by the user at Gate 2 (2026-09-25): **login normalizes email case**. Recorded upstream in `03-api-design.md` by architect amendment (same date).

### TC-ACC-031 — Login throttle blocks the (email, IP) pair after ten failed attempts
- Traces to: NFR-ACC-001 (throttle translation), arch. §8.2 (amended 2026-09-25), API §4 (429 `TOO_MANY_ATTEMPTS`), UC-ACC-002 (E1 context)
- Level: integration
- Preconditions: empty database; `alice@test.local` registered with `password-1`; in-memory throttle counters reset (harness hook, see conventions); all requests originate from the test client's single IP
- Steps:
  1. `POST /api/auth/login` ten times with `{ email: "alice@test.local", password: "wrong-password" }`
  2. An 11th attempt with the **correct** password
  3. A 12th attempt with a wrong password
  4. While throttled, an attempt with a malformed body (missing `password` field)
  5. `POST /api/auth/register` with a fresh valid email
- Expected result:
  1. all ten → `401 INVALID_CREDENTIALS` (the first ten counted failures are processed normally; the 10th itself returns 401)
  2. `429`, code `TOO_MANY_ATTEMPTS`, standard error envelope with **no `details` field**, no `Retry-After` header, no session — correct credentials are blocked while throttled
  3. `429 TOO_MANY_ATTEMPTS`
  4. `400 VALIDATION_FAILED` — DTO validation precedes the throttle check
  5. `201` — register is not throttled
- Notes: the relative order of the CSRF check vs the throttle check is unspecified upstream and intentionally untested (both outcomes are rejections; no FR impact). "Throttled attempts neither count nor extend the window" is contract behavior not independently observable without clock injection.

### TC-ACC-032 — Throttle keying: nonexistent emails and case variants share the pair counter
- Traces to: arch. §8.2 (amended 2026-09-25) — keying rules: submitted email lowercased before keying; keyed whether or not the account exists
- Level: integration
- Preconditions: empty database; `alice@test.local` registered; throttle counters reset
- Steps:
  1. Ten failed logins with `{ email: "ghost@test.local", password: "wrong-password" }` (no such account); then an 11th attempt with the same wrong credentials
  2. Ten failed logins with `{ email: "ALICE@Test.Local", password: "wrong-password" }` (mixed case); then an 11th attempt with `{ email: "alice@test.local", password: "wrong-password" }` (lowercase)
- Expected result:
  1. first ten → `401 INVALID_CREDENTIALS`; 11th → `429 TOO_MANY_ATTEMPTS` — nonexistent emails are keyed too (the throttle is no account-existence oracle)
  2. first ten → `401`; 11th → `429` — the key is the lowercased email, so case variants share one counter (a non-normalized key would treat the lowercase 11th as a fresh pair and return `401`)
  - The two scenarios use different email keys and do not interfere.

### TC-ACC-033 — A successful login resets the pair's throttle counter
- Traces to: arch. §8.2 (amended 2026-09-25) — successful login clears counter and window for the (email, IP) pair
- Level: integration
- Preconditions: empty database; `bob@test.local` registered with `password-1`; throttle counters reset
- Steps:
  1. Five failed logins as bob
  2. One successful login as bob
  3. Ten failed logins as bob
  4. An 11th failed attempt
- Expected result:
  1. all → `401`
  2. `200` + session
  3. all ten → `401` — the success cleared the counter (without the reset, throttling would have begun at the 6th failure of this batch)
  4. `429 TOO_MANY_ATTEMPTS` — the fresh window reached its threshold exactly at the tenth counted failure

### TC-ACC-034 — Registration precedence: invalid fields win over duplicate email
- Traces to: API §4 error-precedence note (arch. amendment 2026-09-25); UC-ACC-001 (A1 + E1 combined)
- Level: integration
- Preconditions: `alice@test.local` registered
- Steps: `POST /api/auth/register` with `{ email: "alice@test.local", password: "1234567", displayName: "Impostor" }` (password 7 chars — invalid; email already taken)
- Expected result: `400 VALIDATION_FAILED` with details naming `password` — DTO validation precedes the uniqueness check; no account created, no session

### TC-ACC-035 — Password-change precedence: invalid new password wins over wrong current password
- Traces to: API §4 error-precedence note (arch. amendment 2026-09-25); UC-ACC-004 (E1 + policy combined)
- Level: integration
- Preconditions: alice holds a session; current password `password-1`
- Steps:
  1. `POST /api/auth/password` with `{ currentPassword: "not-my-password", newPassword: "1234567" }`
  2. `POST /api/auth/login` with `password-1`
- Expected result:
  1. `400 VALIDATION_FAILED` — the new-password policy check precedes the current-password check
  2. `200` — the password is unchanged

## 3. Test Design — Systematic Case Selection

### Equivalence partitioning
| Input | Partitions | Class behavior | Cases |
|---|---|---|---|
| Registration email | valid+unique / valid+duplicate / invalid format / missing | 201 / 409 / 400 / 400 | TC-001, 002, 003, 004(i–j) |
| Registration password | < 8 / 8–128 / > 128 / missing | 400 / accept / 400 / 400 | TC-004(a–d, k) |
| Registration displayName | empty / 1–50 / > 50 / missing | 400 / accept / 400 / 400 | TC-004(e–h, l) |
| Login credentials | account exists + password matches / exists + wrong / no account | 200+session / 401 / 401 **identical** | TC-005, 006, 007 |
| Change-password current | correct / incorrect | proceed / `INVALID_CURRENT_PASSWORD` | TC-010, 011 |
| Session cookie on request | valid / absent / revoked | authorized / 401 / 401 | TC-005, 015, 008–009 |

### Boundary value analysis
| Boundary | Values | Cases |
|---|---|---|
| Password length (register) | 7, 8, 128, 129 | TC-004(a–d) |
| Password length (change) | 7, 8, 128, 129 | TC-013(a–d) |
| DisplayName length | 0 (empty), 1, 50, 51 | TC-004(e–h) |
| Session expiry | +30 d window, asserted structurally as [29 d, 31 d]; the wall-clock boundary itself is not automatable (G-6) | TC-ACC-017 |

### Decision tables
**Registration** — conditions: (email free?) × (fields valid?)

| Email free | Fields valid | Outcome | Case |
|---|---|---|---|
| T | T | 201 + session | TC-001 |
| F | T | 409 EMAIL_TAKEN | TC-002, 003 |
| T | F | 400 VALIDATION_FAILED | TC-004 |
| F | F | 400 `VALIDATION_FAILED` — DTO validation precedes the uniqueness check (arch. amendment 2026-09-25) | TC-034 |

**Login** — conditions: (account exists?) × (password matches?)

| Exists | Matches | Outcome | Case |
|---|---|---|---|
| T | T | 200 + session | TC-005 |
| T | F | 401 INVALID_CREDENTIALS | TC-006 |
| F | * | 401 — response identical to the row above (anti-enumeration) | TC-007 |

**Password change** — conditions: (current correct?) × (new valid?)

| Current | New | Outcome | Case |
|---|---|---|---|
| T | T | 204; old password dead, new alive | TC-010 |
| F | T | 400 INVALID_CURRENT_PASSWORD; unchanged | TC-011 |
| T | F | 400 VALIDATION_FAILED | TC-013 |
| F | F | 400 `VALIDATION_FAILED` — the new-password policy check precedes the current-password check (arch. amendment 2026-09-25) | TC-035 |

### State transition testing — Session
States: `absent → valid → revoked`.

| Transition / trigger | Legal? | Case |
|---|---|---|
| absent → valid (register) | ✓ | TC-001, 023 |
| absent → valid (login) | ✓ | TC-005, 024 |
| valid → valid (continued use, sliding expiry) | ✓ | TC-017 (step 3) |
| valid → revoked (logout) | ✓ | TC-008, 025 |
| valid → revoked (password changed from another session) | ✓ | TC-012 |
| valid → expired (30-day wall clock) | ✓ by design | **not automated** — G-6; structural window asserted in TC-017 |
| revoked → any use (replayed token) | illegal | TC-008 (steps 2–3), TC-009 |
| absent → protected use (anonymous call) | illegal | TC-015 (all 21 endpoints) |
| absent → state change without CSRF header | illegal | TC-014 (all 4 auth routes) |

### State transition testing — login-throttle counter (per (email, IP) pair; arch. §8.2 as amended 2026-09-25)
States: `unblocked (counter 0–9) → throttled → cleared`.

| Transition / trigger | Legal? | Case |
|---|---|---|
| counted failure increments the counter (first ten return 401) | ✓ | TC-031 (step 1), TC-033 (step 3) |
| 10th counted failure → pair throttled | ✓ | TC-031, TC-033 (step 4) |
| throttled + any credentials (correct or wrong) → 429 | ✓ | TC-031 (steps 2–3) |
| throttled + malformed body → 400 (DTO precedes throttle) | ✓ | TC-031 (step 4) |
| throttled attempt counts toward / extends the window | illegal by contract | Not independently observable without clock injection — contract only |
| successful login (while unblocked) → counter and window cleared | ✓ | TC-033 (step 3) |
| 15-minute window expiry → cleared | ✓ by design | **Not automated** — no clock injection (G-6) |
| nonexistent-email key / case-variant key shares the pair counter | ✓ | TC-032 |

## 4. Coverage Matrix

| Requirement | Flows covered | Test Cases | Status |
|---|---|---|---|
| FR-ACC-001 | UC-ACC-001 main, E1 | TC-001, 004, 023 | Covered |
| FR-ACC-002 | UC-ACC-001 A1 | TC-002, 003 | Covered |
| FR-ACC-003 | UC-ACC-002 main | TC-005, 024 | Covered |
| FR-ACC-004 | UC-ACC-002 E1 | TC-006, 007 | Covered |
| FR-ACC-005 | UC-ACC-003 main | TC-008, 009, 025 | Covered |
| FR-ACC-006 | UC-ACC-004 main | TC-010, 012, 013, 026 | Covered |
| FR-ACC-007 | UC-ACC-004 E1 | TC-011 | Covered |
| FR-ACC-008 | BR-ACC-003 | TC-018 (+ UI rendering asserted in GRP/EXP plans) | Covered |
| FR-ACC-009 | UC-ACC-006 | TC-015 (all 21 protected endpoints), TC-009, 025 | Covered |
| FR-ACC-010 | UC-ACC-001 step 4 | TC-001, 023 | Covered |
| UC-ACC-001 | main, A1, E1 | TC-001/002/004 (API), TC-023 (UI) | Covered |
| UC-ACC-002 | main, E1 | TC-005/006/007 (API), TC-024 (UI) | Covered |
| UC-ACC-003 | main | TC-008, 025 | Covered |
| UC-ACC-004 | main, E1 | TC-010/011 (API), TC-026 (UI) | Covered |
| UC-ACC-005 | main steps 3+5 (automatable only); E1 = human, out-of-app | TC-028 | Covered (by design — see §1) |
| UC-ACC-006 | main | TC-015 (API), TC-025 (UI) | Covered |
| NFR-ACC-001 | Argon2id storage; no password in logs; login throttle | TC-019, 020, 021, 031, 032, 033 | Covered — throttle window expiry excluded (no clock injection, §1) |
| NFR-ACC-002 | — | — | Not automated — design-review item (by design) |
| NFR-ACC-003 | ≤ 2 s auth pages | TC-027 | Covered |
| NFR-ACC-004 | account retention (positive); no-delete = contract review | TC-029 | Covered |
| NFR-ACC-005 | scale | — | Cross-domain: verified via GRP plan scale fixtures (see `99-coverage-matrix.md`) |
| BR-ACC-001 | open registration | TC-001 | Covered |
| BR-ACC-002 | unique email | TC-002, 003 | Covered |
| BR-ACC-003 | display name is the visible identity | TC-018 | Covered |
| BR-ACC-004 | login matching | TC-005, 006, 007 | Covered |
| BR-ACC-005 / ASM-003 | current password required | TC-010, 011 | Covered |
| BR-ACC-006 / ASM-004 | sessions + logout | TC-008, 016, 017 | Covered |
| BR-ACC-007 | manual owner reset | TC-028 | Covered (automatable part) |
| BR-ACC-008 | no email verification | TC-001, 023 (registration completes with session, no verification round-trip) | Covered (absence assertion) |
| D-ARCH-002 | other sessions invalidated | TC-012 | Covered |
| D-ARCH-003 | password policy 8–128, no composition | TC-004(a–d), 013 | Covered |
| API §1/§4 | CSRF header; error envelope | TC-014, 022 | Covered |
| — | Login-throttle contract (arch. amendment 2026-09-25: 429 `TOO_MANY_ATTEMPTS`, deterministic semantics) | TC-031, 032, 033 | Covered — wall-clock window expiry excluded (§1) |
| — | Email case normalization at login | TC-030 | Covered — normalize at login (user decision, Gate 2 2026-09-25) |
| — | Error precedence: duplicate email + invalid registration fields | TC-034 | Covered — `VALIDATION_FAILED` wins (arch. amendment 2026-09-25) |
| — | Error precedence: wrong current + policy-violating new password | TC-035 | Covered — `VALIDATION_FAILED` wins (arch. amendment 2026-09-25) |
