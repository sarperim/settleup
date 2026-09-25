# Test Strategy — Settle Up

Status: **approved at Gate 1** (2026-09-25) · Date: 2026-09-25
Inputs: `.pipeline/00-project-brief.md` · `.pipeline/analysis/00-domain-map.md` + 4 domain reports · `.pipeline/architecture/01-system-architecture.md`, `02-data-model.md`, `03-api-design.md`, `04-ci-pipeline.md`.

This document is the top level of the test contract. Domain test plans (`.pipeline/testing/<domain>.md`) and the coverage matrix (`99-coverage-matrix.md`) sit beneath it and inherit every rule stated here. The coder agent implements against those plans; **tests are the definition of done**. Once approved, test cases may not be weakened to make implementation pass — only the user can change a test case.

---

## 1. Verification objectives — what "done" has to prove

| Success criterion | Verification approach | Level |
|---|---|---|
| SC-001 (group adopts app) | Real-world adoption outcome — **not automatable**. The E2E lifecycle smoke proves the technical path it depends on (per `04-ci-pipeline.md` §8). | e2e (path only) |
| SC-002 (min-transaction suggestions + remainder properties) | Unit property/edge-case suites for the split engine (C4) and suggestion engine (C5): exact sum, distinct remainder recipients, ≤ 1 extra kuruş each, circular debts, single debtor/creditor, zero-balance members, minimality. | unit |
| SC-003 (log an expense ≤ 30 s) | E2E: automated add-expense journey timed end-to-end, plus deterministic assertions of the enablers (single screen, ≤ 2 interactions to reach form, participants default to all members, payer defaults to acting user, no round-trips before submit). | e2e |
| SC-004 (pages ≤ 2 s) | E2E page-load timing on the built app (localhost stands in for "a normal connection" — documented interpretation). | e2e |
| SC-005 (zero-sum after every op) | Integration suite asserting `sumKurus === 0` from `GET /api/groups/:id/balances` after **every** create / edit / delete / settle / undo. | integration |
| SC-006 (non-member denied) | Integration authorization matrix: every group-scoped route × {anonymous, registered non-member} → 401 / 404 with no data disclosure. | integration |
| SC-007 (full lifecycle) | Playwright journey: register → create group → join via code + approval → log expense → mark paid (by payer or recipient) → undo → outstanding again. | e2e |

## 2. Test levels

The deployable artifact is a single origin (SPA served by the API), so the "system" and "e2e" levels coincide; this plan uses **e2e** for the full-artifact level.

| Level | Target (per architecture §2) | Boundary exercised | Runner |
|---|---|---|---|
| **unit** | `packages/shared` (parseKurus/formatKurus, limits), C4 split engine, C5 suggestion engine — pure functions with injected RNG (arch. §3 rule 3) | Function contracts: kuruş parsing/formatting, ASM-001 split properties, min-transaction search, determinism | Vitest, no DB, no HTTP |
| **integration** | The NestJS application (C2/C3/C4/C5) in-process, driven over HTTP, against a **real PostgreSQL** with real Prisma migrations, real guards, real Argon2id | API contract of `03-api-design.md`: success shapes, every error code, session cookie semantics, persistence, transactions, SC-005 zero-sum, SC-006 authorization | Vitest + supertest + PostgreSQL |
| **e2e** | Production build: SPA + API + PostgreSQL, real browser, same origin | User journeys through the UI, SPA routing, UI defaults (NFR-EXP-001), timings (SC-003/SC-004), SC-007 lifecycle | Playwright |

Unit tests must run without `DATABASE_URL`; integration tests require it. Both run under `pnpm test` (CI step 3). E2E runs under `pnpm test:e2e` against `E2E_DATABASE_URL` on the built app (CI step 4). All per the root-script contract in `04-ci-pipeline.md` §3.

## 3. Test tooling

**Fixed by the approved architecture — not re-opened here:** Vitest (unit + integration), Playwright (e2e), PostgreSQL 17 service container in CI, pnpm workspace script contract, integer-kuruş money discipline via `packages/shared`.

**Open sub-decisions (options + recommendation; user decides — see §10):**

