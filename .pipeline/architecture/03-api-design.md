# API Design — Settle Up

Status: ready for review · Date: 2026-09-25 · Amended: 2026-09-25 (test-planner G-1 resolution + Gate 2 decisions; test-planner I-1/I-2/L-6 resolutions — see §7)
Surface: JSON over HTTPS, same-origin with the SPA. Base path `/api`. All requests/responses are `application/json; charset=utf-8` unless noted.

## 1. Conventions

- **Authentication:** session cookie `settleup_session` (HttpOnly, Secure, SameSite=Lax) established by register/login. All endpoints below require an authenticated session **except** `POST /api/auth/register` and `POST /api/auth/login` (FR-ACC-009). Anonymous calls to protected endpoints → `401 UNAUTHENTICATED`.
- **CSRF:** every state-changing request (POST/PATCH/DELETE) must carry the header `X-Requested-With: XMLHttpRequest` (the SPA's fetch wrapper always does). Missing header → `403 CSRF_HEADER_MISSING`.
- **Money:** request/response amounts are **integer kuruş** (`amountKurus: 12345` = ₺123.45). The UI converts user input via `parseKurus` (rejects negatives, >2 decimals, > ₺21,474,836.47 — ASM-002, BR-EXP-010).
- **Identity exposure:** group-scoped responses contain user references as `{ id, displayName }` only — never email (FR-ACC-008).
- **Existence hiding:** a caller who is not a member of `:groupId` receives `404 NOT_FOUND` for every group-scoped route — indistinguishable from a nonexistent group (FR-GRP-008, SC-006 "discloses none of the group's data").
- **Field limits:** `description` 1–200 chars; `group name` 1–100; `displayName` 1–50; password 8–128 (D-ARCH-003); email valid + lowercased — **at both boundaries**: registration stores the lowercased form, and login lowercases the submitted email before lookup, so mixed-case credentials authenticate to the same account (user decision, 2026-09-25).

## 2. Endpoints — Accounts & Access (C2)

| Method & path | Purpose | Traces to | Success | Notable errors |
|---|---|---|---|---|
| `POST /api/auth/register` | Create account (email, password, displayName) and open a session | UC-ACC-001, FR-ACC-001/002/010 | `201` `{ user }` + session cookie | `409 EMAIL_TAKEN`, `400 VALIDATION_FAILED` — if both apply, `VALIDATION_FAILED` wins (§4 precedence) |
| `POST /api/auth/login` | Authenticate (submitted email lowercased before lookup — §1), open session | UC-ACC-002, FR-ACC-003/004 | `200` `{ user }` + session cookie | `401 INVALID_CREDENTIALS` (generic — no enumeration on login), `429 TOO_MANY_ATTEMPTS` (login throttle — 11th+ attempt after 10 counted failures per (email, IP) in the active 15-min window; blocked before credential verification; full semantics: 01 §8.2) |
| `POST /api/auth/logout` | End current session | UC-ACC-003, FR-ACC-005 | `204` | — |
| `GET /api/auth/me` | Session check for SPA bootstrap; anonymous → SPA redirects to login | UC-ACC-006, FR-ACC-009 | `200` `{ user }` | `401 UNAUTHENTICATED` |
| `POST /api/auth/password` | Change own password (currentPassword, newPassword); **deletes all other sessions** (D-ARCH-002) | UC-ACC-004, FR-ACC-006/007, ASM-003 | `204` | `400 INVALID_CURRENT_PASSWORD`, `400 VALIDATION_FAILED` (policy) — if both apply, `VALIDATION_FAILED` wins (§4 precedence) |

## 3. Endpoints — Groups & Membership (C3)

| Method & path | Purpose | Traces to | Success | Notable errors |
|---|---|---|---|---|
| `POST /api/groups` | Create group; caller becomes creator + first member (BR-GRP-005); join code generated (FR-GRP-002) | UC-GRP-001, FR-GRP-001/002, BR-GRP-001/005 | `201` `{ group incl. joinCode }` | `400 VALIDATION_FAILED` |
| `GET /api/groups` | Groups overview (caller's memberships) | UC-ACC-002 (step 3), FR-GRP-009 | `200` `{ groups: [...] }` | — |
| `GET /api/groups/:groupId` | Group detail; includes `joinCode` **iff caller is the creator** (FR-GRP-002 "whenever they view the group") | UC-GRP-001 postcondition, UC-GRP-005 context | `200` `{ group }` | `404 NOT_FOUND` (non-member or missing) |
| `GET /api/groups/:groupId/members` | Member list (display names) | UC-GRP-005, FR-GRP-010, FR-ACC-008 | `200` `{ members: [{id, displayName, isCreator, joinedAt}] }` | `404 NOT_FOUND` |
| `GET /api/join-info?code=...` | Resolve a join code to `{ groupName }` before confirming (code holder only learns the name) | UC-GRP-002 (steps 1–2) | `200` `{ groupId, groupName }` | `404 CODE_NOT_FOUND` (FR-GRP-004) |
| `POST /api/join-requests` | Place join request `{ code }` | UC-GRP-002, FR-GRP-003, BR-GRP-003 | `201` `{ joinRequest }` | `404 CODE_NOT_FOUND`, `409 ALREADY_MEMBER` (A1/FR-GRP-013), `409 PENDING_REQUEST_EXISTS` (A2/FR-GRP-012) |
| `GET /api/groups/:groupId/join-requests` | Pending requests — **creator only** | UC-GRP-003/004 (step 1), FR-GRP-005 | `200` `{ requests: [...] }` | `404 NOT_FOUND` (non-member), `403 NOT_GROUP_CREATOR` (member, not creator) |
| `POST /api/join-requests/:requestId/approve` | Approve → membership established, request closed. Operates on **pending** requests only — deciding an already-decided (APPROVED/REJECTED) request → `404 NOT_FOUND` (semantics note below) | UC-GRP-003, FR-GRP-006, BR-GRP-004 | `200` `{ joinRequest }` | `403 NOT_GROUP_CREATOR` (caller is a member of the request's group but not its creator), `404 NOT_FOUND` (no row for requestId; caller not a member of the request's group — existence hiding; or request already decided) |
| `POST /api/join-requests/:requestId/reject` | Reject → request closed, no membership; re-request later allowed (BR-GRP-010). Operates on **pending** requests only — deciding an already-decided request → `404 NOT_FOUND` (semantics note below) | UC-GRP-004, FR-GRP-007/011 | `200` `{ joinRequest }` | `403 NOT_GROUP_CREATOR` (member, not creator), `404 NOT_FOUND` (no row; non-member caller — existence hiding; or request already decided) |

Re-request semantics: after a rejection, `POST /api/join-requests { code }` flips the existing row back to `PENDING` (02-data-model.md §5.3).

Approve/reject semantics (added 2026-09-25 — resolves test-planner interpretations I-1/I-2, groups test plan §1): both routes act on the **pending** join request addressed by `:requestId` — UC-GRP-003/004's precondition is "a pending join request exists", FR-GRP-005's read model is pending-only, and the state machine (02-data-model.md §5.3) defines no decided→decided transition — so a decided (APPROVED or REJECTED) request is outside these routes' domain: `404 NOT_FOUND`, indistinguishable from a missing one. The routes carry no `:groupId` path segment, so the handler applies the `GroupMemberGuard` pattern itself (resolve request → its group → caller membership). Checks run in a fixed order, first match wins:

1. no join-request row matches `requestId` → `404 NOT_FOUND`;
2. caller is not a member of the request's group → `404 NOT_FOUND` (existence hiding — same 404/403 split as `GET /api/groups/:groupId/join-requests`; the requester themself is always a non-member here, FR-GRP-013, so self-approval/self-rejection falls in this class);
3. caller is a member but not the group's creator → `403 NOT_GROUP_CREATOR`;
4. request status ≠ PENDING → `404 NOT_FOUND`.

Authorization (2–3) precedes request-state (4), mirroring the guard-before-handler layering (01-system-architecture.md §8.1); consequence: a member non-creator acting on an already-decided request receives `403`, not `404`. No new error code — §4's existing `NOT_FOUND` / `NOT_GROUP_CREATOR` rows apply unchanged.

## 3b. Endpoints — Expenses (C4)

All routes require group membership (`GroupMemberGuard` → `404 NOT_FOUND` for non-members).

| Method & path | Purpose | Traces to | Success | Notable errors |
|---|---|---|---|---|
| `POST /api/groups/:groupId/expenses` | Log expense `{ description, amountKurus, payerId, participantIds[], splitType, exactAmounts? }`; server computes & stores shares | UC-EXP-001, FR-EXP-001/002/003/004/005/006/007, BR-EXP-002/004/006/010 | `201` `{ expense incl. shares }` | `400 VALIDATION_FAILED` (E3 bad amount), `400 SPLIT_SUM_MISMATCH` (E1), `400 NO_PARTICIPANTS` (E2), `400 PARTICIPANT_NOT_MEMBER` (FR-EXP-003), `404 NOT_FOUND` (E4) |
| `GET /api/groups/:groupId/expenses` | Group ledger, newest first | UC-EXP-004, FR-EXP-011 | `200` `{ expenses: [...] }` (full list; defensive cap 500 → `500 LIST_TOO_LARGE`, flagged) | `404 NOT_FOUND` |
| `GET /api/groups/:groupId/expenses/:expenseId` | Expense detail incl. shares and timestamps | UC-EXP-004, FR-EXP-011, BR-EXP-008 | `200` `{ expense }` | `404 NOT_FOUND` |
| `PATCH /api/groups/:groupId/expenses/:expenseId` | Edit — **logger only**; any of description, amount, payer, participants, splitType, exactAmounts. Shares recomputed (fresh draw) iff amount/participants/splitType changed (FR-EXP-006); `editedAt` set | UC-EXP-002, FR-EXP-006/008/010 | `200` `{ expense }` | `403 NOT_LOGGER` (E2), `400` validation family, `404 NOT_FOUND` |
| `DELETE /api/groups/:groupId/expenses/:expenseId` | Delete — **logger only**; permanent removal incl. shares | UC-EXP-003, FR-EXP-009/012, BR-EXP-011 | `204` | `403 NOT_LOGGER` (E1), `404 NOT_FOUND` |

Notes: there is **no expense date field** anywhere in the DTOs (BR-EXP-008 — user-editable date is scope-out); timestamps are server-set. Zero amounts are valid (BR-EXP-010). Single-participant expenses are valid (OQ-EXP-001). Zero-kuruş exact shares are valid (OQ-EXP-003).

## 3c. Endpoints — Balances & Settlement (C5)

All routes require group membership.

| Method & path | Purpose | Traces to | Success | Notable errors |
|---|---|---|---|---|
| `GET /api/groups/:groupId/balances` | Per-member running balance (derived); response also carries the sum (always 0) for the UI/tests | UC-BAL-001, FR-BAL-001/002/003/010, BR-BAL-001/002/003 | `200` `{ balances: [{ member{id,displayName}, balanceKurus }], sumKurus: 0 }` | `404 NOT_FOUND` |
| `GET /api/groups/:groupId/settlements` | Settle-up view: current outstanding suggestion plan (computed, min transactions) **and** the settled-payment facts, distinguished | UC-BAL-002 (incl. A1), FR-BAL-004/005/010, BR-BAL-004/005/008/011 | `200` `{ outstanding: [{payer, recipient, amountKurus}], settled: [{id, payer, recipient, amountKurus, paidAt, undoneAt?}] }`; all-zero group → empty `outstanding` (A1) | `404 NOT_FOUND` |
| `POST /api/groups/:groupId/settlements` | Mark paid `{ payerId, recipientId, amountKurus }` — **only by that payment's payer or recipient**; must match one suggestion in the **current** plan (validated in-transaction) | UC-BAL-003, FR-BAL-006/007, BR-BAL-006/007 | `201` `{ settlement }` | `403 NOT_PAYMENT_PARTY` (E1), `409 SUGGESTION_STALE` (no matching live suggestion — plan changed concurrently), `404 NOT_FOUND` |
| `POST /api/groups/:groupId/settlements/:settlementId/undo` | Undo — **only by its payer or recipient**; status → `UNDONE`, excluded from balances; outstanding plan regenerates (it is derived) | UC-BAL-004, FR-BAL-008/009, BR-BAL-006/008 | `200` `{ settlement }` | `403 NOT_PAYMENT_PARTY` (E1), `409 ALREADY_UNDONE`, `404 NOT_FOUND` |

### 3.4 Mark-paid consistency rule (design decision)

BR-BAL-008 makes outstanding suggestions a live plan; therefore a mark-paid call must be validated against the plan **as of the transaction**: the service re-computes balances and the plan inside the request's DB transaction and requires an exact `(payerId, recipientId, amountKurus)` match with one suggestion. A stale plan (e.g., another member settled something first) → `409 SUGGESTION_STALE`; the SPA refreshes and retries. Rejected alternative: accepting arbitrary (payer, recipient, amount) — weaker than the FRs, which speak of marking **a suggested** payment. Flagged for test-planner: this 409 path needs a TC.

## 4. Error contract

Every error response has exactly this shape (NestJS exception filter; no stack traces in production):

```json
{
  "error": {
    "code": "EMAIL_TAKEN",
    "message": "An account with this email already exists.",
    "details": { "field": "email" }
  }
}
```

| HTTP | `code` | Raised by (examples) |
|---|---|---|
| 400 | `VALIDATION_FAILED` | DTO validation (details lists offending fields) |
| 400 | `INVALID_CURRENT_PASSWORD` | Password change with wrong current password |
| 400 | `SPLIT_SUM_MISMATCH` | Exact split ≠ amount (UC-EXP-001 E1) |
| 400 | `NO_PARTICIPANTS` | Empty participant list (E2) |
| 400 | `PARTICIPANT_NOT_MEMBER` | Payer/participant not in group (FR-EXP-003) |
| 401 | `UNAUTHENTICATED` | No/invalid/expired session (SPA → login page) |
| 401 | `INVALID_CREDENTIALS` | Login failure (generic message) |
| 403 | `CSRF_HEADER_MISSING` | Missing `X-Requested-With` on state-changing call |
| 403 | `NOT_GROUP_CREATOR` | Join-request handling by non-creator |
| 403 | `NOT_LOGGER` | Expense edit/delete by non-logger |
| 403 | `NOT_PAYMENT_PARTY` | Mark-paid/undo by neither payer nor recipient |
| 404 | `NOT_FOUND` | Non-member access to any group-scoped route (existence-hiding), or missing resource |
| 404 | `CODE_NOT_FOUND` | Join code matches no group (FR-GRP-004) |
| 409 | `EMAIL_TAKEN` | Duplicate registration (FR-ACC-002) |
| 409 | `ALREADY_MEMBER` | Join request while a member (FR-GRP-013) |
| 409 | `PENDING_REQUEST_EXISTS` | Duplicate pending request (FR-GRP-012) |
| 409 | `SUGGESTION_STALE` | §3.4 |
| 409 | `ALREADY_UNDONE` | Undo of an already-undone settlement |
| 429 | `TOO_MANY_ATTEMPTS` | Login throttled — 11th+ attempt from a (email, IP) pair with 10 counted failures in the active 15-min window (login endpoint only; blocked before credential verification — full semantics: 01-system-architecture.md §8.2) |
| 500 | `INTERNAL` | Unexpected fault — logged with request id; message is generic |

`details` is optional and machine-readable; `message` is human-readable and safe to show in the UI.

**Login throttle (added 2026-09-25 — resolves test-planner G-1 / Gate 1 Q2, option a as approved):** the throttled response uses the standard envelope above with `code: "TOO_MANY_ATTEMPTS"` and a generic `message` (no account-existence hint); `details` is omitted and no `Retry-After` header is set — the remaining window is wall-clock-dependent, and the contract stays deterministic without them. Counting: only credential-verification failures (the `401 INVALID_CREDENTIALS` path) count, per (email, IP) pair, on `POST /api/auth/login` only; the first 10 counted failures are processed normally (401 each), and the 11th and subsequent attempts return `429` **before credential verification — including attempts with correct credentials**; a successful login or expiry of the fixed 15-minute window (anchored at the first counted failure) clears the counter; `POST /api/auth/register` is not throttled. Full deterministic semantics (keying, window anchoring, check order): 01-system-architecture.md §8.2.

**Error precedence (added 2026-09-25):** DTO validation precedes service-level checks — a request that is both malformed and semantically conflicting returns `400 VALIDATION_FAILED`. Consequences: (a) registration with a taken email **and** other invalid fields → `400 VALIDATION_FAILED`, not `409 EMAIL_TAKEN`; (b) password change with a wrong current password **and** a policy-violating new password → `400 VALIDATION_FAILED`, not `INVALID_CURRENT_PASSWORD`. Why: validation is a pure format concern evaluated before any DB access; probing service-level state with an invalid payload is wasted work and would make the outcome order-dependent.

**Service-level error precedence (added 2026-09-25 — resolves test-planner L-6):** when more than one service-level check would fail on a single request, the checks run in a **fixed order per endpoint and the first violation wins** — combined-error outcomes are contract, not implementation accident. Orders for the affected endpoints:

- **Expense create** (`POST /api/groups/:groupId/expenses`, §3b): `NO_PARTICIPANTS` → `PARTICIPANT_NOT_MEMBER` → `SPLIT_SUM_MISMATCH` — participant-list shape, then payer/participant membership, then split arithmetic. Expense **edit** (`PATCH …/expenses/:expenseId`) runs the same order over its field validations, after the `NOT_LOGGER` check (authorization first — guard order).
- **Mark paid** (`POST /api/groups/:groupId/settlements`, §3c): `NOT_PAYMENT_PARTY` → `SUGGESTION_STALE` — the caller's party status is checked before the plan is recomputed and matched (an unauthorized caller triggers no plan work). **Undo** follows the same rule: party check before `ALREADY_UNDONE`.
- Why this order: authorization and participation (who may act, who is in the group) precede domain-state and arithmetic checks (what the numbers say) — the same layering as guards before handlers (01-system-architecture.md §8.1). DTO validation still precedes all service-level checks (note above).

## 5. Versioning

**Decision: no version prefix in the MVP.** The API is a private, same-origin surface consumed exclusively by the SPA built from the same monorepo commit — client and server are always in lockstep (single deployable, 01 §1). Change policy: additive-only within the MVP; any breaking change (which would require coordination anyway) adds `/api/v2` at that time, leaving `/api` intact.

Rejected alternative: `/api/v1` from day one — costs a permanent path segment and config for a consumer that can never be version-skewed; revisit only if a second client (e.g., a future mobile app — currently scope-out) appears.

## 6. SPA routes (C1) and use-case coverage

| Route | Page | Traces to |
|---|---|---|
| `/register`, `/login` | Auth pages | UC-ACC-001, UC-ACC-002 |
| `/` | Groups overview | UC-ACC-002 (step 3) |
| `/groups/:groupId` | Group view — tabs: Expenses / Balances / Settle-up / Members | UC-EXP-004, UC-BAL-001/002, UC-GRP-005 |
| `/groups/:groupId/expenses/new` | Add-expense form (single screen; participants default to all members; payer defaults to acting user — NFR-EXP-001) | UC-EXP-001 |
| `/groups/:groupId/expenses/:expenseId/edit` | Edit expense (logger only) | UC-EXP-002 |
| `/join/:code` | Join-by-code confirmation page (calls `GET /api/join-info` then `POST /api/join-requests`) | UC-GRP-002 |
| `/change-password` | Change password | UC-ACC-004 |
| (any protected route while anonymous) | Redirect to `/login` | UC-ACC-006 |

### Coverage check — use case ↔ endpoint

| Use case | Covered by |
|---|---|
| UC-ACC-001..004, UC-ACC-006 | §2 endpoints + SPA routes ✓ |
| **UC-ACC-005 (manual password reset)** | **No endpoint — by design** (OQ-ACC-001 decided 2026-09-25: performed outside the application; runbook in 01 §10). Flagged, not a defect. |
| UC-GRP-001..006 | §3 endpoints ✓ (UC-GRP-006 = the 404/401 behavior of every group-scoped route + guards) |
| UC-EXP-001..004 | §3b endpoints ✓ |
| UC-BAL-001..004 | §3c endpoints ✓ |

Every endpoint in §2–§3c traces to ≥ 1 UC; every UC except the flagged UC-ACC-005 traces to ≥ 1 endpoint.

## 7. Change propagation

Initial API design — no existing tickets or test plans reference these endpoints yet. When this contract changes later: list affected UC-xxx / FR-xxx (per 01 §6), notify test-planner (acceptance TCs hit these endpoints) and planner (ticket scope), and bump this document's status. The error-code table (§4) is the acceptance-test vocabulary — codes are stable API surface.

**2026-09-25 — amendment (test-planner G-1 resolution + Gate 2 user decisions):**

- §4 error table + §2 login row: **`429 TOO_MANY_ATTEMPTS`** added — the login-throttle response contract (G-1 / Gate 1 Q2, option a approved). Full semantics specified in 01 §8.2: fixed 15-min window anchored at the first counted failure; 11th+ attempt blocked before credential verification (correct credentials included); successful login or window expiry clears the counter; login endpoint only (register unthrottled).
- §1 + §2 login row: **email normalization at login** made explicit — the submitted email is lowercased before lookup, so mixed-case credentials authenticate to the same account (user decision, 2026-09-25; mirrors 02-data-model.md §4/§9).
- §4: **error precedence** note — DTO validation (`400 VALIDATION_FAILED`) precedes service-level checks (`409 EMAIL_TAKEN`, `INVALID_CURRENT_PASSWORD`) in the two collapsed cases.
- No other status codes, success shapes, or endpoints changed.
- Downstream: the accounts-access test plan adds **TC-ACC-031** (throttle contract) and finalizes **TC-ACC-030** (email normalization), and may add precedence TCs — notify test-planner (new assertions, no weakenings) and planner (implementation detail only, no ticket scope change).

**2026-09-25 — amendment (test-planner I-1/I-2 and L-6 resolutions):**

- §3 approve/reject rows + new "Approve/reject semantics" note under §3: **I-1 confirmed** — approve/reject of an already-decided (non-PENDING) request → `404 NOT_FOUND`; the routes operate on pending requests (UC-GRP-003/004 preconditions, FR-GRP-005 pending-only read model, no decided→decided transition in 02 §5.3), so a decided request is indistinguishable from a missing one. **I-2 confirmed** — caller classes: no matching row → `404`; caller not a member of the request's group → `404 NOT_FOUND` (existence hiding, mirroring the list route's documented 404/403 split); member non-creator → `403 NOT_GROUP_CREATOR`. Fixed check order: missing → non-member → non-creator → decided — authorization precedes request-state (01 §8.1 layering); this also fixes the previously unspecified combination *member non-creator + decided request* → `403` (no recorded TC contradicts it). Rejected alternatives: a dedicated already-decided error code (rejected — adds contract surface for a case the creator's UI never surfaces, since FR-GRP-005 lists pending requests only) and 200-on-re-approve idempotency (rejected — would imply a decided→decided transition that does not exist; TC-GRP-019 asserts no state change). No new error code: §4's table is reused unchanged.
- §4: **service-level error precedence** note — first violation wins in a fixed order per endpoint: expense create `NO_PARTICIPANTS` → `PARTICIPANT_NOT_MEMBER` → `SPLIT_SUM_MISMATCH` (edit: same order after `NOT_LOGGER`); mark paid `NOT_PAYMENT_PARTY` → `SUGGESTION_STALE` (undo: party before `ALREADY_UNDONE`). The test-planner's two collapsed cases (L-6) are now contract: `PARTICIPANT_NOT_MEMBER` wins over `SPLIT_SUM_MISMATCH`; `NOT_PAYMENT_PARTY` wins over `SUGGESTION_STALE`. Rejected alternative: "unspecified by design" (all outcomes are equivalent rejections) — rejected because a deterministic contract is testable and immune to implementation-order drift, at the cost of one paragraph.
- No endpoints, status codes, success shapes, or §4 error-table rows changed.
- Downstream (change propagation): the test-planner must re-validate the affected TCs — **TC-GRP-018/019** (items 1–2 — both interpretations confirmed as recorded, expected cells unchanged), **TC-ACC-028** (item 3 — amended in 01 §10, not in this document), and the **expense/balances plans' §1 exclusions plus coverage-matrix rows L-4/L-6/L-7** (item 4 — the L-6 exclusion may now become specified, testable combined cases). No tickets exist yet (`.pipeline/plan/` not created), so no ticket re-validation is needed.
