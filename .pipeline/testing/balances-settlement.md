# Balances & Settlement Test Plan

Status: **approved at Gate 2** (2026-09-25) · Date: 2026-09-25
Domain report: `.pipeline/analysis/balances-settlement.md` · Architecture: `01-system-architecture.md` (C5, §5.2, §5.3, §8.1), `02-data-model.md` (settled_payments, §5.2, §7), `03-api-design.md` (§1, §3c, §3.4, §4) · Inherits every rule of `.pipeline/testing/00-test-strategy.md` (approved at Gate 1).

**Conventions for all integration cases below** (from the strategy, identical to the previous plans): every state-changing HTTP call carries `X-Requested-With: XMLHttpRequest`; in-process supertest against a real PostgreSQL; truncated tables per test; `COOKIE_SECURE=true`; fixed identities (`alice@test.local` creator, `bob@test.local` / `carol@test.local` members, `dave@test.local` registered non-member; passwords `password-1`, …). **Determinism of values (strategy T5):** where balance or suggestion **values** are asserted, fixtures use **exact splits or evenly dividing equal splits** (deterministic); random remainder draws are asserted structurally only. **Derived-state rule (strategy G-3):** all integration assertions about outstanding suggestions go through `GET …/settlements` and mark-paid — never against stored plan rows (there are none; D-ARCH-004). **E2e conventions:** per-run recreated database; every e2e case self-contained with its own unique fixed identities through the UI.

**Standing value fixture** (used by TC-BAL-006…015, deterministic): alice logs an expense of 9000 kuruş (₺90.00), payer alice, EXACT split `{alice: 3000, bob: 3000, carol: 3000}` → balances: **alice +6000, bob −3000, carol −3000**, `sumKurus = 0`; outstanding plan: **bob → alice 3000, carol → alice 3000** (2 payments — the minimum for one creditor and two debtors; each debtor pays exactly their debt, so the plan is fully deterministic).

## 1. Scope

**Covered here:** FR-BAL-001…010 · UC-BAL-001 (main, E1), UC-BAL-002 (main, A1, E1), UC-BAL-003 (main, E1), UC-BAL-004 (main, E1) · NFR-BAL-001…005 · BR-BAL-001…011 · the suggestion-engine half of SC-002 (minimality vs brute-force reference, determinism, edge cases, greedy fallback — strategy G-5) · the settle/undo parameters of the SC-005 zero-sum suite (completing the operation matrix started by TC-EXP-023) · the `SUGGESTION_STALE` consistency rule (strategy G-2, API §3.4) · cross-group balance isolation · CSRF on the two settlement state-changing routes · **SC-007 full-lifecycle e2e** (cross-domain journey owned here per strategy §11) · balance/settle-up page timings (NFR-BAL-004 page half; the ≤ 50 ms compute half is unit-level).

**Deliberately NOT tested here, and why:**