| # | Concern | Option A | Option B | Recommendation |
|---|---|---|---|---|
| T1 | Property-based testing (SC-002, ASM-001, NFR-BAL-002/003) | **fast-check** — seeded generators, automatic shrinking, reproducible failure output | Hand-rolled seeded random loops — zero dependencies, but no shrinking and weaker failure reports | **A (fast-check)** — one small dev dependency, materially better failure diagnosis for the correctness-critical engines |
| T2 | Integration HTTP driver | **supertest** against the in-process Nest app — fast, precise cookie control, no port management | Raw `fetch` against a booted server — one step closer to the socket, but slower and needs lifecycle management | **A (supertest)** — socket realism is already covered by the e2e level |
| T3 | Integration DB isolation | **Truncate-all-tables before each test** — order-independent, matches "facts only" model | Per-test transaction rollback — faster, but mark-paid validates *inside* the request's own DB transaction (API §3.4); nested-transaction interplay is a correctness risk | **A (truncate)** — determinism over speed at this scale |
| T4 | Timing assertions (SC-003/SC-004) | **Median of 3 measurements, 1 retry on breach; hard gate only on the SC budgets (30 s / 2 s)**; sub-budgets (API p95 ≤ 300 ms, submit ≤ 500 ms, suggestion ≤ 50 ms) are measured, logged, and enforced with a generous CI bound (3× budget) | Strict single-shot assertions on every budget | **A** — CI runner variance makes single-shot timing gates flaky; medians + the documented bounds keep them meaningful |
| T5 | RNG determinism | **Unit: inject a seeded deterministic PRNG as the CSPRNG source** (architecture already mandates injectability). Integration/e2e: real CSPRNG, assert structural properties only (sum, distinctness, ≤ 1 extra) — never the specific draw | Fake RNG at all levels | **A** — integration tests must not depend on which participant wins a draw; only unit tests pin exact draws |
| T6 | Clock | **No clock injection.** Timestamps (`createdAt`, `editedAt`, `paidAt`, `undoneAt`) asserted for presence, ordering, and DB consistency — never exact wall-clock values. The 30-day sliding session expiry is verified structurally (session row with `expiresAt ≈ +30 d`; logout deletes the row); the wall-clock rollover itself is **not automated** — flagged limitation | Require an injectable clock throughout the app | **A** — an injectable clock is implementation burden for one expiry edge; not worth it for this MVP |

## 4. Test doubles policy

The system has **no volatile externals** (no email, no payment providers, no third parties — brief §6). The doubles policy therefore reduces to randomness and time:

- **Mocked/stubbed (exhaustive list):**
  - The CSPRNG source in **split-engine unit tests only** — replaced by a seeded deterministic PRNG (T5). This is the one sanctioned double.
  - Nothing else. If a test author believes another double is needed, that is a plan defect — raise it, don't mock.
- **Always real:** PostgreSQL (every level above unit), Prisma + migrations, NestJS guards (`AuthGuard`, `GroupMemberGuard`, `GroupCreatorGuard`), the split and suggestion engines (in integration/e2e), Argon2id hashing (real parameters, real verification), session cookies.
- **Rationale:** the default rule (mock volatile externals, test your own logic for real) degenerates here to "everything real except the coin flips," and the coin flips are only mocked where exact outcomes are the point (unit).

## 5. Test data strategy

- **Fixture identities are fixed and deterministic** (e.g., `alice@test.local`, `bob@test.local`, group "Trip", "Dinner Club"). Integration tests run against a truncated DB; the e2e database is recreated per run — fixed identities are therefore reproducible everywhere. No generated-random identities.
- **Factories (test helpers the coder provides, part of the test suite):**
  - `registerUser(email, password, displayName)` → drives `POST /api/auth/register`, returns `{ id, email, cookie }`.
  - `createGroup(creatorCookie, name)` → returns group with `joinCode`.
  - `joinAndApprove(creatorCookie, joinerCookie, code)` → pending → approved member.
  - `createExpense(memberCookie, groupId, expenseInput)` → `POST .../expenses`.
- **Write paths are exercised through the API.** Direct Prisma seeding is permitted **only** for read-path fixtures (balances/suggestion views over pre-existing facts) and for scale fixtures (e.g., 50 or 501 expenses); seeded facts must satisfy the domain invariants (shares sum exactly to the expense amount) — fixture validity is itself asserted.
- **Property-test generators (fast-check, seeded):** kuruş amounts (0 … 2,147,483,647), participant sets (1–8 members), balance vectors summing to 0, split-type pairs. Every failure must be reproducible from its seed.
- **E2E scenario data** is created through the UI (register, create group, join), never seeded behind the API, so the journey is the test.

## 6. Environments and NFR verification

| Environment | What runs there |
|---|---|
| Local dev (docker Postgres or CI-parity) | All suites; developer runs `pnpm test`, `pnpm test:e2e` |
| CI (GitHub Actions, Postgres 17 service container — `04-ci-pipeline.md`) | Step 3: unit + integration. Step 4: build + Playwright e2e incl. timing assertions. Suites are wired to the root scripts exactly per CI §3 |
| Production (owner VPS) | **Not tested by this plan.** Deployment, backups, and the owner password-reset runbook are operational procedures (arch. §10) |

**NFR → verification map (all 20 NFRs; details in domain plans):**

