# Groups & Membership Test Plan

Status: **approved at Gate 2** (2026-09-25) · Date: 2026-09-25
Domain report: `.pipeline/analysis/groups-membership.md` · Architecture: `01-system-architecture.md` (C3, §8.1, §8.3), `02-data-model.md` (groups/join_requests/memberships, §5.3), `03-api-design.md` (§1, §3, §4) · Inherits every rule of `.pipeline/testing/00-test-strategy.md` (approved at Gate 1).

> **Gate 2 resolution (2026-09-25):** approved as written. Interpretations I-1/I-2 (§1 — approve/reject on decided requests and non-member callers) stand as recorded, flagged for architect confirmation; if the architect amends either, TC-GRP-018/019 change one expected cell each via the change-propagation rule. No test case was weakened.

> **Amendment re-validation (2026-09-25, architect rulings):** I-1 and I-2 **confirmed** by architect amendment (`03-api-design.md` §3 — "Approve/reject semantics" note; check order: missing → non-member → non-creator → decided). The expected cells of TC-GRP-018/019 are unchanged. The amendment additionally fixes a previously unspecified combination — **member non-creator acting on an already-decided request → `403 NOT_GROUP_CREATOR`** (authorization precedes request-state) — covered by a new row in TC-GRP-019 (a strengthening; no test case was weakened). The dangling BR-GRP-011 reference in `02-data-model.md` §5.3 was corrected upstream. Closes coverage-matrix L-7.

**Conventions for all integration cases below** (from the strategy, identical to the accounts-access plan): every state-changing HTTP call carries `X-Requested-With: XMLHttpRequest`; the app under test boots in-process (supertest) against a real PostgreSQL; every test starts from truncated tables; the test bootstrap sets `COOKIE_SECURE=true`; fixture identities are fixed (`alice@test.local` creator, `bob@test.local` joiner, `carol@test.local` registered non-member with no memberships, `dave@test.local` member of another group; passwords `password-1`, `password-2`, …). Factories per strategy §5: `registerUser`, `createGroup` (returns group incl. `joinCode`), `joinAndApprove`, `createExpense`. **E2e conventions:** the e2e database is recreated per run; every e2e case is self-contained — it registers its own unique fixed identities through the UI as in-test setup and depends on no other e2e case (order-independent, per the Gate 2 resolution recorded in `accounts-access.md`).

## 1. Scope

**Covered here:** FR-GRP-001…013 · UC-GRP-001…006 (all main, alternate, and error flows) · NFR-GRP-001…005 · BR-GRP-001…010 · the SC-006 authorization matrix for **all 12 group-scoped routes** (this domain owns the `GroupMemberGuard` privacy boundary for C3/C4/C5 routes — the Expense and Balances plans cross-reference, not duplicate, this matrix) · CSRF enforcement on the 4 Groups-domain state-changing routes · the two cross-domain promises made by the accounts-access plan: **FR-ACC-008 UI assertions** (display names rendered in member-facing UI) and the **NFR-ACC-005 full-scale fixture** (8 users, 5 groups) · join-code generator unit tests (NFR-GRP-005).

**Deliberately NOT tested here, and why:**

| Exclusion | Reason |
|---|---|
| Join-code entropy beyond construction | NFR-GRP-005's unguessability follows from the CSPRNG (arch. §4/§7) — not separately testable; the generator's format, determinism, and uniqueness are tested (TC-001/002), per strategy §6 |
| Anonymous calls to protected endpoints | Already exhaustively covered by **TC-ACC-015** (all 21 endpoints → 401) — cross-referenced, not duplicated |
| Member removal, group deletion/archiving (BR-GRP-007/008) | Feature intentionally absent — `03-api-design.md` defines no such endpoints (contract review); retention is asserted by TC-GRP-025 |
| Join-code rotation (OQ-GRP-002) | Explicit non-goal this release |
| Creator transfer / step-down (R-GRP-001) | Not in the brief; no FR; nothing to test |
| Notifying requesters of approve/reject outcomes (UC-GRP-004 postcondition) | Notifications are scope-out (brief §6) — the requester learns out-of-band; no system behavior to assert |
| Load testing for NFR-GRP-004 | Load is trivial by construction at 8 users × 5 groups (strategy §6) — verified functionally at full scale (TC-GRP-024), not by load test |
| `joinCode` presence in the `GET /api/groups` overview payload | Unspecified upstream — FR-GRP-002's "whenever they view the group" is asserted on the group detail view (TC-GRP-003/006); the overview list's field set is not asserted beyond `id`/`name` |

**Interpretations recorded (confirmed by architect amendment 2026-09-25 — see TC-GRP-018/019 and the coverage matrix):**

