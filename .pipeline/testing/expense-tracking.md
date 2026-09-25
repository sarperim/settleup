# Expense Tracking Test Plan

Status: **awaiting Gate 2 approval** · Date: 2026-09-25
Domain report: `.pipeline/analysis/expense-tracking.md` · Architecture: `01-system-architecture.md` (C4, C6, §5.1), `02-data-model.md` (expenses/expense_shares, §8), `03-api-design.md` (§1, §3b, §4) · Inherits every rule of `.pipeline/testing/00-test-strategy.md` (approved at Gate 1).

**Conventions for all integration cases below** (from the strategy, identical to the previous plans): every state-changing HTTP call carries `X-Requested-With: XMLHttpRequest`; the app under test boots in-process (supertest) against a real PostgreSQL; every test starts from truncated tables; `COOKIE_SECURE=true`; fixed identities (`alice@test.local` group creator, `bob@test.local` and `carol@test.local` approved members, `dave@test.local` registered non-member; passwords `password-1`, …). The standing group fixture is built with the factories: `createGroup` (alice) + `joinAndApprove` (bob, carol). **Determinism of share values (strategy T5):** the split engine's CSPRNG is faked only in unit tests (seeded PRNG); at integration/e2e level the random remainder draw is asserted **structurally** (sum, per-share bounds, count of +1 shares), never as specific participant assignments. Where exact share or balance **values** must be asserted, fixtures use **exact splits or evenly dividing equal splits** — deterministic by construction. **E2e conventions:** per-run recreated database; every e2e case is self-contained with its own unique fixed identities registered through the UI.

## 1. Scope