| NFR | Verification method | Level |
|---|---|---|
| NFR-ACC-001 (non-recoverable passwords) | Unit: produced hash decodes to Argon2id with m=19456, t=2, p=1. Integration: stored `passwordHash` is Argon2id-encoded (never plaintext); submitted password never appears in captured log output. Login throttle per the amended contract (TC-ACC-031/032/033) | unit + integration |
| NFR-ACC-002 (near-free, unattended) | Deployment-design property (single container, compose restart policies) — **not automated**; verified by architecture review | n/a (review) |
| NFR-ACC-003 (≤ 2 s auth pages) | E2E timing on /login, /register, /change-password (T4 policy) | e2e |
| NFR-ACC-004 (account retention) | Contract review: no account-deletion route exists in the API design. Integration: accounts and their data persist across every exercised operation | review + integration |
| NFR-ACC-005 (scale, no ops) | Functional coverage at full scale (8 users, 5 groups) in integration fixtures; no dedicated load test — load is trivial by construction | integration |
| NFR-GRP-001 (deny by default) | Authorization matrix: all 12 group-scoped routes × {anonymous → 401, non-member → 404}, response body identical to the nonexistent-group body (SC-006) | integration |
| NFR-GRP-002 (group data retention) | Contract review: no delete/archive endpoints. Integration: groups/memberships/join requests persist through every exercised operation | review + integration |
| NFR-GRP-003 (≤ 2 s group pages) | E2E timing (group list, group view, join handling) | e2e |
| NFR-GRP-004 (≤ 5 groups × ≤ 8 members) | Functional multi-group tests (user in ≥ 2 groups; group with 8 members) | integration |
| NFR-GRP-005 (join-code secrecy) | Unit: generator emits 8-char Crockford-base32, unique across a large seeded sample, constructed from the injected CSPRNG. (Entropy itself is by construction — CSPRNG — and is not separately testable) | unit |
| NFR-EXP-001 (≤ 30 s logging) | E2E: timed add-expense journey + deterministic enabler assertions (single screen, ≤ 2 interactions, participants default = all members, payer default = acting user, client-side validation) | e2e |
| NFR-EXP-002 (≤ 2 s expense pages) | E2E timing | e2e |
| NFR-EXP-003 (zero-sum contribution) | Unit property: engine outputs sum exactly to the amount. Integration: stored shares sum to the amount after create and after every edit variant | unit + integration |
| NFR-EXP-004 (20–50 expenses scale) | Integration: 50-expense ledger correctness (full list, newest first). E2E: 50-expense list within the page budget. Defensive cap: 501 expenses → `500 LIST_TOO_LARGE` | integration + e2e |
| NFR-EXP-005 (persist until deleted) | Integration: expenses persist; delete is a hard delete (row + shares gone) | integration |
| NFR-BAL-001 (zero-sum after every op) | The SC-005 suite: `sumKurus === 0` asserted after create / edit / delete / settle / undo — parameterized over the operation matrix | integration |
| NFR-BAL-002 (engine edge cases) | Unit suite: circular debts, single debtor/creditor, zero-balance members excluded, remainder properties, sub-lira (0.01) suggestions | unit |
| NFR-BAL-003 (exact search acceptable) | Unit: minimality verified against an exhaustive brute-force reference on seeded random balance vectors (≤ 8 nonzero); identical balances → identical plan (determinism) | unit |
| NFR-BAL-004 (≤ 2 s pages, ≤ 50 ms computation) | E2E timing for pages; engine benchmark at max group size (8 members) with the T4 tolerance policy | e2e + unit |
| NFR-BAL-005 (settled rows retained) | Integration: undo sets `status=UNDONE, undoneAt` — row retained, excluded from balances, visible in the settle-up view's settled list with `undoneAt` | integration |

**Security checks live in the integration suite** (no separate environment at this scale): Argon2id parameters, cookie flags (`HttpOnly`, `Secure`, `SameSite=Lax`), CSRF header enforcement (`403 CSRF_HEADER_MISSING` on every POST/PATCH/DELETE — parameterized across all state-changing routes), login-throttle behavior (pending G-1), existence-hiding 404 parity, login non-enumeration parity (nonexistent email vs wrong password → identical response), no email in group-scoped payloads (FR-ACC-008), no password in logs.

## 7. Determinism rules (binding on all domain plans)

1. Same input → same verdict, every run. No test depends on wall-clock time beyond the T4 timing policy; no test depends on execution order.
2. Every randomized test runs from a fixed seed; a failure is reproducible from the reported seed.
3. Integration tests truncate all tables before each test — no cross-test data coupling.
4. E2E tests wait only on observable UI state (selectors, network idle) — never fixed `sleep`s.
5. Expected values come only from the brief, domain analyses, and architecture contracts — never from the implementation under test.
6. Tests exercise the interfaces the architecture defines (HTTP API, SPA, pure engine functions) and must survive an internal refactor.