| # | Contract point | Upstream state | Interpretation used |
|---|---|---|---|
| I-1 | Approve/reject of an already-decided (non-PENDING) request | Was unspecified at plan time — **confirmed by architect amendment 2026-09-25** (`03-api-design.md` §3, "Approve/reject semantics" note) | **`404 NOT_FOUND`** — the routes operate on *pending* requests (UC-GRP-003/004 preconditions: "a pending join request exists"; FR-GRP-005's read model is pending-only); a decided request is outside their domain |
| I-2 | Approve/reject by a caller who is not a member of the request's group | Was unspecified at plan time — **confirmed by architect amendment 2026-09-25** (same note; fixed check order: missing → non-member → non-creator → decided) | **`404 NOT_FOUND`** for non-members (existence hiding, mirroring the documented 404/403 split on the list route), **`403 NOT_GROUP_CREATOR`** for members who are not the creator |

The architect amendment also specifies the previously open combination *member non-creator + decided request* → `403 NOT_GROUP_CREATOR` (authorization precedes request-state) — covered by TC-GRP-019 row c.

## 2. Test Cases

### TC-GRP-001 — Join-code generator: format and determinism (injected CSPRNG)
- Traces to: NFR-GRP-005, FR-GRP-002, BR-GRP-002, arch. §4 (join-code row), §3 rule 3 (injectable CSPRNG)
- Level: unit
- Preconditions: the generator is invoked directly with a **seeded deterministic PRNG** injected as the CSPRNG source (the one sanctioned double, strategy T5)
- Steps:
  1. Generate one code with seed `S1`; generate again with the same seed `S1`
  2. Generate one code with a different fixed seed `S2`
  3. Generate 50 consecutive codes from the `S1` stream
- Expected result:
  1. The code is exactly 8 characters, every character in the Crockford base32 alphabet `0123456789ABCDEFGHJKMNPQRSTVWXYZ` (no `I`, `L`, `O`, `U`); the second call with `S1` returns the identical code
  2. The `S2` code differs from the `S1` code (fixed seeds chosen so this holds — deterministic)
  3. All 50 are 8-char Crockford base32

### TC-GRP-002 — Join-code generator: uniqueness across a large seeded sample
- Traces to: NFR-GRP-005, FR-GRP-002 ("unique join code for each group"), data-model §4 (`joinCode @unique`)
- Level: unit
- Preconditions: seeded PRNG injected (T5); fixed seed recorded in the test
- Steps: generate 10,000 codes from the seeded stream; collect into a set
- Expected result: the set has exactly 10,000 distinct members — no collision in the sample (deterministic given the seed; collision would surface a biased construction)

### TC-GRP-003 — Create a group: creator membership, join code issued and visible
- Traces to: FR-GRP-001, FR-GRP-002, UC-GRP-001 (main, steps 2–3), BR-GRP-001, BR-GRP-002, BR-GRP-005
- Level: integration
- Preconditions: alice registered (factory); empty database
- Steps:
  1. `POST /api/groups` as alice with `{ name: "Trip" }`
  2. `GET /api/groups/:groupId` as alice
  3. `GET /api/groups/:groupId/members` as alice
- Expected result:
  1. `201`; body `{ group }` with `group.name = "Trip"`, a non-empty `group.id`, and `group.joinCode` matching `^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{8}$`
  2. `200` — the group detail shows the same `joinCode` to its creator (FR-GRP-002 "whenever they view the group")
  3. `200` — exactly one member: alice, with `isCreator = true` (creator membership established atomically with the group, BR-GRP-005)

### TC-GRP-004 — Group name validation (boundary values)
- Traces to: UC-GRP-001 (E1), API §1 field limits (group name 1–100), OQ-GRP-003 resolution
- Level: integration
- Preconditions: alice registered; truncated DB per row (each row isolated)
- Steps: `POST /api/groups` as alice with the row's payload:

| Row | name | Expected |
|---|---|---|
| a | `""` (empty) | `400 VALIDATION_FAILED`, details name `name` |
| b | 1 char | `201` |
| c | 100 chars | `201` |
| d | 101 chars | `400 VALIDATION_FAILED` |
| e | field missing | `400 VALIDATION_FAILED` |

- Expected result: per table — every invalid row creates **no** group (a follow-up `GET /api/groups` as alice returns an empty list); every valid row creates exactly one group

### TC-GRP-005 — Groups overview lists exactly the caller's memberships
- Traces to: FR-GRP-009 (read side), UC-ACC-002 (step 3 — groups overview), BR-GRP-006
- Level: integration
- Preconditions: alice registered; bob registered and member of one group via `joinAndApprove` (factory)
- Steps:
  1. `GET /api/groups` as a freshly registered user with no memberships (carol)
  2. `GET /api/groups` as bob
- Expected result:
  1. `200` `{ groups: [] }` — empty overview is a valid state
  2. `200` — `groups` contains exactly one entry, the joined group, each entry carrying `id` and `name` (the overview never includes groups the caller is not a member of — cross-checked negatively in TC-GRP-021)

### TC-GRP-006 — Join-code visibility: creator sees it, other members do not; codes distinct across groups
- Traces to: FR-GRP-002 (both aspects), BR-GRP-002, data-model §4 (`joinCode`)
- Level: integration
- Preconditions: alice created group A; bob is an approved member of A (factory); alice created a second group B
- Steps:
  1. `GET /api/groups/A` as bob
  2. Compare A's and B's join codes (from the creation responses)
- Expected result:
  1. `200` — bob (member, not creator) receives the group's data (`name` visible) but the response body contains **no** `joinCode` field and no 8-char code string anywhere in the body
  2. A's and B's join codes are distinct, both matching the Crockford format (uniqueness per group; DB-level `@unique` would make a collision a 500)

### TC-GRP-007 — Join-info resolves a valid code to the group's name only
- Traces to: UC-GRP-002 (steps 1–2), API §3 (join-info row), BR-GRP-003 context
- Level: integration
- Preconditions: alice created group "Trip"; the join code is known
- Steps: `GET /api/join-info?code=<Trip's code>` as carol (authenticated, non-member, code holder)
- Expected result: `200` with a body whose keys are **exactly** `{ groupId, groupName }` — the code holder learns the group's name and nothing else (no member list, no balances, no join code of their own, no email addresses)

### TC-GRP-008 — Join-info with an unknown or malformed code
- Traces to: FR-GRP-004, UC-GRP-002 (E1, resolve step), API §4 (`CODE_NOT_FOUND`)
- Level: integration
- Preconditions: carol registered
- Steps: `GET /api/join-info?code=ZZZZ9999` (well-formed, matches no group); then `?code=short` (malformed length); then `?code=abcdefgh` (lowercase, cannot be a Crockford code)
- Expected result: all three → `404`, code `CODE_NOT_FOUND`, standard error envelope — a non-matching code is indistinguishable whatever its shape

### TC-GRP-009 — Place a join request with a valid code
- Traces to: FR-GRP-003, UC-GRP-002 (main), BR-GRP-003
- Level: integration
- Preconditions: alice created group "Trip"; bob registered (non-member)
- Steps:
  1. `POST /api/join-requests` as bob with `{ code: "<Trip's code>" }`
  2. `GET /api/groups/:groupId/join-requests` as alice (creator)
- Expected result:
  1. `201`; body `{ joinRequest }` with `status = "PENDING"`
  2. `200` — the pending list contains exactly one request, referencing bob via `{ id, displayName: "Bob" }` (display name, never email — FR-ACC-008; email absence is also asserted API-wide by TC-ACC-018)

### TC-GRP-010 — Join request with an unknown code or a missing code field
- Traces to: FR-GRP-004, UC-GRP-002 (E1), API §4 precedence (DTO validation first)
- Level: integration
- Preconditions: bob registered; no group exists with code `ZZZZ9999`
- Steps:
  1. `POST /api/join-requests` as bob with `{ code: "ZZZZ9999" }`
  2. `POST /api/join-requests` as bob with `{}` (missing `code` field)
- Expected result:
  1. `404`, code `CODE_NOT_FOUND` — no request is created. Note (forced by the design, not an interpretation): the code **is** the group selector, so code resolution precedes any requester-relation check — an unknown code yields 404 for every requester class
  2. `400`, code `VALIDATION_FAILED`, details name `code` — DTO validation precedes service-level checks (API §4)

### TC-GRP-011 — Join request by an existing member is rejected (creator-self and approved joiner)
- Traces to: FR-GRP-013, UC-GRP-002 (A1), BR-GRP-005 context, data-model §5.3 ("further requests impossible — user is a member")
- Level: integration
- Preconditions: alice created group "Trip" (alice is its creator-member); bob is an approved member (factory)
- Steps:
  1. `POST /api/join-requests` as alice with `{ code: "<Trip's code>" }` (the creator requests to join their own group)
  2. `POST /api/join-requests` as bob with `{ code: "<Trip's code>" }` (an approved member requests again)
- Expected result: both → `409`, code `ALREADY_MEMBER`; the creator's pending list is empty in both cases — no request row is created

### TC-GRP-012 — Duplicate pending request is rejected
- Traces to: FR-GRP-012, UC-GRP-002 (A2), data-model §4 (`JoinRequest @@unique(groupId,userId)`)
- Level: integration
- Preconditions: alice created group "Trip"; bob has already placed a pending request (TC-GRP-009 steps)
- Steps: `POST /api/join-requests` as bob with `{ code: "<Trip's code>" }` a second time
- Expected result: `409`, code `PENDING_REQUEST_EXISTS`; the creator's pending list still contains exactly **one** request for bob (no duplicate row)

### TC-GRP-013 — Approve a pending join request establishes membership
- Traces to: FR-GRP-006, UC-GRP-003 (main), BR-GRP-004
- Level: integration
- Preconditions: alice created group "Trip"; bob has a pending request
- Steps:
  1. `POST /api/join-requests/:requestId/approve` as alice
  2. `GET /api/groups/:groupId/members` as alice
  3. `GET /api/groups` as bob
  4. `GET /api/groups/:groupId/join-requests` as alice
- Expected result:
  1. `200`; body `{ joinRequest }` with `status = "APPROVED"` (and `decidedAt` set, if exposed)
  2. `200` — exactly two members; bob appears with `displayName = "Bob"`, `isCreator = false`, `joinedAt` present; alice remains `isCreator = true`
  3. `200` — bob's overview now contains "Trip"
  4. `200` `{ requests: [] }` — the approved request is no longer pending (request closed)

### TC-GRP-014 — Reject a pending join request closes it without membership
- Traces to: FR-GRP-007, UC-GRP-004 (main), BR-GRP-004
- Level: integration
- Preconditions: alice created group "Trip"; bob has a pending request
- Steps:
  1. `POST /api/join-requests/:requestId/reject` as alice
  2. `GET /api/groups/:groupId/members` as alice
  3. `GET /api/groups` as bob
  4. `GET /api/groups/:groupId/join-requests` as alice
- Expected result:
  1. `200`; body `{ joinRequest }` with `status = "REJECTED"` (and `decidedAt` set, if exposed)
  2. `200` — still exactly one member (alice); bob was not added
  3. `200` — bob's overview does not contain "Trip"
  4. `200` `{ requests: [] }` — the rejected request is no longer pending

### TC-GRP-015 — Re-request after rejection flips the existing row
- Traces to: FR-GRP-011, BR-GRP-010, UC-GRP-004 (postcondition), data-model §5.3 (`REJECTED → PENDING`, `decidedAt` cleared)
- Level: integration
- Preconditions: bob's request for "Trip" was rejected (TC-GRP-014 state)
- Steps:
  1. `POST /api/join-requests` as bob with `{ code: "<Trip's code>" }`
  2. `GET /api/groups/:groupId/join-requests` as alice
  3. Read the `join_requests` table directly (documented data model)
- Expected result:
  1. `201`; body `{ joinRequest }` with `status = "PENDING"` — the same (groupId, userId) pair is reusable after rejection
  2. `200` — exactly **one** pending request for bob (the row was flipped, not duplicated — the structural guarantee behind FR-GRP-012)
  3. exactly one row for (Trip, bob); `status = "PENDING"`; `decidedAt` is null (cleared on re-request)

### TC-GRP-016 — Member list shape and set semantics
- Traces to: FR-GRP-010, UC-GRP-005 (main), FR-ACC-008 (API side), API §3 (members row shape)
- Level: integration
- Preconditions: group "Trip" with alice (creator) and approved members bob and carol (factories)
- Steps: `GET /api/groups/:groupId/members` as bob (any member may read)
- Expected result: `200`; `members` has exactly 3 entries; every entry carries `id`, `displayName`, `isCreator`, `joinedAt`; exactly one entry has `isCreator = true` (alice); the display-name set is {"Alice", "Bob", "Carol"}; no email appears anywhere in the body (cross-ref TC-ACC-018); order is not asserted (unspecified upstream)

### TC-GRP-017 — Pending-request list is creator-only
- Traces to: FR-GRP-005, API §3 (join-requests row), arch. §8.1 layer 3
- Level: integration
- Preconditions: alice created group "Trip"; bob (member, not creator — factory) ; carol has a pending request for "Trip"
- Steps: `GET /api/groups/:groupId/join-requests` as alice; then as bob
- Expected result:
  1. `200` — one pending request, referencing carol by `{ id, displayName: "Carol" }`
  2. `403`, code `NOT_GROUP_CREATOR` — a member who is not the creator cannot see pending requests (the non-member case is the 404 of the authorization matrix, TC-GRP-021; anonymous is TC-ACC-015)

### TC-GRP-018 — Approve/reject authorization (decision table)
- Traces to: FR-GRP-005/006/007 context, UC-GRP-003/004 (error side), API §3 error codes + "Approve/reject semantics" note (amended 2026-09-25), arch. §8.1 layer 3; interpretation **I-2 — confirmed by architect amendment 2026-09-25**
- Level: integration
- Preconditions: alice created group "Trip"; carol has a pending request; bob is a member (not creator); dave is a registered non-member of "Trip"
- Steps (each from a clean copy of the precondition state — the pending request must still exist for each row):
  1. `POST /api/join-requests/:requestId/approve` as bob (member, not creator)
  2. `POST /api/join-requests/:requestId/reject` as dave (registered non-member) — interpretation I-2
  3. `POST /api/join-requests/:requestId/approve` as alice with `requestId = "nonexistent-request-id"`
  4. After each failed row: `GET /api/groups/:groupId/members` as alice
- Expected result:
  1. `403`, code `NOT_GROUP_CREATOR`
  2. `404`, code `NOT_FOUND` (existence hiding — a non-member cannot distinguish "request exists" from "request does not"; mirrors the list route's documented 404-for-non-member)
  3. `404`, code `NOT_FOUND`
  4. In every row: members list unchanged (alice only) and the request remains PENDING — no failure path establishes membership or closes the request

### TC-GRP-019 — Deciding an already-decided request
- Traces to: data-model §5.3 (JoinRequest state machine), UC-GRP-003/004 (preconditions: a *pending* request exists), API §3 "Approve/reject semantics" note (amended 2026-09-25); interpretation **I-1 — confirmed by architect amendment 2026-09-25**
- Level: integration
- Preconditions (built per row, each from a fresh decided state):
  - row a: bob's request was approved
  - row b: bob's request was rejected
- Steps:
  - Row a: `POST /api/join-requests/:requestId/approve` as alice again; then `.../reject` on the approved request
  - Row b: `POST /api/join-requests/:requestId/reject` as alice again; then `.../approve` on the rejected request
  - Row c (combined case, specified by the amendment): `POST /api/join-requests/:requestId/approve` as bob (member, non-creator) on a decided request
  - After each call: read the `join_requests` row and `GET /api/groups/:groupId/members`
- Expected result: rows a and b → `404`, code `NOT_FOUND` (I-1: the routes operate on pending requests); row c → `403`, code `NOT_GROUP_CREATOR` (authorization precedes request-state — API §3 note, amended 2026-09-25); in every row the row's `status` is unchanged (APPROVED stays APPROVED, REJECTED stays REJECTED); the members list is unchanged — approving twice never duplicates membership, rejecting an approved member never removes it (BR-GRP-008)

### TC-GRP-020 — Empty pending list is a valid state
- Traces to: FR-GRP-005, UC-GRP-003/004 (step 1 — "creator opens the pending requests")
- Level: integration
- Preconditions: alice created group "Trip"; no join requests exist
- Steps: `GET /api/groups/:groupId/join-requests` as alice
- Expected result: `200` `{ requests: [] }`

### TC-GRP-021 — SC-006 authorization matrix: every group-scoped route denies non-members with existence hiding
- Traces to: FR-GRP-008, BR-GRP-009, NFR-GRP-001, SC-006, UC-GRP-006 (main), arch. §8.1 layer 2, API §1 (existence hiding)
- Level: integration
- Preconditions: alice created group G and approved bob; one expense exists in G (`createExpense` as alice, splitting alice+bob — so read routes carry real data); carol is registered with **no** memberships; dave is a registered member of a **different** group (his own). Both are non-member subclasses of G
- Steps: for **each of the 12 group-scoped routes** — `GET /api/groups/:groupId` · `GET …/members` · `GET …/join-requests` · `POST …/expenses` · `GET …/expenses` · `GET …/expenses/:expenseId` · `PATCH …/expenses/:expenseId` · `DELETE …/expenses/:expenseId` · `GET …/balances` · `GET …/settlements` · `POST …/settlements` · `POST …/settlements/:settlementId/undo` — and for each caller ∈ {carol, dave}:
  1. Call the route on G's real `groupId` (state-changing calls carry the CSRF header and a syntactically valid body; dummy sub-ids permitted — the member guard fires on `groupId`)
  2. Call the same route with a nonexistent `groupId` (valid-format cuid)
  3. Capture both response bodies
  4. Afterwards, as alice: `GET …/members`, `GET …/expenses`, `GET …/balances`
- Expected result:
  1. All 12 × 2 calls on the real group → `404`, code `NOT_FOUND` — read **and** modify attempts are denied (SC-006)
  2. All calls on the nonexistent group → `404`
  3. Per route and caller: status, `error.code`, and `error.message` are **identical** between the real-group and nonexistent-group responses — a non-member cannot distinguish an existing group from a missing one (existence hiding; "discloses none of the group's data")
  4. No side effects: members list still exactly {alice, bob}; expense list unchanged; `sumKurus === 0` (the write attempts created nothing)
- Note: the anonymous half of the matrix is TC-ACC-015 (all 21 endpoints → 401) — not duplicated here. The Expense and Balances plans cross-reference this TC for their routes' non-member behavior

### TC-GRP-022 — CSRF header required on all Groups-domain state-changing routes
- Traces to: API §1 (CSRF), arch. §8.2
- Level: integration
- Preconditions: alice created group "Trip"; carol has a pending request in it (for the decide routes); alice registered with a valid group name ready
- Steps: call each of `POST /api/groups`, `POST /api/join-requests` (as carol, valid code), `POST /api/join-requests/:requestId/approve` (as alice), `POST /api/join-requests/:requestId/reject` (as alice) **without** the `X-Requested-With` header (all other input valid)
- Expected result: each → `403`, code `CSRF_HEADER_MISSING`; no side effect — no group created (alice's overview count unchanged), no join request placed, and the pending request remains `PENDING`

### TC-GRP-023 — A user holds memberships in multiple groups simultaneously
- Traces to: FR-GRP-009, BR-GRP-006, NFR-GRP-004
- Level: integration
- Preconditions: alice created group A; bob created group B; alice is not a member of B
- Steps:
  1. `GET /api/join-info?code=<B's code>` as alice; `POST /api/join-requests` as alice; bob approves
  2. `GET /api/groups` as alice
  3. `GET /api/groups/A/members` and `GET /api/groups/B/members` as alice
- Expected result:
  2. `200` — exactly two entries: A (created) and B (joined)
  3. alice appears in both member lists (creator of A with `isCreator = true`, approved member of B with `isCreator = false`); memberships are independent — joining B did not affect A's member list or alice's creator status in A

### TC-GRP-024 — Full-scale fixture: 8 users, 5 groups, 8-member group
- Traces to: NFR-GRP-004, NFR-ACC-005 (cross-domain promise from the accounts-access plan), brief §7 expected scale
- Level: integration
- Preconditions: empty database; 8 fixed identities registered (`alice`…`heidi@test.local`); groups and memberships built entirely through the API factories
- Fixture shape (fixed, deterministic):
  - Group 1 "Trip": all 8 users (alice creator; bob…heidi approved via join requests)
  - Group 2 "Dinner": alice, bob, carol (alice creator)
  - Group 3 "Concert": dave, erin, frank (dave creator)
  - Group 4 "Movie": grace, heidi, alice (grace creator)
  - Group 5 "Picnic": bob, dave, frank, heidi (bob creator)
- Steps: for every group, `GET …/members` as its creator; for every user, `GET /api/groups`
- Expected result: every member list matches its fixture set exactly (set comparison; exactly one `isCreator = true` per group, the designated creator); every overview lists exactly the user's fixture groups — correct behavior at the brief's maximum expected scale (8 users, 5 concurrent groups, one group at the 8-member ceiling)

### TC-GRP-025 — Groups, memberships, and join requests persist through the exercised lifecycle
- Traces to: NFR-GRP-002, BR-GRP-007, BR-GRP-008, data-model §1 principle 4
- Level: integration
- Preconditions: empty database
- Steps:
  1. Run the full lifecycle through the API: alice creates "Trip" → bob requests → alice rejects → bob re-requests → alice approves → carol requests (leaves a pending row)
  2. As alice: `GET /api/groups/:groupId`, `GET …/members`, `GET …/join-requests`
  3. Read the `groups`, `memberships`, and `join_requests` tables directly (documented data model)
- Expected result:
  2. the group is readable; members = {alice, bob}; one pending request (carol)
  3. the group row exists; exactly two membership rows (alice creator, bob approved — nothing was removed); exactly two join-request rows — bob's `APPROVED` (flipped from REJECTED via re-request, `decidedAt` set) and carol's `PENDING` — **no row was deleted at any point**. (The absence of delete/archive endpoints for groups, memberships, and join requests is a contract-review fact — `03-api-design.md` defines none — not a runtime test; BR-GRP-008's "once a member, always a member" is the same absence on the membership side)

### TC-GRP-026 — Create a group through the UI
- Traces to: UC-GRP-001 (main, all steps), FR-GRP-001, FR-GRP-002
- Level: e2e
- Preconditions: fresh e2e database; self-contained — the test registers `gina@test.local` ("Gina") through the UI as in-test setup; browser authenticated as gina
- Steps: from the groups overview (`/`), choose create group; enter the name "Trip"; submit
- Expected result: the SPA navigates to the group view for "Trip"; the join code is displayed to gina (creator); the members surface shows gina as the (only) member

### TC-GRP-027 — Join a group by code through the UI
- Traces to: UC-GRP-002 (main, all steps), FR-GRP-003, BR-GRP-003
- Level: e2e
- Preconditions: self-contained — in-test setup: register `hank@test.local` ("Hank") via UI, create group "Trip" via UI, capture its join code from the creator view; register `iris@test.local` ("Iris") via UI
- Steps:
  1. As iris, open `/join/<code>`
  2. Confirm the join request
  3. As hank (separate browser context), open the group's join-request handling view
- Expected result:
  1. the join page shows the group's name ("Trip") before confirming (the join-info resolution, UC-GRP-002 steps 1–2)
  2. the request is placed and no membership exists yet — iris's groups overview does not contain "Trip"
  3. hank sees exactly one pending request showing iris's **display name** ("Iris")

### TC-GRP-028 — Approve a join request through the UI
- Traces to: UC-GRP-003 (main, all steps), FR-GRP-006, FR-GRP-010, FR-ACC-008 (UI — promised in the accounts-access plan)
- Level: e2e
- Preconditions: self-contained — same setup as TC-GRP-027 with identities `jack@test.local` ("Jack", creator) and `kate@test.local` ("Kate", joiner); kate's request is pending
- Steps: as jack, approve the pending request from the join-request handling view; open the members list
- Expected result: the request leaves the pending list; the member list shows both "Jack" and "Kate" — the new member is identified by display name (FR-ACC-008 in the UI)

### TC-GRP-029 — Reject a join request through the UI; re-request is possible
- Traces to: UC-GRP-004 (main, all steps), FR-GRP-007, FR-GRP-011, BR-GRP-010
- Level: e2e
- Preconditions: self-contained — same setup as TC-GRP-027 with identities `liam@test.local` ("Liam", creator) and `mia@test.local` ("Mia", joiner); mia's request is pending
- Steps:
  1. As liam, reject the pending request
  2. As mia, open `/join/<code>` again and re-request
  3. As liam, open the join-request handling view
- Expected result:
  1. the request leaves the pending list; the member list still shows only "Liam"
  2. the re-request is accepted (pending again)
  3. exactly one pending request for "Mia" — a rejected user may submit a new request (BR-GRP-010)

### TC-GRP-030 — Member list UI shows display names, never email addresses
- Traces to: UC-GRP-005 (main), FR-GRP-010, FR-ACC-008 (UI — promised in the accounts-access plan), BR-GRP-009 context
- Level: e2e
- Preconditions: self-contained — same setup as TC-GRP-027 with identities `noah@test.local` ("Noah", creator) and `olive@test.local` ("Olive", approved member via UI approval)
- Steps: as noah, open the group's members list; inspect the rendered DOM
- Expected result: the display names "Noah" and "Olive" are rendered; the strings `noah@test.local` and `olive@test.local` appear nowhere in the rendered member-list UI

### TC-GRP-031 — Group pages meet the page-load budget
- Traces to: NFR-GRP-003, SC-004, OBJ-003
- Level: e2e
- Preconditions: app built and served (e2e phase); self-contained — in-test setup: register `peter@test.local` ("Peter") via UI, create a group via UI; register `quinn@test.local` ("Quinn") via UI and place a join request (so the join-handling view has content); browser authenticated as peter
- Steps: load the groups overview (`/`), the group view (`/groups/:groupId`), and the creator's join-request handling view; measure each per the T4 policy (median of 3, one retry on breach)
- Expected result: each page's median load time ≤ **2.0 s**

### TC-GRP-032 — Join-by-code entry from the groups overview (code-entry path)
- Traces to: UC-GRP-002 (step 1 — "opening the link **or entering the code**"), FR-GRP-003, FR-GRP-004; PG-005 code entry → PG-009
- Level: e2e
- Preconditions: fresh e2e database; self-contained — in-test setup: register `rex@test.local` ("Rex") via UI, create group "Trip" via UI, capture its join code from the creator view; sign out; register `sara@test.local` ("Sara") via UI (signed in, a non-member of "Trip")
- Steps:
  1. From sara's groups overview (`/`), enter Trip's code in the join-by-code entry and submit
  2. Return to the overview, enter a well-formed code that matches no group (`ZZZZ9999`) in the same entry, and submit
- Expected result:
  1. the SPA navigates to `/join/<code>` and the join page shows the group's name "Trip" before confirming (PG-009 resolution — UC-GRP-002 steps 1–2 via the code-entry path, not a shared link)
  2. the SPA navigates to `/join/ZZZZ9999` and the join page shows its code-not-found state — an unknown code is indistinguishable from a missing group (FR-GRP-004), not an overview-level error

## 3. Test Design — Systematic Case Selection

### Equivalence partitioning
| Input | Partitions | Class behavior | Cases |
|---|---|---|---|
| Group name | empty/missing / 1–100 / > 100 | 400 / 201 / 400 | TC-004(a–e) |
| Join code submitted to join-info / join-requests | resolves to a group / unknown or malformed / missing field | 200 / 404 CODE_NOT_FOUND / 400 VALIDATION_FAILED | TC-007, 008, 010 |
| Requester's relation to the target group | none / pending / member / rejected | 201 PENDING / 409 PENDING_REQUEST_EXISTS / 409 ALREADY_MEMBER / 201 PENDING (row flip) | TC-009, 012, 011, 015 |
| Caller of the pending-requests list | creator / member non-creator / non-member / anonymous | 200 / 403 / 404 / 401 | TC-017, 021, TC-ACC-015 |
| Caller of approve/reject | creator / member non-creator / non-member / (request nonexistent) | 200 / 403 / 404 / 404 | TC-013/014, 018 |
| Caller of a group-scoped route | member / registered non-member (incl. member of another group) / anonymous | pass / 404 + parity / 401 | domain TCs, 021, TC-ACC-015 |
| Groups overview content | zero memberships / one / multiple | empty list / one entry / all-and-only own groups | TC-005, 023, 024 |

### Boundary value analysis
| Boundary | Values | Cases |
|---|---|---|
| Group name length | 0 (empty), 1, 100, 101, missing | TC-004(a–e) |
| Members per group (expected-scale ceiling, brief §7) | 8 (maximum expected) | TC-024 (group 1) — note: upstream defines no enforced upper limit, so a 9th-member rejection is **not** tested (would invent contract) |
| Groups per user | 0, 1, 2, up to ~5 concurrent | TC-005, 024, 023, 024 |
| Join code | exact-match key: well-formed-unknown / wrong length / wrong alphabet | all → 404 (TC-008) — no length boundary exists in the contract |

### Decision tables
**Join-request placement** — conditions: (code resolves?) × (requester's relation):

| Code resolves | Relation | Outcome | Case |
|---|---|---|---|
| T | none | 201, PENDING | TC-009 |
| T | pending | 409 PENDING_REQUEST_EXISTS | TC-012 |
| T | member (creator or approved) | 409 ALREADY_MEMBER | TC-011 |
| T | rejected | 201, PENDING (row flipped) | TC-015 |
| F | * | 404 CODE_NOT_FOUND (the code selects the group — resolution precedes relation checks) | TC-010 |

**Approve/reject** — conditions: (request exists?) × (caller's role) × (request status):

| Exists | Caller | Status | Outcome | Case |
|---|---|---|---|---|
| T | creator | PENDING | 200 + effect | TC-013/014 |
| T | creator | decided | 404 (interpretation I-1) | TC-019 |
| T | member non-creator | PENDING | 403 NOT_GROUP_CREATOR | TC-018 |
| T | non-member | PENDING | 404 (interpretation I-2) | TC-018 |
| F | * | * | 404 NOT_FOUND | TC-018 |

**Group-scoped route access** — conditions: (caller) × (group exists?):

| Caller | Group exists | Outcome | Case |
|---|---|---|---|
| anonymous | * | 401 UNAUTHENTICATED | TC-ACC-015 |
| non-member | T | 404 NOT_FOUND | TC-021 |
| non-member | F | 404 — body identical to the row above (existence hiding) | TC-021 |
| member | T | passes the guard into domain logic | TC-003/013/016/… |

### State transition testing — Join Request (per (groupId, userId))
States: `(none) → PENDING → APPROVED | REJECTED`, with `REJECTED → PENDING` on re-request (data-model §5.3).

| Transition / trigger | Legal? | Case |
|---|---|---|
| (none) → PENDING (place request, valid code, non-member) | ✓ | TC-009 |
| PENDING → APPROVED (creator approves) | ✓ | TC-013 |
| PENDING → REJECTED (creator rejects) | ✓ | TC-014 |
| REJECTED → PENDING (re-request; decidedAt cleared) | ✓ | TC-015 |
| PENDING → PENDING (duplicate request while pending) | illegal — 409 PENDING_REQUEST_EXISTS | TC-012 |
| APPROVED → PENDING (member requests again) | illegal — 409 ALREADY_MEMBER | TC-011 |
| APPROVED → APPROVED / REJECTED (decide a decided request) | illegal — 404 (I-1); no state change | TC-019 |
| REJECTED → APPROVED / REJECTED (decide without re-request) | illegal — 404 (I-1); no state change | TC-019 |

### State transition testing — Membership
States: `(none) → member` (permanent — BR-GRP-008).

| Transition / trigger | Legal? | Case |
|---|---|---|
| (none) → member (creator, atomically with group creation) | ✓ | TC-003 |
| (none) → member (join request approved) | ✓ | TC-013 |
| member → (none) (removal) | illegal by design — no endpoint exists | Contract review (03) + TC-025 (retention) |
| member → member of another group (multi-group) | ✓ (independent rows) | TC-023, TC-024 |

### State transition testing — Group
States: `created → exists` (forever — BR-GRP-007).

| Transition / trigger | Legal? | Case |
|---|---|---|
| (none) → created (valid name, authenticated caller) | ✓ | TC-003, 004(b/c) |
| created → deleted / archived | illegal by design — no endpoint exists | Contract review (03) + TC-025 (retention) |

## 4. Coverage Matrix

| Requirement | Flows covered | Test Cases | Status |
|---|---|---|---|
| FR-GRP-001 | UC-GRP-001 main | TC-003, 026 | Covered |
| FR-GRP-002 | UC-GRP-001 step 3; creator-only visibility; per-group uniqueness | TC-003, 006 (+ generator TC-001/002) | Covered |
| FR-GRP-003 | UC-GRP-002 main | TC-009, 027, 032 (code-entry path) | Covered |
| FR-GRP-004 | UC-GRP-002 E1 (both resolve and request paths) | TC-008, 010 | Covered |
| FR-GRP-005 | UC-GRP-003/004 step 1; creator-only | TC-009 (step 2), 013/014 (step 4), 017, 020 | Covered |
| FR-GRP-006 | UC-GRP-003 main | TC-013, 028 | Covered |
| FR-GRP-007 | UC-GRP-004 main | TC-014, 029 | Covered |
| FR-GRP-008 | UC-GRP-006 main (read + modify, existence hiding) | TC-021 (12 routes × 2 callers) + TC-ACC-015 (anonymous) | Covered |
| FR-GRP-009 | BR-GRP-006 | TC-005, 023, 024 | Covered |
| FR-GRP-010 | UC-GRP-005 main | TC-016, 013 (step 2), 028, 030 | Covered |
| FR-GRP-011 | UC-GRP-004 postcondition, BR-GRP-010 | TC-015, 029 | Covered |
| FR-GRP-012 | UC-GRP-002 A2; structural single-row guarantee | TC-012, 015 (step 2–3) | Covered |
| FR-GRP-013 | UC-GRP-002 A1 (creator-self and approved member) | TC-011 | Covered |
| UC-GRP-001 | main, E1 | TC-003/004 (API), TC-026 (UI) | Covered |
| UC-GRP-002 | main, A1, A2, E1 | TC-009/011/012/010 (API), TC-027 (UI link path), TC-032 (UI code-entry path) | Covered |
| UC-GRP-003 | main | TC-013 (API), TC-028 (UI) | Covered |
| UC-GRP-004 | main (postcondition: re-request; outcome out-of-band — nothing to assert) | TC-014 (API), TC-029 (UI) | Covered |
| UC-GRP-005 | main | TC-016 (API), TC-030 (UI) | Covered |
| UC-GRP-006 | main (anonymous + registered non-member, read + modify, no disclosure) | TC-021, TC-ACC-015, TC-ACC-025 (UI redirect) | Covered |
| NFR-GRP-001 | deny-by-default on every group-scoped route | TC-021 (+ TC-ACC-015) | Covered |
| NFR-GRP-002 | retention of groups/memberships/join requests | TC-025 + contract review (no delete endpoints) | Covered (by design) |
| NFR-GRP-003 | ≤ 2 s group pages (overview, group view, join handling) | TC-031 | Covered |
| NFR-GRP-004 | ≤ 5 groups × ≤ 8 members, multi-group | TC-023, 024 | Covered (functional; no load test by design, §1) |
| NFR-GRP-005 | join-code secrecy | TC-001, 002 (+ API-level format/distinctness TC-003/006) | Covered (entropy by construction, §1) |
| BR-GRP-001 | any registered user creates a group | TC-003 (and every creator fixture: 023, 024, e2e) | Covered |
| BR-GRP-002 | one code per group, generated at creation, held by creator | TC-003, 006, 001/002 | Covered |
| BR-GRP-003 | code required to place a request | TC-009/010 (no code → no request; the only request path takes a code) | Covered |
| BR-GRP-004 | membership only on approval; rejection possible | TC-013, 014 | Covered |
| BR-GRP-005 | creator is a member from creation | TC-003 (step 3) | Covered |
| BR-GRP-006 | multi-group membership | TC-023, 024 | Covered |
| BR-GRP-007 | groups persist, no deletion | TC-025 + contract review | Covered (by design) |
| BR-GRP-008 | once a member, always a member | TC-025 (retention), TC-019 (reject-after-approve changes nothing) + contract review | Covered (by design) |
| BR-GRP-009 | only members see group data | TC-021 (+ TC-ACC-015) | Covered |
| BR-GRP-010 | rejected user may re-request | TC-015, 029 | Covered |
| SC-006 | non-member cannot read or modify; nothing disclosed | TC-021 (matrix + parity + no side effects), TC-ACC-015 | Covered |
| API §1/§4 | CSRF on the 4 Groups routes; error codes `CODE_NOT_FOUND`, `ALREADY_MEMBER`, `PENDING_REQUEST_EXISTS`, `NOT_GROUP_CREATOR` | TC-022; TC-008/010, 011, 012, 017/018 | Covered |
| Cross-domain promise (accounts-access plan) | FR-ACC-008 UI assertions | TC-028, 030 | Covered |
| Cross-domain promise (accounts-access plan) | NFR-ACC-005 scale fixture (8 users, 5 groups) | TC-024 | Covered |
| — | Interpretation I-1: decide-on-decided → 404 | TC-019 | Covered — **confirmed by architect amendment 2026-09-25** (API §3 note) |
| — | Interpretation I-2: non-member caller on approve/reject → 404 (member non-creator → 403) | TC-018 | Covered — **confirmed by architect amendment 2026-09-25** (API §3 note) |
| — | Combined case: member non-creator on a decided request → 403 (specified by the amendment) | TC-019 (row c) | Covered |