**Covered here:** FR-EXP-001…012 · UC-EXP-001 (main, A1, E1–E4), UC-EXP-002 (main, E1, E2), UC-EXP-003 (main, E1), UC-EXP-004 (main, E1) · NFR-EXP-001…005 · BR-EXP-001…011 · ASM-001 (random-spread remainder properties — SC-002's split-engine half) · ASM-002 / `parseKurus`/`formatKurus` (C6 money boundary) · the create/edit/delete parameters of the SC-005 zero-sum suite · NFR-EXP-004 scale (50-expense ledger) and the defensive list cap (strategy G-5) · CSRF enforcement on the three expense state-changing routes · the FR-ACC-008 UI assertions for expense views (promised by the accounts-access plan).

**Deliberately NOT tested here, and why:**

| Exclusion | Reason |
|---|---|
| Non-member access to expense routes (UC-EXP-001 E4, UC-EXP-004 E1) | Owned by the SC-006 authorization matrix — **TC-GRP-021** covers all 12 group-scoped routes (incl. the 5 expense routes) with existence-hiding parity; anonymous is TC-ACC-015. Cross-referenced, not duplicated |
| Precedence among simultaneous service-level errors (e.g., an exact split whose amounts both mismatch the total **and** name a non-member participant) | Unspecified upstream (API §4 fixes only DTO-vs-service precedence). Each error is tested in isolation; combined-error outcomes are intentionally untested — all are 400s that create no expense, so no FR distinguishes them |
| `parseKurus` behavior beyond the documented contract (leading/trailing spaces, `"+"`-prefixed input, `"123."`) | Data-model §8 enumerates the accepted and rejected forms exhaustively; unlisted forms are unspecified — not tested |
| Money movement, receipts, recurring expenses, percentages/weighted splits, user-editable expense dates | Scope-out (brief §6, BR-EXP-003/008); the absence of a date field in the DTOs is a contract-review fact (API §3b note) |
| Suggestion/balance **values** after expenses | Owned by the Balances & Settlement plan (this domain contributes `sumKurus === 0` after each operation — TC-EXP-023) |

## 2. Test Cases

### TC-EXP-001 — parseKurus accepts the documented valid forms
- Traces to: ASM-002, BR-EXP-010 (zero valid), data-model §8, arch. §4 (money discipline)
- Level: unit (`packages/shared`)
- Preconditions: none — pure function, no DB, no HTTP
- Steps: call `parseKurus` with each of `"123"`, `"123.4"`, `"123.45"`, `"0"`, `"0.00"`, `"0.01"`
- Expected result: `12300`, `12340`, `12345`, `0`, `0`, `1` (integer kuruş) — every documented valid form converts exactly

### TC-EXP-002 — parseKurus rejects the documented invalid forms (incl. storage bound)
- Traces to: ASM-002, BR-EXP-010 (negative invalid), FR-EXP-002 (API-side counterpart), data-model §8 (bound 2,147,483,647 kuruş)
- Level: unit (`packages/shared`)
- Preconditions: none
- Steps: call `parseKurus` with each of `"-1"`, `"-0.01"`, `"1.234"`, `"1,23"`, `"abc"`, `""`, and the boundary pair `"21474836.47"` / `"21474836.48"`
- Expected result: every input **except** `"21474836.47"` is rejected (throws / returns an error result — the shared helper's documented failure mode); `"21474836.47"` → `2147483647` (the exact storage ceiling is the last accepted value; one kuruş more is rejected — BVA at the `Int` bound)

### TC-EXP-003 — formatKurus renders kuruş as 2-decimal TRY strings
- Traces to: ASM-002, data-model §8
- Level: unit (`packages/shared`)
- Preconditions: none
- Steps: call `formatKurus` with `0`, `5`, `12345`, `2147483647`
- Expected result: `"0.00"`, `"0.05"`, `"123.45"`, `"21474836.47"` — round-trips with `parseKurus` (`parseKurus(formatKurus(k)) === k` for these values)

### TC-EXP-004 — Equal-split properties (seeded property test)
- Traces to: ASM-001, BR-EXP-004, FR-EXP-004, FR-EXP-005, SC-002 (split-engine properties), R-EXP-001, arch. §5.1
- Level: unit (split engine, seeded deterministic PRNG injected — strategy T5)
- Preconditions: fast-check with a fixed seed; generators per strategy §5: amount 0…2,147,483,647 kuruş, participant count 1–8
- Steps: for each generated (amount, n, seed-stream): run the equal split; compute `base = floor(amount / n)` and `r = amount − n·base`
- Expected result (all must hold for every generated case):
  1. shares sum **exactly** to `amount` (exact-sum property)
  2. every share is `base` or `base + 1` — no participant receives more than one extra kuruş
  3. exactly `r` participants hold `base + 1` — the remainder is spread one-per-distinct-participant
  4. one share row per participant (no missing, no duplicate participant)
- Note: failures must be reproducible from the reported seed (strategy §7 rule 2)

### TC-EXP-005 — Equal-split edge cases and determinism
- Traces to: ASM-001, BR-EXP-004/005, FR-EXP-004/005, OQ-EXP-002 (zero amount), SC-002 edge list
- Level: unit (seeded PRNG)
- Preconditions: none
- Steps and expected results:
  | Case | Input | Expected shares |
  |---|---|---|
  | a | amount 0, n = 3 | all shares 0 (r = 0 — no draw needed) |
  | b | n = 1, amount 12345 | single share 12345 (r = 0) |
  | c | amount 2, n = 3 (amount < n) | base 0, r 2 → two shares of 1 and one of 0 |
  | d | amount 900, n = 3 (divides exactly) | 300 / 300 / 300 (r = 0 — no remainder) |
  | e | determinism | same input + same seed → identical share vector, twice in a row |
  | f | large | amount 2,147,483,647, n = 8 → sum exact, per-share bounds hold (overlaps TC-004 by construction; kept as a named reproducible case) |

### TC-EXP-006 — Exact-split sum validation (engine level)
- Traces to: BR-EXP-006, FR-EXP-007, OQ-EXP-003 (zero shares valid)
- Level: unit (split engine)
- Preconditions: none
- Steps: run the exact split with per-participant amounts summing exactly to the total; then with the total off by −1; then off by +1; then a valid vector containing a 0-kuruş share
- Expected result: exact-sum vector accepted (shares as entered, zeros preserved); both off-by-one vectors rejected with the sum-mismatch outcome that the service surfaces as `400 SPLIT_SUM_MISMATCH`; the zero-share vector accepted (a participant may be included at 0.00)

### TC-EXP-007 — Log an expense, equal split, even division (UC-EXP-001 main)
- Traces to: FR-EXP-001, FR-EXP-004, FR-EXP-006 (store), FR-EXP-010, UC-EXP-001 (main, steps 1–7), BR-EXP-001, BR-EXP-002
- Level: integration
- Preconditions: standing group fixture (alice creator; bob, carol members)
- Steps:
  1. `POST /api/groups/:groupId/expenses` as alice: `{ description: "Dinner", amountKurus: 9000, payerId: <alice>, participantIds: [<alice>, <bob>, <carol>], splitType: "EQUAL" }`
  2. `GET /api/groups/:groupId/expenses/:expenseId` as bob
- Expected result:
  1. `201`; body `{ expense }` with `description`, `amountKurus: 9000`, `splitType: "EQUAL"`, `createdAt` present and server-set, `editedAt` absent (never edited); `shares` has exactly 3 entries, one per participant, each `3000` (even division — deterministic); the expense identifies its logger as alice and its payer as alice
  2. `200` — the same expense is readable by any member (UC-EXP-004 read aspect); payer and participant references expose `displayName` (FR-ACC-008 positive; email absence is TC-ACC-018)

### TC-EXP-008 — Uneven equal split applies the random-spread remainder (A1)
- Traces to: FR-EXP-004, FR-EXP-005, UC-EXP-001 (A1), ASM-001, BR-EXP-004
- Level: integration (real CSPRNG — structural assertions only, per conventions)
- Preconditions: standing group fixture
- Steps: `POST …/expenses` as alice: `{ description: "Lunch", amountKurus: 10000, payerId: <alice>, participantIds: [<alice>, <bob>, <carol>], splitType: "EQUAL" }`
- Expected result: `201`; shares sum exactly to `10000`; each share is `3333` or `3334`; exactly one participant holds `3334` (r = 1); the specific recipient of the extra kuruş is **not** asserted (random draw — T5); the stored shares are returned and are the expense's permanent record (FR-EXP-006)

### TC-EXP-009 — Exact split is stored as entered (incl. zero share)
- Traces to: FR-EXP-001, FR-EXP-007 (accept side), BR-EXP-006, OQ-EXP-003
- Level: integration
- Preconditions: standing group fixture
- Steps: `POST …/expenses` as alice: `{ description: "Tickets", amountKurus: 5000, payerId: <bob>, participantIds: [<alice>, <bob>, <carol>], splitType: "EXACT", exactAmounts: { <alice>: 0, <bob>: 2500, <carol>: 2500 } }`
- Expected result: `201`; shares exactly `{alice: 0, bob: 2500, carol: 2500}` — zero-kuruş participation preserved; payer is bob while the logger is alice (any member may log — BR-EXP-001)

### TC-EXP-010 — Exact split summing to anything but the amount is rejected (E1)
- Traces to: FR-EXP-007 (reject side), UC-EXP-001 (E1), BR-EXP-006
- Level: integration
- Preconditions: standing group fixture
- Steps: `POST …/expenses` with `EXACT` amounts summing to `4999`, then to `5001` (amount `5000`)
- Expected result: both → `400`, code `SPLIT_SUM_MISMATCH`; no expense is created in either case (the ledger list is unchanged)

### TC-EXP-011 — Empty participant list is rejected (E2)
- Traces to: UC-EXP-001 (E2), BR-EXP-002 (≥ 1 participant)
- Level: integration
- Preconditions: standing group fixture
- Steps: `POST …/expenses` with `participantIds: []` (all else valid)
- Expected result: `400`, code `NO_PARTICIPANTS`; no expense created

### TC-EXP-012 — Expense field validation (boundary values)
- Traces to: FR-EXP-002 (E3, API side), UC-EXP-001 (E3), BR-EXP-008 (no date field), API §1 field limits, data-model §8 (amount bound)
- Level: integration
- Preconditions: standing group fixture; each row from a clean precondition state
- Steps: `POST …/expenses` with the row's payload (valid rows use a fresh description):

| Row | Input | Expected |
|---|---|---|
| a | `amountKurus: -1` | `400 VALIDATION_FAILED` |
| b | `amountKurus: 0` | `201` (BR-EXP-010 / OQ-EXP-002 — zero valid; shares all 0) |
| c | `amountKurus: 2147483647` | `201` |
| d | `amountKurus: 2147483648` | `400 VALIDATION_FAILED` |
| e | `amountKurus` missing | `400 VALIDATION_FAILED` |
| f | `amountKurus: 100.5` (non-integer JSON) | `400 VALIDATION_FAILED` |
| g | description `""` | `400 VALIDATION_FAILED` |
| h | description 1 char | `201` |
| i | description 200 chars | `201` |
| j | description 201 chars | `400 VALIDATION_FAILED` |
| k | description missing | `400 VALIDATION_FAILED` |
| l | `splitType: "WEIGHTED"` | `400 VALIDATION_FAILED` |
| m | `splitType` missing | `400 VALIDATION_FAILED` |
| n | `payerId` missing | `400 VALIDATION_FAILED` |

- Expected result: per table; every invalid row creates no expense (ledger unchanged). Note: there is **no date field** in the request DTO anywhere (BR-EXP-008) — a contract-review fact; timestamps are server-set (TC-EXP-007/015)

### TC-EXP-013 — Payer or participant outside the group is rejected
- Traces to: FR-EXP-003, BR-EXP-002 (member-only payer/participants)
- Level: integration
- Preconditions: standing group fixture; dave registered (non-member)
- Steps:
  1. `POST …/expenses` with `payerId: <dave>` (participants valid)
  2. `POST …/expenses` with `participantIds` containing dave among members
- Expected result: both → `400`, code `PARTICIPANT_NOT_MEMBER`; no expense created

### TC-EXP-014 — Zero amount, single participant, payer-not-participant (combined valid edges)
- Traces to: BR-EXP-002 (payer independent of participants), BR-EXP-010, OQ-EXP-001, OQ-EXP-002
- Level: integration
- Preconditions: standing group fixture
- Steps:
  1. `POST …/expenses`: amount `10000`, payer alice, `participantIds: [<bob>]` only (payer not a participant), `EQUAL`
  2. `POST …/expenses`: amount `0`, payer alice, `participantIds: [<alice>]` (single participant = the payer), `EQUAL`
- Expected result:
  1. `201` — share `{bob: 10000}`; payer and participants are independent (the payer may sit outside the split)
  2. `201` — single share `{alice: 0}`; a single-participant expense is valid and nets a zero balance change

### TC-EXP-015 — Edit an expense by its logger (parameterized over changed fields)
- Traces to: FR-EXP-006 (recompute rule), FR-EXP-008, FR-EXP-010 (editedAt), UC-EXP-002 (main), BR-EXP-005, BR-EXP-007
- Level: integration
- Preconditions (per row, from a clean base): alice logged an expense (base: 9000 kuruş EQUAL over alice+bob+carol → shares 3000/3000/3000; for the EXACT rows: EXACT `{alice: 0, bob: 2500, carol: 2500}`)
- Steps: `PATCH /api/groups/:groupId/expenses/:expenseId` as alice with the row's change:

| Row | Change | Expected |
|---|---|---|
| a | description only → "Dinner 2" | `200`; description updated; shares **unchanged** (still 3000/3000/3000 — no recompute, no fresh draw); `editedAt` set |
| b | amount → 12000 (EQUAL) | `200`; shares recomputed: sum 12000, each 4000 (still even); `editedAt` set |
| c | participants → [alice, bob] only (EQUAL, amount 9000) | `200`; shares recomputed over the new set: 4500/4500 |
| d | splitType EQUAL → EXACT with `exactAmounts {alice: 9000, bob: 0, carol: 0}` | `200`; shares exactly as entered |
| e | payer only → bob | `200`; payer updated; shares **unchanged** (a payer change is not a recompute trigger — FR-EXP-006 names amount/participants/splitType only) |
| f | splitType EXACT → EQUAL (amount 5000 over 3) | `200`; shares recomputed per the equal rule: sum 5000, each 1666 or 1667, exactly 2 shares of 1667 (r = 2, structural) |

- Expected result: per table — every row: `200`, `editedAt` present and ≥ `createdAt`, zero-sum preserved (cross-checked by TC-EXP-023); rows a and e prove the shares are the **stored permanent record** untouched by non-triggering edits (BR-EXP-005)

### TC-EXP-016 — Edit by anyone other than the logger is denied (E2)
- Traces to: FR-EXP-008, UC-EXP-002 (E2), BR-EXP-007
- Level: integration
- Preconditions: alice logged an expense (bob is a member — even as payer or participant)
- Steps:
  1. `PATCH …/expenses/:expenseId` as bob with `{ description: "Tampered" }`
  2. `GET …/expenses/:expenseId` as alice
- Expected result:
  1. `403`, code `NOT_LOGGER` — even a payer or participant cannot edit (BR-EXP-007)
  2. `200` — the expense is unchanged: original description, original shares, `editedAt` still absent

### TC-EXP-017 — Edit that fails validation leaves the expense unchanged (E1)
- Traces to: UC-EXP-002 (E1), FR-EXP-002/007 (edit side)
- Level: integration
- Preconditions: alice logged an EXACT expense `{alice: 2500, bob: 2500}` (amount 5000)
- Steps:
  1. `PATCH …/expenses/:expenseId` as alice with `{ amountKurus: 6000 }` (amount changes; the stored exactAmounts now sum to 5000 ≠ 6000)
  2. `GET …/expenses/:expenseId` as alice
- Expected result:
  1. `400`, code `SPLIT_SUM_MISMATCH` — an edit must satisfy the same validation as a create, against the **new** amount
  2. `200` — unchanged: amount 5000, original shares, `editedAt` still absent (a failed edit sets no timestamp)

### TC-EXP-018 — Delete an expense by its logger: permanent removal (UC-EXP-003 main)
- Traces to: FR-EXP-009, FR-EXP-012, UC-EXP-003 (main), BR-EXP-011, NFR-EXP-005
- Level: integration
- Preconditions: alice logged expense E1 (unedited) and expense E2 (previously edited — TC-EXP-015 state)
- Steps:
  1. `DELETE …/expenses/<E1>` as alice
  2. `GET …/expenses` and `GET …/expenses/<E1>` as alice
  3. `DELETE …/expenses/<E2>` as alice (an edited expense is equally deletable)
  4. Read the `expenses` and `expense_shares` tables directly
- Expected result:
  1. `204`, empty body
  2. list no longer contains E1; detail → `404 NOT_FOUND`
  3. `204`
  4. **hard delete**: no row for E1 or E2 in `expenses`; zero `expense_shares` rows for either (cascade — BR-EXP-011); no archive table, no soft-delete flag (data-model §1 principle 4)

### TC-EXP-019 — Delete by anyone other than the logger is denied (E1)
- Traces to: FR-EXP-009, UC-EXP-003 (E1), BR-EXP-007
- Level: integration
- Preconditions: alice logged an expense; bob is a member
- Steps: `DELETE …/expenses/:expenseId` as bob; then `GET …/expenses/:expenseId` as alice
- Expected result: `403`, code `NOT_LOGGER`; the expense remains readable and unchanged

### TC-EXP-020 — Nonexistent or cross-group expense id → 404
- Traces to: API §3b (404 NOT_FOUND), FR-EXP-011 (scoping)
- Level: integration
- Preconditions: alice is a member of groups A and B; an expense exists in B
- Steps: as alice — `GET /api/groups/A/expenses/<B's expense id>`; `PATCH` and `DELETE` on `/api/groups/A/expenses/nonexistent-id`
- Expected result: all three → `404`, code `NOT_FOUND` — an expense is only addressable through its own group; a missing id is indistinguishable from a foreign one

### TC-EXP-021 — Group ledger lists all expenses, newest first (UC-EXP-004 main)
- Traces to: FR-EXP-011, UC-EXP-004 (main), NFR-EXP-004 (list shape), data-model §4 (`@@index([groupId, createdAt])`)
- Level: integration
- Preconditions: three expenses created sequentially via the API (distinct server-set `createdAt`), plus one in another group
- Steps: `GET /api/groups/:groupId/expenses` as a member
- Expected result: `200`; the list contains exactly the group's 3 expenses (the other group's expense is absent — group scoping); sorted by `createdAt` descending (each adjacent pair non-increasing; the most recently created expense is first)

### TC-EXP-022 — Expense detail shape: shares, identities, timestamps
- Traces to: FR-EXP-011, UC-EXP-004 (main step 2), BR-EXP-008, FR-ACC-008 (positive, expense payload)
- Level: integration
- Preconditions: an EQUAL expense (alice payer, 3 participants) and an edited EXACT expense exist
- Steps: `GET …/expenses/:expenseId` for each, as a member
- Expected result: `200` per expense — `description`, `amountKurus`, `splitType`, `createdAt` always present; `editedAt` present only on the edited one; `shares` with one entry per participant (participant reference exposes `displayName`); payer reference exposes `displayName`; no email anywhere (cross-ref TC-ACC-018); no user-settable date field

### TC-EXP-023 — Zero-sum holds after every expense operation (SC-005, expense parameters)
- Traces to: SC-005, NFR-EXP-003, OBJ-004, FR-EXP-012 postcondition, UC-EXP-001/002/003 postconditions
- Level: integration
- Preconditions: standing group fixture; this case is **parameterized** — after each operation below, `GET /api/groups/:groupId/balances` is called and `sumKurus === 0` asserted
- Steps (operation matrix, expense half — the settle/undo half is TC-BAL-016; together they cover the full SC-005 matrix):
  1. create: equal even (TC-EXP-007 input) · equal uneven (TC-EXP-008 input) · exact (TC-EXP-009 input) · zero amount · single participant
  2. edit: description-only · amount · participants · splitType · payer-only (the TC-EXP-015 rows)
  3. delete: of an unedited and of an edited expense
- Expected result: `sumKurus === 0` after **every** parameter — exact integer 0, no rounding drift, regardless of remainder draws (the random spread never breaks the invariant)

### TC-EXP-024 — 50-expense ledger correctness at expected scale
- Traces to: NFR-EXP-004, brief §7 (20–50 expenses per trip)
- Level: integration
- Preconditions: standing group fixture (3 members); 50 expenses created through the API factory loop (fixed, deterministic mix: rotating payer among members, EQUAL even/uneven and EXACT splits, descriptions "E01"…"E50")
- Steps: `GET /api/groups/:groupId/expenses`; `GET /api/groups/:groupId/balances`
- Expected result: `200` — exactly 50 expenses, newest first, every expense's shares sum to its amount (spot-verified full set); `sumKurus === 0` across the full ledger; the response is a single full list (no pagination — NFR-EXP-004)

### TC-EXP-025 — Defensive list cap beyond 500 expenses (strategy G-5)
- Traces to: NFR-EXP-004 (defensive cap), arch. §9 flag 4, API §3b (`500 LIST_TOO_LARGE`)
- Level: integration
- Preconditions: 501 expenses seeded via direct Prisma (scale-fixture permission, strategy §5); fixture validity asserted — every seeded expense's shares sum exactly to its amount
- Steps: `GET /api/groups/:groupId/expenses` as a member
- Expected result: `500`, code `LIST_TOO_LARGE`, standard error envelope — the defensive cap fires rather than returning an oversized response; never expected at brief §7 scale (documented defensive path)

### TC-EXP-026 — Expenses persist until their logger deletes them (NFR-EXP-005)
- Traces to: NFR-EXP-005, BR-EXP-011 context, UC-EXP-001 postcondition
- Level: integration
- Preconditions: expenses E1 and E2 logged by alice
- Steps: edit E1 (description); delete E2; then `GET …/expenses/<E1>` and `GET …/expenses`
- Expected result: E1 remains readable with its edit applied (`editedAt` set) — no archiving, TTL, or cascade from unrelated operations; E2 is gone (the only removal path is its logger's delete); persistence across operations is the retention proof at ledger level

### TC-EXP-027 — CSRF header required on all expense state-changing routes
- Traces to: API §1 (CSRF), arch. §8.2
- Level: integration
- Preconditions: standing group fixture; alice has logged an expense
- Steps: call `POST …/expenses` (valid body), `PATCH …/expenses/:expenseId` (valid change), `DELETE …/expenses/:expenseId` — each **without** `X-Requested-With`, as a member
- Expected result: each → `403`, code `CSRF_HEADER_MISSING`; no side effect — no expense created, the existing expense unchanged (description, shares, `editedAt` absent)

### TC-EXP-028 — Add-expense journey through the UI within 30 seconds (SC-003)
- Traces to: SC-003, NFR-EXP-001, UC-EXP-001 (main, UI), OBJ-003, arch. §7 NFR-EXP-001 row (SPA route `/groups/:groupId/expenses/new`)
- Level: e2e
- Preconditions: fresh e2e database; self-contained — in-test setup: register `sara@test.local` ("Sara") and `tomas@test.local` ("Tomás") via UI; sara creates group "Trip"; tomas joins via code and is approved (so the group has 2 members); browser authenticated as sara on the group page
- Steps:
  1. From the group view, reach the add-expense form (count the interactions)
  2. Assert the form's initial state: all member checkboxes **preselected** (participants default to all members); payer select defaults to the acting user (sara); the form is a **single screen** (no wizard steps)
  3. Enter an invalid amount (`"abc"`); observe validation
  4. Enter description "Dinner", amount `"120.50"`, split EQUAL; submit; measure from step-1 start to the expense visible in the ledger (T4: median of 3 journeys, one retry on breach); also measure the submit→visible latency
- Expected result:
  1. the form is reachable in **≤ 2 interactions** from the group page
  2. defaults as stated (deterministic enablers of the 30-second target)
  3. an inline validation error appears **without** any request to `…/expenses` being sent (client-side validation — no round-trips until submit)
  4. the full journey's median ≤ **30 s** (SC-003 hard gate); the created expense shows 120.50 (the UI's decimal string crossed `parseKurus` exactly — 12050 kuruş); submit→visible is measured and logged, CI-enforced at 3× the 500 ms sub-budget per strategy T4 (no hard gate on the sub-budget)

### TC-EXP-029 — Edit an expense through the UI (logger only)
- Traces to: UC-EXP-002 (main, UI), FR-EXP-008 (UI aspect), NFR-EXP-001 context
- Level: e2e
- Preconditions: self-contained — setup as TC-EXP-028 (identities `uma@test.local` creator + `vic@test.local` member); uma has logged an expense via the UI
- Steps:
  1. As vic (member, not logger), open the expense in the ledger
  2. As uma, open the expense's edit form; change the amount; save
- Expected result:
  1. vic sees the expense but **no edit affordance** (UI enforces logger-only — BR-EXP-007's UI aspect)
  2. the updated amount appears in the ledger; the edit form is a single screen

### TC-EXP-030 — Delete an expense through the UI (logger only)
- Traces to: UC-EXP-003 (main, UI), FR-EXP-009 (UI aspect)
- Level: e2e
- Preconditions: self-contained — setup as TC-EXP-028 (identities `wren@test.local` creator + `xavi@test.local` member); wren has logged an expense; xavi sees no delete affordance
- Steps: as wren, delete the expense from the ledger
- Expected result: the expense disappears from the ledger; no delete affordance was ever shown to xavi

### TC-EXP-031 — Expense list UI renders identities by display name (FR-ACC-008 UI promise)
- Traces to: UC-EXP-004 (main, UI), FR-EXP-011, FR-ACC-008 (UI — promised in the accounts-access plan), BR-EXP-009
- Level: e2e
- Preconditions: self-contained — setup as TC-EXP-028 (identities `yara@test.local` creator + `zane@test.local` member); yara logged an expense paid by zane splitting both
- Steps: as yara, open the group's expenses tab; inspect the rendered DOM
- Expected result: the expense entry shows its description, amount, and payer — the payer is rendered as "Zane" (display name); the strings `yara@test.local` and `zane@test.local` appear nowhere in the rendered ledger UI

### TC-EXP-032 — Expense pages meet the page-load budget
- Traces to: NFR-EXP-002, SC-004, OBJ-003
- Level: e2e
- Preconditions: app built and served; self-contained — setup as TC-EXP-028 (identity `abel@test.local`, one group, ≥ 1 expense); browser authenticated
- Steps: load the group view's expenses tab, the add-expense form, and the edit-expense form; measure per the T4 policy (median of 3, one retry on breach)
- Expected result: each page's median load time ≤ **2.0 s**

### TC-EXP-033 — 50-expense ledger page within the page budget (NFR-EXP-004, e2e half)
- Traces to: NFR-EXP-004, NFR-EXP-002, SC-004
- Level: e2e
- Preconditions: self-contained — register `bella@test.local` + `cedric@test.local` via UI; bella creates a group; cedric joins via approval (scenario data through the UI); then **50 expenses are seeded via direct Prisma** into that group (scale-fixture permission, strategy §5 — the e2e-data-through-UI rule governs scenario data, which scale fixtures are not); seed validity asserted: each expense's shares sum exactly to its amount; browser authenticated as bella
- Steps: load the group's expenses tab; measure per T4; count rendered entries
- Expected result: median load ≤ **2.0 s** with all 50 expenses rendered — the ledger page stays inside the page budget at the top of the expected per-trip scale

## 3. Test Design — Systematic Case Selection

### Equivalence partitioning
| Input | Partitions | Class behavior | Cases |
|---|---|---|---|
| `parseKurus` input (UI money boundary) | documented valid forms / negative / 3-decimal / comma separator / non-numeric / empty / above storage bound | convert / reject (all) | TC-001, 002 |
| `amountKurus` (API) | < 0 / 0 / 1…2^31−1 / ≥ 2^31 / missing / non-integer | 400 / 201 / 201 / 400 / 400 / 400 | TC-012(a–f) |
| `description` | empty / 1–200 / > 200 / missing | 400 / 201 / 400 / 400 | TC-012(g–k) |
| `splitType` | EQUAL / EXACT / other / missing | 201 / 201 / 400 / 400 | TC-007, 009, 012(l–m) |
| `participantIds` | empty / exactly 1 / 2–8 members / contains non-member | 400 NO_PARTICIPANTS / 201 / 201 / 400 PARTICIPANT_NOT_MEMBER | TC-011, 014, 007, 013 |
| `payerId` | member / non-member / missing | 201 / 400 PARTICIPANT_NOT_MEMBER / 400 | TC-007, 013, 012(n) |
| `exactAmounts` | sum = amount (incl. zero shares) / sum = amount ± 1 | 201 as entered / 400 SPLIT_SUM_MISMATCH | TC-009, 006, 010 |
| caller of write routes | logger / member non-logger / non-member / anonymous | 200 / 403 NOT_LOGGER / 404 / 401 | TC-015/018, 016/019, TC-GRP-021, TC-ACC-015 |
| edited field | description / payer (non-triggers) / amount / participants / splitType (triggers) | shares unchanged / shares recomputed | TC-015(a, e), TC-015(b–d, f) |

### Boundary value analysis
| Boundary | Values | Cases |
|---|---|---|
| `parseKurus` storage bound | 2147483647 (₺21,474,836.47) accepted · 2147483648 rejected | TC-002 |
| API `amountKurus` bound | 0 · 2147483647 · 2147483648 · −1 | TC-012(a–d) |
| description length | 0 (empty), 1, 200, 201, missing | TC-012(g–k) |
| participants count | 0 (rejected), 1 (valid, OQ-EXP-001), 3 (typical), 8 (scale ceiling — TC-GRP-024 exercises it) | TC-011, 014, 007, cross-ref GRP |
| equal-split remainder | r = 0 (divides evenly), r = 1, r = n−1 (amount < n: 2 among 3) | TC-005(a–d), 008 |
| ledger size | 50 (expected max) · 501 (cap + 1) | TC-024, 025 |

### Decision tables
**Create an expense** — one violated condition per case (combined-violation precedence is unspecified upstream and intentionally untested — §1):

| Condition violated | Outcome | Case |
|---|---|---|
| none | 201, shares computed and stored | TC-007/008/009 |
| DTO format (amount, description, splitType, payer missing/invalid) | 400 VALIDATION_FAILED (precedes service checks — API §4) | TC-012 |
| no participants | 400 NO_PARTICIPANTS | TC-011 |
| payer/participant not a member | 400 PARTICIPANT_NOT_MEMBER | TC-013 |
| exact amounts ≠ total | 400 SPLIT_SUM_MISMATCH | TC-010 |
| caller not a group member | 404 NOT_FOUND (existence hiding) | TC-GRP-021 |
| caller anonymous | 401 UNAUTHENTICATED | TC-ACC-015 |

**Edit an expense** — conditions: (caller is logger?) × (change valid?):

| Logger | Valid change | Outcome | Case |
|---|---|---|---|
| T | T | 200; recompute iff amount/participants/splitType changed; editedAt set | TC-015 |
| F | T | 403 NOT_LOGGER; unchanged | TC-016 |
| T | F | 400 (validation family); unchanged, no editedAt | TC-017 |
| F | F | 403 NOT_LOGGER (authorization precedes validation on the handler — guard order, arch. §8.1 layer 3; intentionally untested as a combined case, both are rejections) | not tested (§1) |

### State transition testing — Expense
States: `(none) → created → edited → deleted`.

| Transition / trigger | Legal? | Case |
|---|---|---|
| (none) → created (member, valid input) | ✓ | TC-007/008/009/014 |
| created → edited (logger, valid change) | ✓ | TC-015 |
| edited → edited (further edits) | ✓ | TC-015 (rows composable) |
| created/edit → deleted (logger) | ✓ | TC-018 (both an unedited and an edited expense) |
| created → edited by non-logger | illegal — 403 NOT_LOGGER | TC-016 |
| created → deleted by non-logger | illegal — 403 NOT_LOGGER | TC-019 |
| deleted → read/edit/delete by id | illegal — 404 NOT_FOUND | TC-018 (step 2) |
| any → carry a user-editable date | illegal by design — no date field exists in any DTO | Contract review (API §3b note) + TC-012/022 |

## 4. Coverage Matrix

| Requirement | Flows covered | Test Cases | Status |
|---|---|---|---|
| FR-EXP-001 | UC-EXP-001 main | TC-007, 008, 009, 014, 028 | Covered |
| FR-EXP-002 | UC-EXP-001 E3 | TC-002 (parse boundary), 012(a–f) | Covered |
| FR-EXP-003 | payer/participant membership | TC-013 | Covered |
| FR-EXP-004 | base share floor | TC-004, 005, 007, 008 | Covered |
| FR-EXP-005 | random-spread remainder | TC-004, 005, 008 | Covered |
| FR-EXP-006 | store + recompute-on-trigger-only | TC-007 (store), 015 (all trigger/non-trigger rows) | Covered |
| FR-EXP-007 | exact-sum acceptance/rejection | TC-006 (unit), 009, 010, 017 | Covered |
| FR-EXP-008 | UC-EXP-002 E2 | TC-016, 029 (UI affordance) | Covered |
| FR-EXP-009 | UC-EXP-003 E1 | TC-019, 030 (UI affordance) | Covered |
| FR-EXP-010 | auto timestamps, no date field | TC-007 (createdAt, editedAt absent), 015 (editedAt set), 012/022 (no date field) | Covered |
| FR-EXP-011 | UC-EXP-004 main + E1 | TC-021, 022, 031 (UI); E1 → TC-GRP-021 | Covered |
| FR-EXP-012 | UC-EXP-003 main | TC-018 (hard delete incl. shares) | Covered |
| UC-EXP-001 | main, A1, E1–E4 | TC-007/008/009 (main), TC-008 (A1), TC-010 (E1), TC-011 (E2), TC-012 (E3), TC-GRP-021 (E4); UI: TC-028 | Covered |
| UC-EXP-002 | main, E1, E2 | TC-015 (main), TC-017 (E1), TC-016 (E2); UI: TC-029 | Covered |
| UC-EXP-003 | main, E1 | TC-018 (main), TC-019 (E1); UI: TC-030 | Covered |
| UC-EXP-004 | main, E1 | TC-021, 022, 031; E1 → TC-GRP-021 | Covered |
| NFR-EXP-001 | ≤ 30 s logging + enablers | TC-028 | Covered |
| NFR-EXP-002 | ≤ 2 s expense pages | TC-032, 033 | Covered |
| NFR-EXP-003 | shares sum exactly (domain contribution); zero-sum after EXP ops | TC-004/006 (unit), 007–009 (stored), TC-023 (op matrix) | Covered |
| NFR-EXP-004 | 20–50 expenses scale; cap | TC-024 (50), 033 (50, e2e), 025 (501 cap) | Covered |
| NFR-EXP-005 | persist until deleted; hard delete only | TC-026, 018 | Covered |
| BR-EXP-001 | any member may log | TC-007 (alice logs), 009 (alice logs for payer bob); every member fixture | Covered |
| BR-EXP-002 | expense composition; payer independent of participants | TC-007, 013, 014 | Covered |
| BR-EXP-003 | exactly two split types | TC-012(l–m) (others rejected), 007/009 (both valid) | Covered |
| BR-EXP-004 | equal-split rule | TC-004, 005, 008 | Covered |
| BR-EXP-005 | draw once, stored; recompute only on trigger | TC-015 (a/e unchanged; b–d/f recomputed) | Covered |
| BR-EXP-006 | exact-sum validation | TC-006, 010, 017 | Covered |
| BR-EXP-007 | logger-only edit/delete | TC-016, 019, 029, 030 | Covered |
| BR-EXP-008 | auto timestamps, no user date | TC-007, 015, 022 + contract review (no DTO field) | Covered |
| BR-EXP-009 | member-only visibility | TC-GRP-021 (matrix), TC-ACC-018/025 | Covered (cross-domain) |
| BR-EXP-010 | non-negative, zero valid | TC-002, 012(a–b), 005(a) | Covered |
| BR-EXP-011 | delete removes expense + shares | TC-018 (DB-level hard delete) | Covered |
| ASM-001 | remainder properties | TC-004, 005, 008 | Covered |
| ASM-002 | kuruş parse/format boundary | TC-001, 002, 003 | Covered |
| SC-002 (split-engine half) | exact sum, distinct recipients, ≤ 1 extra kuruş | TC-004, 005 | Covered (suggestion-engine half → BAL plan) |
| SC-005 (expense parameters) | zero-sum after create/edit/delete | TC-023 (+ TC-BAL-016 for settle/undo) | Covered (jointly with BAL plan) |
| SC-003 / OBJ-003 | ≤ 30 s logging | TC-028 | Covered |
| API §3b error codes | `SPLIT_SUM_MISMATCH`, `NO_PARTICIPANTS`, `PARTICIPANT_NOT_MEMBER`, `LIST_TOO_LARGE`, `NOT_LOGGER` | TC-010, 011, 013, 025, 016/019 | Covered |
| API §1 CSRF (expense routes) | 403 on POST/PATCH/DELETE | TC-027 | Covered |
| Cross-domain promise (accounts-access plan) | FR-ACC-008 UI assertions (expense views) | TC-031 (+ 029/030 affordances) | Covered |
| — | Combined service-error precedence | — | Intentionally untested (§1) — unspecified upstream |