## 8. Suite layout and CI wiring

```
packages/shared/test/unit/*.spec.ts          # parseKurus/formatKurus — no DB
apps/api/test/unit/*.spec.ts                 # split engine, suggestion engine, join-code generator, hash params
apps/api/test/integration/*.spec.ts          # API contract, auth, groups, expenses, balances/settlements, security — needs DATABASE_URL
apps/web/test/e2e/*.spec.ts                  # Playwright — boots built app against E2E_DATABASE_URL
```

`pnpm test` = unit + integration (CI step 3). `pnpm test:e2e` = Playwright (CI step 4). No new CI steps are introduced; this plan only fills the suites the existing pipeline executes.

## 9. Known gaps and flagged items carried into the plans

| # | Item | Handling |
|---|---|---|
| G-1 | **Login-throttle response contract was unspecified** — arch. §7/§8.2 added throttling (10 fails / (email, IP) / 15 min, in-memory) but `03-api-design.md` §4 defined no status/error code for a throttled attempt | **Resolved 2026-09-25** — architect amendment landed (user-directed subagent): `429 TOO_MANY_ATTEMPTS`, standard envelope, no `Retry-After`; fixed 15-min window anchored at the first counted failure; correct credentials blocked while throttled; successful login resets the pair; login endpoint only; DTO validation precedes the throttle check. Covered by TC-ACC-031/032/033; only the wall-clock window expiry stays untested (G-6) |
| G-2 | `SUGGESTION_STALE` 409 path — explicitly flagged for test-planner (API §3.4) | Will be a TC in the balances-settlement plan |
| G-3 | Outstanding suggestions are derived output, not stored state (data-model §5.2, D-ARCH-004) | All suggestion tests assert through the API (`GET .../settlements`, mark-paid), never against stored plan rows |
| G-4 | Owner password-reset CLI script (`set-password.js`, UC-ACC-005) — architecture flagged for confirmation that a repo CLI counts as "outside the application" | **Resolved at Gate 1: include the system test** (§10). TC lives in the accounts-access plan |
| G-5 | Defensive paths: expense-list cap (500 → `LIST_TOO_LARGE`); suggestion-engine greedy fallback above 12 nonzero balances | Engine/route-level TCs included — they are part of the API/engine contract |
| G-6 | 30-day sliding session expiry — wall-clock rollover not automated (T6) | Structural assertions only; flagged as an accepted limitation |
| G-7 | SC-001 is an adoption outcome, not a system behavior | Verified outside the test suite (real usage); e2e proves the path |
| G-8 | SC-003's "≤ 30 s" is human-paced; automation cannot prove a human's speed | E2E asserts the automated journey stays inside 30 s (generous bound — if automation needs more, something is broken) plus the deterministic enablers |

## 10. Gate 1 decisions (recorded 2026-09-25)

- **Q1 — Tooling T1–T6:** approved as recommended — fast-check, supertest, truncate-per-test isolation, median-of-3 timing with hard gates only on SC budgets, seeded PRNG at unit level only, no clock injection.
- **Q2 — Login-throttle contract gap (G-1):** **option (a) approved** — the missing throttle error contract is an upstream defect and goes back to the architect, who must amend `03-api-design.md` §4 (proposed: `429 TOO_MANY_ATTEMPTS`). **Amendment landed 2026-09-25** (user-directed architect subagent): 429 `TOO_MANY_ATTEMPTS` with deterministic semantics (fixed window, correct-credentials blocked, reset-on-success, login-only scope). TC-ACC-031/032/033 added to the accounts-access plan.
- **Q3 — Owner password-reset CLI (G-4):** approved — include one system-level TC running the built `set-password.js` against the test DB (UC-ACC-005's only automatable surface). It runs in the e2e phase (post-build) per §8.
- **Q4:** no further adjustments requested.

## 11. Gate 2 plan (domain order)

All four domains are **Must** (domain map), so the order follows dependency: **Accounts & Access → Groups & Membership → Expense Tracking → Balances & Settlement**, each written to `.pipeline/testing/<domain>.md` using the standard template, each followed by a separate approval stop. Cross-domain e2e cases (SC-007 lifecycle, timings) live in the domain that owns the final assertion (Balances & Settlement), with secondary traces to the contributing UCs. TC IDs are `TC-ACC-xxx`, `TC-GRP-xxx`, `TC-EXP-xxx`, `TC-BAL-xxx` — permanent once assigned; removed cases leave gaps; new cases take the next free number.