| Exclusion | Reason |
|---|---|
| Non-member access to balance/settlement routes (UC-BAL-001/002 E1) | Owned by the SC-006 authorization matrix — **TC-GRP-021** covers `GET …/balances`, `GET …/settlements`, `POST …/settlements`, `POST …/settlements/:id/undo` with existence-hiding parity; anonymous is TC-ACC-015. Cross-referenced, not duplicated |
| Zero-sum after expense create/edit/delete (SC-005's other half) | Owned by **TC-EXP-023** (operation matrix, expense parameters); this plan's TC-BAL-016 completes the matrix with settle/undo — together the full SC-005 suite |
| Money movement / payment-provider integration (BR-BAL-010) | Feature intentionally absent (brief §6) — no endpoint exists; contract review only |
| Split-engine remainder properties (SC-002's other half) | Owned by the Expense Tracking plan (TC-EXP-004/005/008) — cross-referenced |
| Exact wall-clock values of `paidAt` / `undoneAt` | Strategy T6 — no clock injection; asserted for presence, ordering, and DB consistency only |
| Mark-paid request naming a non-member as payer/recipient beyond the no-match rule | Follows deterministically from the exact-match rule (no live suggestion can name a non-member) — covered as one row of TC-BAL-012; no separate contract exists |
| Re-request of a settlement "identity" across plan regenerations | Meaningless by design (G-3/D-ARCH-004): outstanding suggestions are derived output with no stable identity — only exact (payer, recipient, amount) matching against the **current** plan is contractual |

## 2. Test Cases

### TC-BAL-001 — Suggestion minimality vs an exhaustive brute-force reference (seeded property test)
- Traces to: SC-002, OBJ-002, FR-BAL-004, BR-BAL-004, NFR-BAL-002/003, R-BAL-002, arch. §5.3
- Level: unit (suggestion engine — pure function, no DB)
- Preconditions: fast-check with a fixed seed; generator produces zero-sum balance vectors with 2–8 nonzero integer entries (creditor amounts random, negated total distributed among debtors, each nonzero); a **reference exhaustive search** is implemented in the test (breadth-first search over payment assignments — the minimum number of transfers that zeroes the vector, unbounded time, small n)
- Steps: for each generated vector: run the engine; run the reference; apply the engine's plan to the vector
- Expected result (every generated case):
  1. applying the engine's plan zeroes every balance (plan correctness)
  2. the plan's length **equals** the reference's minimum length (minimality — OBJ-002)
  3. every payment is between a debtor and a creditor (no sign-violating payment) and no amount is 0
- Note: failures reproducible from the reported seed (strategy §7 rule 2); the reference is slow by design — permitted by NFR-BAL-003 (exact search acceptable at ≤ 8 members)

### TC-BAL-002 — Suggestion determinism and input-order independence
- Traces to: FR-BAL-004 context, arch. §5.3 ("identical balances always produce the identical plan"), BR-BAL-008 context (mark-this-suggestion-paid must be well-defined)
- Level: unit
- Preconditions: a fixed balance vector (e.g., alice +5000, bob −2000, carol −3000)
- Steps:
  1. Run the engine on the vector; run it again
  2. Run it on the same balances presented in a different insertion order (shuffled map construction)
- Expected result: all three runs return the **identical** plan (deep equality) — stable member-id iteration makes the plan a pure function of the balances, so "mark this suggestion paid" is well-defined across reads

### TC-BAL-003 — Suggestion edge cases (SC-002 named list)
- Traces to: SC-002, NFR-BAL-002, FR-BAL-005, BR-BAL-005, BR-BAL-011, UC-BAL-002 (A1 context)
- Level: unit
- Preconditions: none
- Steps and expected results:
  | Case | Balances | Expected plan |
  |---|---|---|
  | a — all zero | {} (or all-zero members) | empty — nothing is owed (UC-BAL-002 A1) |
  | b — single debtor/creditor | A +1000, B −1000 | exactly 1 payment: B → A 1000 |
  | c — two debtors, one creditor | A +1000, B −600, C −400 | 2 payments; B → A 600 and C → A 400 (minimum; exact debts) |
  | d — zero-balance member excluded | A +1000, B −1000, D 0 | D appears in no payment (BR-BAL-005) |
  | e — sub-lira | A +1, B −1 | 1 payment of 1 kuruş (₺0.01) — no rounding, ever (BR-BAL-011) |
  | f — circular gross debt nets to zero | gross A→B 500, B→C 500, C→A 500 (net balances all 0) | empty — the engine works on net positions and must not emit payments for gross cycles |
  | g — creditor who is also a debtor in gross terms | A +300, B −500, C +200 | 2 payments (minimum): B pays A 300 and C 200 (order per member-id stability; amounts deterministic) |

### TC-BAL-004 — Greedy fallback above 12 nonzero balances (defensive path, strategy G-5)
- Traces to: arch. §5.3 (defensive fallback), §9 flag 2, NFR-BAL-003 context
- Level: unit
- Preconditions: a zero-sum vector with **13** nonzero balances (6 creditors, 7 debtors)
- Steps: run the engine; apply the plan; run it again
- Expected result: the plan **zeroes every balance** (correctness preserved); its length is **not** asserted (the fallback may be non-minimal — that is its documented contract); the two runs return identical output (still deterministic); never expected to trigger at brief §7 scale (≤ 8 members) — this is the documented degradation path

### TC-BAL-005 — Suggestion-engine computation budget at maximum group size
- Traces to: NFR-BAL-004 (compute half), arch. §7 (≤ 50 ms at max expected group size)
- Level: unit
- Preconditions: adversarial 8-member balance vectors (large prime-ish amounts forcing deep DFS search, e.g., {+999983, +998321, …} zero-sum); a fixed set of such vectors
- Steps: for each vector, run the engine 5 times; record durations
- Expected result: median duration per vector ≤ **50 ms**; per strategy T4 the sub-budget is measured and logged, CI-enforced at **3× (150 ms)** — no hard gate on the sub-budget (only SC budgets are hard-gated)

### TC-BAL-006 — Balances view: per-member values and zero-sum (UC-BAL-001 main)
- Traces to: FR-BAL-001, FR-BAL-002, FR-BAL-003 (read side), UC-BAL-001 (main), BR-BAL-001/002/003, SC-005 context, API §3c (balances shape)
- Level: integration
- Preconditions: standing value fixture (alice +6000, bob −3000, carol −3000)
- Steps: `GET /api/groups/:groupId/balances` as bob (any member)
- Expected result: `200`; body `{ balances: [...], sumKurus: 0 }`; exactly 3 entries — `member` exposes `{ id, displayName }` (no email — cross-ref TC-ACC-018); `balanceKurus` = +6000 (alice), −3000 (bob), −3000 (carol) — matching BR-BAL-002: payer amount minus own share (9000 − 3000 for alice); `sumKurus` is exactly `0` (the response carries the sum for the UI/tests — API §3c)

### TC-BAL-007 — Settle-up view: outstanding plan and (initially empty) settled list (UC-BAL-002 main)
- Traces to: FR-BAL-004, FR-BAL-005, FR-BAL-010 (read side), UC-BAL-002 (main), BR-BAL-004/005/009, API §3c (settlements shape)
- Level: integration
- Preconditions: standing value fixture
- Steps: `GET /api/groups/:groupId/settlements` as carol
- Expected result: `200`; `outstanding` = exactly 2 entries — `{ payer: bob, recipient: alice, amountKurus: 3000 }` and `{ payer: carol, recipient: alice, amountKurus: 3000 }` (deterministic: one creditor, exact debts — the minimum-transaction plan); `settled` = `[]`; payer/recipient references expose `{ id, displayName }`; no zero-balance member appears (none exists yet here — see TC-BAL-018 for the structural case)

### TC-BAL-008 — All-zero group shows nothing owed (UC-BAL-002 A1)
- Traces to: UC-BAL-002 (A1), FR-BAL-005, BR-BAL-005
- Level: integration
- Preconditions: two groups — (a) a group with no expenses at all; (b) a group whose single expense nets everyone to zero (payer alice, exact split `{alice: 5000}` — single participant)
- Steps: `GET …/settlements` and `GET …/balances` for both groups, as a member
- Expected result: both groups → `outstanding: []` (nothing is owed — A1); all `balanceKurus` = 0; `sumKurus = 0`. A group whose balances are all zero is indistinguishable in output shape from an empty one

### TC-BAL-009 — Mark a suggested payment as paid, by its payer (UC-BAL-003 main)
- Traces to: FR-BAL-006 (payer side), FR-BAL-007, UC-BAL-003 (main), BR-BAL-006/007, API §3.4
- Level: integration
- Preconditions: standing value fixture; the current plan is {bob→alice 3000, carol→alice 3000}
- Steps:
  1. `POST /api/groups/:groupId/settlements` as **bob** (the payment's payer): `{ payerId: <bob>, recipientId: <alice>, amountKurus: 3000 }`
  2. `GET …/balances` and `GET …/settlements` as alice
- Expected result:
  1. `201`; body `{ settlement }` with `status = "SETTLED"`, `paidAt` present, `amountKurus: 3000`
  2. balances: alice +3000, bob 0, carol −3000 — the payer's balance rose and the recipient's fell by exactly the amount (BR-BAL-002 settled-payment terms); `sumKurus = 0`; `outstanding` regenerated: exactly `{carol→alice 3000}` (the settled suggestion is gone — BR-BAL-008); `settled` contains exactly the new payment `{payer: bob, recipient: alice, amountKurus: 3000, paidAt}`

### TC-BAL-010 — Mark a suggested payment as paid, by its recipient (either party)
- Traces to: FR-BAL-006 (recipient side), BR-BAL-006, UC-BAL-003 (main, actor variant)
- Level: integration
- Preconditions: standing value fixture (fresh)
- Steps: `POST …/settlements` as **alice** (the recipient of the bob→alice suggestion): `{ payerId: <bob>, recipientId: <alice>, amountKurus: 3000 }`
- Expected result: `201` `SETTLED` — the recipient may mark it paid just as the payer may (BR-BAL-006: either party); balances and views shift exactly as in TC-BAL-009

### TC-BAL-011 — Mark paid by a member who is neither payer nor recipient is denied (UC-BAL-003 E1)
- Traces to: FR-BAL-006 (deny side), UC-BAL-003 (E1), API §4 (`NOT_PAYMENT_PARTY`)
- Level: integration
- Preconditions: standing value fixture; the suggestion {bob→alice 3000} is live
- Steps:
  1. `POST …/settlements` as carol (a member, not a party): `{ payerId: <bob>, recipientId: <alice>, amountKurus: 3000 }`
  2. `GET …/settlements` as alice
- Expected result:
  1. `403`, code `NOT_PAYMENT_PARTY`
  2. no settlement was created — `settled` is still empty, `outstanding` unchanged

### TC-BAL-012 — Mark paid with no matching live suggestion → SUGGESTION_STALE (strategy G-2)
- Traces to: API §3.4 (mark-paid consistency rule), G-2, BR-BAL-008, FR-BAL-007 context, UC-BAL-003 (error side)
- Level: integration
- Preconditions: standing value fixture (fresh per row); the live plan is {bob→alice 3000, carol→alice 3000}
- Steps (rows a–c from the fresh fixture; row d after settling both suggestions as in TC-BAL-009/010):
  1. Row a — amount off by one: `{ payerId: bob, recipientId: alice, amountKurus: 3001 }` as bob
  2. Row b — wrong direction / wrong parties: `{ payerId: alice, recipientId: bob, amountKurus: 3000 }` as alice; and `{ payerId: bob, recipientId: carol, amountKurus: 3000 }` as bob
  3. Row c — concurrent plan change: as bob, settle {bob→alice 3000} (201); then submit the **same triple again** (`{bob→alice 3000}` as bob) — it was in the plan when the client read it, but bob's balance is now 0
  4. Row d — nothing outstanding: with all balances zero, submit any well-formed triple as a member party to it
- Expected result: every row → `409`, code `SUGGESTION_STALE`; no settlement row is created in any row (balances and `settled` unchanged after the failed calls). Row c is the §3.4 scenario: the plan is validated **as of the request's transaction** — a stale client plan is rejected, never double-applied

### TC-BAL-013 — Undo a settled payment, by either party (UC-BAL-004 main)
- Traces to: FR-BAL-008, FR-BAL-009, UC-BAL-004 (main), BR-BAL-006/008, NFR-BAL-005, API §3c (undo row)
- Level: integration
- Preconditions: standing value fixture; {bob→alice 3000} was settled (by bob — TC-BAL-009 state): balances alice +3000, bob 0, carol −3000
- Steps:
  1. `POST /api/groups/:groupId/settlements/:settlementId/undo` as **alice** (the recipient)
  2. `GET …/balances` and `GET …/settlements` as alice
  3. Repeat the precondition on a fresh fixture and undo as **bob** (the payer)
- Expected result:
  1. `200`; body `{ settlement }` with `status = "UNDONE"`, `undoneAt` present, `paidAt` unchanged
  2. balances revert to alice +6000, bob −3000, carol −3000 (the undone payment is excluded from computation — BR-BAL-002 counts `SETTLED` only); `sumKurus = 0`; `outstanding` regenerates and again contains `{bob→alice 3000}` (behaviorally identical to "returned to outstanding" — UC-BAL-004 postcondition); `settled` still lists the payment **with `undoneAt` set** (row retained, distinguished — NFR-BAL-005)
  3. same outcomes when the payer undoes it (either party — BR-BAL-006)

### TC-BAL-014 — Undo by a member who is neither payer nor recipient is denied (UC-BAL-004 E1)
- Traces to: FR-BAL-008 (deny side), UC-BAL-004 (E1), API §4 (`NOT_PAYMENT_PARTY`)
- Level: integration
- Preconditions: a settled payment exists (bob→alice)
- Steps: `POST …/settlements/:settlementId/undo` as carol; then `GET …/settlements` as alice
- Expected result: `403`, code `NOT_PAYMENT_PARTY`; the settlement remains `SETTLED` (no `undoneAt`) and balances are unchanged

### TC-BAL-015 — Undoing an already-undone settlement is rejected
- Traces to: API §4 (`ALREADY_UNDONE`), data-model §5.2, UC-BAL-004 (error side)
- Level: integration
- Preconditions: a payment was settled and then undone once (TC-BAL-013 state)
- Steps:
  1. `POST …/settlements/:settlementId/undo` again (as either party)
  2. Read the `settled_payments` row directly
- Expected result:
  1. `409`, code `ALREADY_UNDONE`
  2. the row is unchanged — still `UNDONE` with exactly one `undoneAt` (no timestamp overwrite); no second undo effect on balances

### TC-BAL-016 — Zero-sum holds after settle and undo (SC-005, settlement parameters)
- Traces to: SC-005, NFR-BAL-001, OBJ-004, FR-BAL-003, BR-BAL-003, UC-BAL-003/004 postconditions
- Level: integration
- Preconditions: standing value fixture; after each operation below, `GET …/balances` is called and `sumKurus === 0` asserted
- Steps (settlement half of the SC-005 operation matrix; the expense half is TC-EXP-023 — together they are the full matrix: create / edit / delete / settle / undo):
  1. settle one suggestion (by payer)
  2. settle the remaining suggestion (by recipient)
  3. undo the first settlement
  4. undo the second settlement
- Expected result: `sumKurus === 0` after **every** step — exact integer 0 through the full settle→settle→undo→undo sequence, whatever the intermediate balance values

### TC-BAL-017 — Balances never mix across groups (cross-group isolation)
- Traces to: BR-BAL-001, FR-BAL-002 (never combining), UC-BAL-001 context
- Level: integration
- Preconditions: alice and bob are members of groups A **and** B (factories); an expense exists only in A (alice payer, exact split `{alice: 2000, bob: 2000}`, amount 4000)
- Steps:
  1. `GET /api/groups/B/balances` as alice
  2. Settle the outstanding suggestion in A (alice↔bob); then `GET /api/groups/B/balances` again
- Expected result:
  1. B's balances are all 0 with `sumKurus = 0` — A's expense does not leak into B
  2. B's balances remain all 0 after A's settlement — settled payments are group-scoped too (`settled_payments.groupId` filter, data-model §7); A's balances changed, B's did not

### TC-BAL-018 — Structural suggestion properties at the API level (random remainder included)
- Traces to: FR-BAL-004/005, BR-BAL-004/005/008, strategy T5 (structural assertions at integration level)
- Level: integration
- Preconditions: a fixture with a **random remainder** (uneven equal split — e.g., alice pays 10000 EQUAL over alice+bob+carol → balances sum to 0 with random ±1 kuruş spread) plus a fourth member at exactly 0 balance (non-participant)
- Steps:
  1. `GET …/settlements` twice as a member
  2. Apply the returned `outstanding` to the balances from `GET …/balances` (test-side computation)
- Expected result:
  1. the two reads return **identical** `outstanding` (deterministic engine — same balances, same plan)
  2. applying the plan zeroes every balance; the zero-balance member appears in no suggestion (BR-BAL-005); the plan has at most (members − 1) payments; no payment amount is 0 or negative; the specific plan **content** is not asserted where the remainder draw makes member balances shift between runs — only these structural properties (T5)

### TC-BAL-019 — Settled rows are retained forever (NFR-BAL-005)
- Traces to: NFR-BAL-005, BR-BAL-007/008, data-model §5.2 (rows are facts), brief §5 (groups persist indefinitely)
- Level: integration
- Preconditions: run the sequence: settle two suggestions → undo one → settle a regenerated suggestion → undo it again (all through the API)
- Steps: read the `settled_payments` table directly (documented data model)
- Expected result: exactly the rows created by the sequence exist — nothing was ever deleted or rewritten (statuses `SETTLED`/`UNDONE` as decided; `undoneAt` set only on undone rows); settled facts are permanent, changed only by manual undo (OQ-BAL-001 decided). There is no delete/purge endpoint for settlements — contract review (`03-api-design.md` defines none)

### TC-BAL-020 — CSRF header required on the settlement state-changing routes
- Traces to: API §1 (CSRF), arch. §8.2
- Level: integration
- Preconditions: standing value fixture; a live suggestion and a settled payment exist
- Steps: call `POST …/settlements` (valid triple) and `POST …/settlements/:settlementId/undo` — each **without** `X-Requested-With`, as a party
- Expected result: each → `403`, code `CSRF_HEADER_MISSING`; no side effect — no settlement created, the existing one remains `SETTLED`

### TC-BAL-021 — Balances view through the UI
- Traces to: UC-BAL-001 (main, UI), FR-BAL-001/010 (UI), OBJ-004
- Level: e2e
- Preconditions: self-contained — register `dana@test.local` + `emre@test.local` via UI; dana creates a group; emre joins via approval; dana logs an expense of 90.00 paid by dana, exact split {dana: 30.00, emre: 60.00} via the UI form; browser authenticated as emre
- Steps: open the group's balances tab
- Expected result: both members' balances are shown (dana +60.00, emre −60.00) with display names; the displayed balances visibly sum to zero (₺0.00 total / equal positive and negative)

### TC-BAL-022 — Settle-up view through the UI, incl. the sub-lira suggestion
- Traces to: UC-BAL-002 (main, UI), FR-BAL-004/005 (UI), BR-BAL-011, OBJ-002
- Level: e2e
- Preconditions: self-contained — register `ferit@test.local` + `gokce@test.local` via UI; ferit creates a group; gokce joins; ferit logs an expense of **0.01** (₺0.01) paid by ferit with exact split `{ferit: 0.00, gokce: 0.01}` (deterministic — no random draw)
- Steps: open the group's settle-up tab as gokce
- Expected result: exactly one outstanding suggestion is rendered: "Gökçe pays Ferit ₺0.01" (display names; the sub-lira amount is shown exactly, not rounded — BR-BAL-011); the settled list is empty

### TC-BAL-023 — Mark a payment as paid through the UI
- Traces to: UC-BAL-003 (main, UI), FR-BAL-006/007 (UI), BR-BAL-007
- Level: e2e
- Preconditions: self-contained — setup as TC-BAL-021 (identities `hale@test.local` + `ilhan@test.local`; ilhan owes hale 60.00 after an exact-split expense)
- Steps: as ilhan (the payer), open the settle-up view; mark the suggested payment paid
- Expected result: the suggestion disappears from outstanding; the settled list shows it; the balances view now shows 0.00 for both members (nothing owed)

### TC-BAL-024 — Undo a settlement through the UI
- Traces to: UC-BAL-004 (main, UI), FR-BAL-008/009 (UI), BR-BAL-008
- Level: e2e
- Preconditions: setup as TC-BAL-023 completed (identities `jale@test.local` + `kaan@test.local`; the payment is settled)
- Steps: as kaan (either party), undo the settled payment from the settle-up view
- Expected result: the payment returns to **outstanding** (the equivalent suggestion is rendered again); balances revert to the pre-settlement values; the settled list retains the entry marked undone

### TC-BAL-025 — SC-007: full lifecycle end-to-end (cross-domain journey, CI step-4 smoke)
- Traces to: SC-007, SC-001 (path), OBJ-001 · secondary traces: UC-ACC-001 (register), UC-GRP-001 (create), UC-GRP-002 (join by code), UC-GRP-003 (approve), UC-EXP-001 (log expense), UC-BAL-002 (view suggestions), UC-BAL-003 (mark paid), UC-BAL-004 (undo)
- Level: e2e
- Preconditions: fresh e2e database; two fresh browser contexts; no other e2e case's data
- Steps (all through the UI):
  1. Context 1: register `lale@test.local`; create group "Trip"
  2. Context 2: register `mert@test.local`; join "Trip" via the join code; context 1 approves
  3. Context 1 (lale): log an expense — description "Dinner", amount 100.00, payer lale, participants both, equal split (even division → deterministic 50.00/50.00)
  4. Context 1: open the settle-up view; mark the suggested payment (mert → lale 50.00) as paid (by its recipient)
  5. Context 2 (mert): undo the settlement
  6. Context 2: open the settle-up view
- Expected result:
  4. after mark-paid: balances show 0.00 for both; the settled list contains the payment
  5. after undo: the balances revert (lale +50.00, mert −50.00); the payment is listed as undone
  6. the outstanding suggestion (mert → lale 50.00) is rendered again — **the debt is outstanding again** (SC-007's terminal assertion). The full chain register → group → join+approval → expense → settle → undo → outstanding works against the production build (per `04-ci-pipeline.md` step 4)

### TC-BAL-026 — Balance and settle-up pages meet the page-load budget
- Traces to: NFR-BAL-004 (page half), SC-004, OBJ-003
- Level: e2e
- Preconditions: app built and served; self-contained — setup as TC-BAL-021 (identity `nadia@test.local`, one group with an expense and one outstanding suggestion); browser authenticated
- Steps: load the group's balances tab and settle-up tab; measure per the T4 policy (median of 3, one retry on breach)
- Expected result: each page's median load time ≤ **2.0 s**

## 3. Test Design — Systematic Case Selection

### Equivalence partitioning
| Input | Partitions | Class behavior | Cases |
|---|---|---|---|
| Balance vector (engine input) | all-zero / one debtor + one creditor / multiple debtors + one creditor / mixed multi-creditor / > 12 nonzero | empty plan / 1 payment / n-debtor payments / minimal plan (reference-checked) / greedy fallback | TC-003(a–c, g), TC-001, TC-004 |
| Mark-paid caller | the payment's payer / its recipient / another member / non-member / anonymous | 201 / 201 / 403 / 404 / 401 | TC-009, 010, 011, TC-GRP-021, TC-ACC-015 |
| Mark-paid triple vs current plan | exact match / amount off / parties wrong or swapped / was-in-plan-but-now-stale / nothing outstanding | 201 / 409 / 409 / 409 / 409 (all SUGGESTION_STALE) | TC-009, TC-012(a–d) |
| Undo caller | payer / recipient / another member | 200 / 200 / 403 | TC-013, TC-014 |
| Settlement status (undo target) | SETTLED / UNDONE | 200 + effect / 409 ALREADY_UNDONE | TC-013, TC-015 |
| Group's balance state | all zero / some nonzero | empty outstanding / suggestions present | TC-008, TC-007 |
| Member's balance | positive / negative / zero | appears as recipient / payer / absent | TC-006/007, TC-018 |

### Boundary value analysis
| Boundary | Values | Cases |
|---|---|---|
| Suggestion amount | 1 kuruş (₺0.01 — smallest possible) | TC-003(e), TC-022 |
| Nonzero balances for exact search | 8 (max expected, NFR-BAL-003) · 13 (fallback trigger + 1) | TC-005, TC-001, TC-004 |
| Plan length | 0 (all-zero) · 1 (single pair) · members − 1 (upper bound) | TC-003(a–b), TC-018 |
| Settlement count per group | 0 · 1 · several settled+undone mixed | TC-007, TC-009, TC-019 |

### Decision tables
**Mark paid** — conditions: (caller is a party?) × (triple matches the current plan?):

| Party | Matches plan | Outcome | Case |
|---|---|---|---|
| T | T (exact) | 201 SETTLED; balances shift; plan regenerates | TC-009/010 |
| T | F (any mismatch — amount, parties, staleness, nothing outstanding) | 409 SUGGESTION_STALE; no row | TC-012(a–d) |
| F | T | 403 NOT_PAYMENT_PARTY; no row | TC-011 |
| F | F | 403 (authorization precedes plan matching — guard/handler order, arch. §8.1; intentionally untested as a combined case) | not tested (§1 note) |

**Undo** — conditions: (caller is a party?) × (status):

| Party | Status | Outcome | Case |
|---|---|---|---|
| T | SETTLED | 200 UNDONE + undoneAt; balances revert; plan regenerates | TC-013 |
| T | UNDONE | 409 ALREADY_UNDONE; unchanged | TC-015 |
| F | SETTLED | 403 NOT_PAYMENT_PARTY; unchanged | TC-014 |
| F | UNDONE | 403 (same authorization layer) | not tested separately (same guard) |

### State transition testing — SettledPayment (per row) and the derived plan
**SettledPayment** (stored fact): `(none) → SETTLED → UNDONE`.

| Transition / trigger | Legal? | Case |
|---|---|---|
| (none) → SETTLED (mark paid by a party, exact plan match) | ✓ | TC-009, 010 |
| SETTLED → UNDONE (undo by a party) | ✓ | TC-013 |
| UNDONE → SETTLED (re-settle the same payment id) | illegal — no endpoint semantics; a new settlement of the regenerated suggestion creates a **new** row | TC-012(c) (the stale triple is rejected; the fresh suggestion settles as a new fact) |
| UNDONE → UNDONE (double undo) | illegal — 409 ALREADY_UNDONE | TC-015 |
| SETTLED/UNDONE → deleted | illegal by design — rows retained forever | TC-019 (retention) |

**Outstanding plan** (derived state, D-ARCH-004 — no stored transitions; regeneration triggers):

| Trigger | Plan behavior | Case |
|---|---|---|
| balances change (expense create/edit/delete) | recomputed on next read | TC-EXP-023 fixtures + TC-018 |
| a suggestion is settled | that payment leaves the plan; the rest regenerate | TC-009 (step 2) |
| a settlement is undone | the equivalent payment re-enters the plan | TC-013 (step 2) |
| no change | identical plan on repeated reads (determinism) | TC-002, TC-018 |

## 4. Coverage Matrix

| Requirement | Flows covered | Test Cases | Status |
|---|---|---|---|
| FR-BAL-001 | UC-BAL-001 main | TC-006, 021 | Covered |
| FR-BAL-002 | group-only computation; never cross-group | TC-006 (values), 017 (isolation) | Covered |
| FR-BAL-003 | zero-sum after every op (full matrix) | TC-016 (+ TC-EXP-023 — joint SC-005 suite) | Covered |
| FR-BAL-004 | minimum-transaction plan | TC-001 (reference-checked), 007, 003 | Covered |
| FR-BAL-005 | zero-balance exclusion | TC-003(d), 018 | Covered |
| FR-BAL-006 | party-only mark/undo | TC-009/010 (allowed), 011/014 (denied) | Covered |
| FR-BAL-007 | settled enters computation | TC-009 (balance shift), 013 (revert on undo) | Covered |
| FR-BAL-008 | party-only undo | TC-013, 014 | Covered |
| FR-BAL-009 | undo excludes + regenerates | TC-013, 024 | Covered |
| FR-BAL-010 | members-only views | TC-006/007 (member reads); non-member → TC-GRP-021 | Covered (cross-domain) |
| UC-BAL-001 | main, E1 | TC-006, 021; E1 → TC-GRP-021 | Covered |
| UC-BAL-002 | main, A1, E1 | TC-007, 022 (main); TC-008 (A1); E1 → TC-GRP-021 | Covered |
| UC-BAL-003 | main, E1 | TC-009/010/023 (main); TC-011 (E1) | Covered |
| UC-BAL-004 | main, E1 | TC-013/024 (main); TC-014 (E1) | Covered |
| NFR-BAL-001 | zero-sum verified after every operation | TC-016 + TC-EXP-023 (the SC-005 suite) | Covered |
| NFR-BAL-002 | edge cases: circular, single debtor/creditor, zero-balance, remainder, sub-lira | TC-003 (engine), TC-018 (API); remainder properties → TC-EXP-004/005/008 | Covered |
| NFR-BAL-003 | exact search, ≤ 8 members | TC-001 (reference equality at ≤ 8 nonzero) | Covered |
| NFR-BAL-004 | ≤ 2 s pages · ≤ 50 ms compute | TC-026 (pages), TC-005 (compute, T4 3× CI bound) | Covered |
| NFR-BAL-005 | settled rows retained | TC-019, 013 (undoneAt visible), 015 (row unchanged) | Covered |
| BR-BAL-001 | no cross-group netting | TC-017 | Covered |
| BR-BAL-002 | balance formula incl. settled terms | TC-006 (expense terms), 009/013 (settled ± terms, revert) | Covered |
| BR-BAL-003 | zero-sum invariant | TC-016 (+ TC-EXP-023) | Covered |
| BR-BAL-004 | min-transaction suggestions | TC-001, 007 | Covered |
| BR-BAL-005 | zero-balance excluded | TC-003(d), 018 | Covered |
| BR-BAL-006 | outstanding ↔ settled by parties only | TC-009/010/013, 011/014 | Covered |
| BR-BAL-007 | settled are facts in computation | TC-009, 019 | Covered |
| BR-BAL-008 | plan regenerates; facts never auto-modified | TC-009/013 (regeneration), 019 (facts untouched) | Covered |
| BR-BAL-009 | member-only visibility | TC-GRP-021 (matrix), TC-ACC-018/025 | Covered (cross-domain) |
| BR-BAL-010 | no money movement | — | Not automated — feature absent by design (contract review, §1) |
| BR-BAL-011 | kuruş-exact suggestions, sub-lira | TC-003(e), 022 | Covered |
| SC-002 (suggestion half) | minimality, edge cases, determinism | TC-001, 002, 003 (+ split half → TC-EXP-004/005/008) | Covered |
| SC-005 (full matrix) | create/edit/delete/settle/undo | TC-016 + TC-EXP-023 | Covered |
| SC-007 / SC-001 path | full lifecycle e2e | TC-025 | Covered |
| Strategy G-2 | `SUGGESTION_STALE` 409 path | TC-012 (incl. the concurrent-staleness scenario) | Covered |
| Strategy G-3 | suggestions asserted as derived output, via API only | TC-007…018 (all read through `GET …/settlements`; no stored-plan assertions) | Covered (by design) |
| Strategy G-5 | greedy fallback > 12 nonzero | TC-004 | Covered |
| API §3c/§3.4 | `NOT_PAYMENT_PARTY`, `SUGGESTION_STALE`, `ALREADY_UNDONE`; in-transaction plan validation | TC-011/014, 012, 015 | Covered |
| API §1 CSRF (settlement routes) | 403 on POST settlements / undo | TC-020 | Covered |
| — | Combined party+mismatch precedence on mark-paid/undo | — | Intentionally untested (§1 note) — authorization layer precedes; both outcomes are rejections |
