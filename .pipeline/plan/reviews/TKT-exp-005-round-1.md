# Review Round 1 — PR #26 (TKT-exp-005: Expense UI — ledger list & add-expense form, the 30-second journey (e2e))

PR: https://github.com/sarperim/settleup/pull/26
Branch: `tkt-exp-005` → `dev` · Head at review: `f97c5df` · Base: `23134a3` (= `origin/dev` tip; merge-base verified — clean descendant)
Review date: 2026-09-29
Isolated checkout: `/tmp/opencode/worktrees/rl-tkt-exp-005` — branch `pr-26` at `f97c5df` (= PR head; tree clean at review start and at every gate). Scratch namespace `/tmp/opencode/review-exp-005/`. Per-lane databases: lead `settleup_e5r`, compliance `settleup_e5r_c`, code `settleup_e5r_k`, security `settleup_e5r_s`, e2e `settleup_e2e_e5r` (all provisioned + migrated). A concurrent review-lead owns PR #25 (TKT-exp-004) in `/tmp/opencode/worktrees/rl-tkt-exp-004` with its own `_e4r`/`review-exp-004` namespace — zero collisions; this loop never touched the main checkout or PR #25's worktree.

Scope context: the C1 expense UI per `.pipeline/plan/tickets/TKT-exp-005.md` — the group view **Expenses** tab (ledger: description, `formatKurus` amount, payer/participants by display name, timestamps, newest first) with the add-expense entry point; the **AddExpensePage** single-screen form (`/groups/:groupId/expenses/new`) defaulting participants to all members and payer to the acting user, EQUAL/EXACT toggle with per-participant inputs, client-side `parseKurus` validation with inline errors and no round-trips until submit, then navigation back to the ledger; a new typed `expensesApi` (create + list); and e2e TC-EXP-028 + TC-EXP-031. Parallel group **P-6** (with TKT-exp-004, PR #25 — write scopes verified disjoint).

## Blast radius gate (pass-1 dispatch decision)

**Classification: FULL — all three review lanes run.** Reasoning recorded:

- The diff ships **executable UI logic**: two page rewrites (`AddExpensePage.tsx` placeholder → stateful form with data fetching, validation and submission; `GroupViewPage.tsx` ledger tab with parallel fetch and render) and a new typed API service (`apps/web/src/api/expenses.ts`). Not presentation-only, not non-executable, not comment/formatting-only — every LOW condition fails.
- **Test files are touched** (a new web-unit mechanism spec and a new Playwright e2e spec).
- The ticket **pins automated acceptance TCs** (TC-EXP-028, TC-EXP-031, e2e) — the compliance lane must verify them.
- The new surfaces consume membership/expense data (display-name PII per FR-ACC-008; group-scoped financial data) — squarely in the security lane's remit even for a web-only diff.

## Scope fence (P-6 constraint) — verified held (lead + compliance lane, independently)

`git diff --name-status origin/dev...HEAD`: exactly 6 files, no renames, no mode changes (+744/−19):

| File | Change |
|---|---|
| `.pipeline/plan/tickets/TKT-exp-005.md` | status `todo`→`in-review (PR #26 → dev, 2026-09-29)` + Evidence line (the repo's sanctioned ticket-flip convention) |
| `apps/web/src/api/expenses.ts` | new — typed Expenses API service (`create` + `list`) over the shared client |
| `apps/web/src/api/expenses.spec.ts` | new — web-unit mechanism spec (request shaping) |
| `apps/web/src/pages/AddExpensePage.tsx` | placeholder → functional single-screen form |
| `apps/web/src/pages/GroupViewPage.tsx` | Expenses tab placeholder → ledger + add-expense entry point |
| `apps/web/test/e2e/expense-ui.spec.ts` | new — TC-EXP-028 + TC-EXP-031 |

**Zero changes** to `apps/api/**`, `packages/shared/src/**`, root `package.json`, `pnpm-lock.yaml` (verified by path-filtered diff; compliance re-verified independently). No new dependencies. The P-6 fence with PR #25 (TKT-exp-004, which writes `apps/api/src/ledger/**` + `apps/api/test/**` and must NOT touch `apps/web/**`) holds exactly — **zero path overlap**, so there is **no cross-PR conflict**.

## Reviewer verdicts (pass 1, dispatched in parallel)

| Lane | Model | Verdict | Blocking |
|------|-------|---------|----------|
| compliance | deepseek-v4.1-flash | **COMPLIANT** | 0 violations · 3 observations · 2 upstream routings |
| code | glm-5.3 | **APPROVE** | **0 blockers** · 1 should-fix · 2 nits · 4 observations |
| security | glm-5.3 | **APPROVE** | **0 critical/high/medium** · 1 low hardening note · 4 observations |

Lane reports preserved at `/tmp/opencode/review-exp-005/{compliance,code,security}-report.md`.

## Baseline gates (review-lead run, from scratch in the isolated worktree)

- `pnpm install` — exit 0. `pnpm --filter api exec prisma generate` — exit 0. `pnpm lint` — exit 0. `pnpm typecheck` — exit 0. `pnpm build` — exit 0 (logs `/tmp/opencode/review-exp-005/lead-{install,prisma-gen,lint,typecheck,build}.log`).
- `DATABASE_URL=postgresql://settleup:settleup@127.0.0.1:5432/settleup_e5r pnpm test` — **`Test Files 89 passed (89)`, `Tests 259 passed (259)`, exit 0** (179.9 s) — exactly the PR body's claim (baseline 88/257 + 1 file / +2 tests: the two `expensesApi` shape tests). Log `lead-test.log`.
- **Full e2e on a FRESH `settleup_e2e_e5r` (port 3030):** `E2E_DATABASE_URL=…/settleup_e2e_e5r PSQL=<real psql 17.11> E2E_PORT=3030 pnpm test:e2e` — exit 0: e2e-db create + migrations → `pnpm test:system` **1/1 passed** → Playwright chromium **14 passed** (12 pre-existing + **TC-EXP-028 9.9 s** + **TC-EXP-031 6.6 s**). Log `lead-e2e.log`.
- CI "Lint, test & build" on head `f97c5df`: **SUCCESS** (run [36541366735](https://github.com/sarperim/settleup/actions/runs/36541366735), lead-verified via `gh`). `gh pr checks 26` → `pass`.
- **README note:** the dispatch asked for an independent full-suite re-run; all of the above was run by the lead in this worktree on a real PostgreSQL 17. (Local node v22.22.0 vs root `engines >=24` prints a pnpm "Unsupported engine" WARN — pre-existing, CI uses node 24 and is green; not a finding.)

## Consolidated findings

IDs are lane-scoped. **No blocking findings at any tier.** Cross-lane overlaps: code C-2 ↔ security O-2 ↔ compliance OBS-1 (same AddExpensePage form-state surface); code O-2 ↔ security H-1 (same `as Kurus` cast).

| ID | Severity | Source | Location | Status | Summary |
|----|----------|--------|----------|--------|---------|
| C-1 | should-fix (non-blocking) | code | `expense-ui.spec.ts:160-167` + `playwright.config.ts` (no `timeout`) | open | TC-EXP-028's T4 retry-on-breach branch is **unreachable** under Playwright's default 30 s per-test timeout (no `test.setTimeout`): engaging the retry requires the first median-of-3 to exceed 30 s, by which point the test has been killed. No false-green path — a genuine SC-003 breach still fails (as a timeout, not a measured assertion), and the passing path is green with ~3× headroom (9.9 s locally). Fix: `test.setTimeout(120_000)` in TC-EXP-028. |
| C-2 | nit | code | `AddExpensePage.tsx:56-89` | open | The load effect resets `loading`/`loadError` and re-derives member defaults, but does not clear `description`/`amountText`/`splitType`/`exactTexts`/`errors`/`submitError` on a `groupId`-only route transition (the PR #17 K-2 defect class). **Unreachable today** (no add-expense→add-expense navigation ships; TKT-exp-006 edits a different route). Reset at effect start or key the route element on `groupId` before in-form navigation lands. Same surface as compliance OBS-1 / security O-2. |
| C-3 | nit | code | `expense-ui.spec.ts:33-47` vs `join-flow-ui.spec.ts:27-37` | open | `createGroupViaUi` duplicated verbatim (test-only DRY); the plan's exp-006 TCs declare "setup as TC-EXP-028", so the copy will multiply. Promote to `test/e2e/helpers/`. |
| C-O1…O-4 | observation | code | `GroupViewPage.tsx:85-89`, `:229`; `AddExpensePage.tsx:74`; `GroupViewPage.tsx:211-217` | open | (O-1) shared `Promise.all` couples detail+members+expenses to one failure gate (pre-existing pattern, no TC distinguishes per-tab); (O-2) `as Kurus` cast (novel in `apps/web`; only way to render DTO money without re-validating; throws only on contract-excluded values); (O-3) payer fallback `fetched[0]?.id ?? ''` + `payerId === ''` branch is dead defense; (O-4) add-expense link renders outside the loading/error gate (graceful). |
| H-1 | low / hardening note (non-blocking) | security | `GroupViewPage.tsx:224` | open | `formatKurus(expense.amountKurus as Kurus)` throws `RangeError` on out-of-domain input; the cast disables the type check, so a contract-violating payload would crash the group-view render with no error boundary. **No plausible exploit path** (server-generated `Int`, validated on write, not client-injectable). Follow-up: defensive render or route-level error boundary. Same cast as code O-2. |
| S-O2…O-5 | observation | security | `AddExpensePage.tsx`; `expense-ui.spec.ts:211-213`; ledger render; form validation | open | (O-2) own typed free-text persists across a `groupId` change — no privilege boundary crossed; (O-3) TC-EXP-031's whole-body check lacks the `@` catch-all the ledger check has (test-strength nit); (O-4) full ledger with no pagination is a pre-existing API decision; (O-5) client validation duplicates server rules (correct pattern, no client-trust assumption). |
| OBS-1 | observation (non-blocking) | compliance | `AddExpensePage.tsx:56-89` | open | Same form-state-reset item as code C-2 (recorded from the traceability lane as well). |
| OBS-2 | observation (non-blocking) | compliance | ticket Evidence line vs `lead-e2e.log` | open | Ticket quotes TC-EXP-028 6.0 s / TC-EXP-031 3.6 s; the lead's fresh-DB run measured 9.9 s / 6.6 s. Expected runner variance, both far inside the 30 s gate. No action. |
| OBS-3 | observation (non-blocking) | compliance | ticket file diff | open | The ticket-record change is Status **+ Evidence** (not the Status line alone, as the dispatch phrased it) — matches the repo's sanctioned convention (cf. `TKT-exp-003.md`). No action. |

**Upstream routings (planning / test-plan suggestions, not PR violations):**

- **R-1 → test-planner:** TC-EXP-031's expected result cites the literal `yara@test.local` / `zane@test.local`, but the sanctioned e2e identity convention (`helpers/auth.ts`, TKT-accounts-005 C-4) namespaces emails to `yara-e2e@test.local`. The spec correctly asserts the actual emails (plus an `@` catch-all); the plan wording should point at `e2eIdentity` output.
- **R-2 → planner/test-planner:** TC-EXP-028's "single screen (no wizard steps)" is asserted as simultaneous visibility of all fields rather than an explicit absence-of-wizard-step check — faithful in substance; could be pinned literally if desired.

## Deviation adjudications (the coder's three flagged items) — all three lanes agree

- **A-1 (the form is reached in 1 interaction because the default group tab is `expenses`) — faithful.** The base `origin/dev:GroupViewPage.tsx:44` already initialised `activeTab` to `'expenses'` and this diff leaves it as the initial/reset tab; the `add-expense-link` renders in that default tab, so the click is genuinely one interaction. TC-EXP-028's clause is "≤ 2 interactions from the group page" and does not pin the default tab — the assertion `toBeLessThanOrEqual(2)` is the plan's own bound, neither weakened nor reinterpreted.
- **A-2 (`expensesApi.detail` deliberately omitted) — correct non-gold-plating.** `TKT-exp-006.md` owns the edit form (prefilled from the detail) and the edit/delete TCs (029/030/032/033); 03 §6 pins no expense-detail SPA route and the ledger renders inline, so a `detail` method would be unused here.
- **A-3 (`expenses.spec.ts` mechanism spec) — sanctioned, not scope creep.** Inside the declared `apps/web/src/**` fence, in the pre-existing `web-unit` vitest project (`vitest.config.ts:80-81`, added by PR #15 / F-A4: "apps/web/src mechanism specs"), mirroring `client.spec.ts`/`groups.spec.ts`; pins §3b request shaping only while behavior stays with the e2e TCs. Same adjudication as PR #17 C-4 / PR #21.

## Prior-review UI-pattern routings — checked where they apply

- **Load-failure vs success-empty** (`TKT-groups-004-round-1.md` K-1/S-1; `TKT-groups-006-round-1.md` C-3/OBS-2): the group view's Expenses tab nests the empty/list state inside `error === null`, and `AddExpensePage` renders its form only when `loadError === null` (alert above). **Heeded on both new surfaces.**
- **State reset on route-param change** (`TKT-groups-004` K-2/S-1; `TKT-groups-006` C-1/C-5): `GroupViewPage` resets `group`/`members`/`expenses`/`error`/`loading`/`activeTab`/`requests` at effect start — **heeded**. `AddExpensePage` resets `loading`/`loadError` and re-derives member defaults but does not clear the user's own typed text (code C-2 / OBS-1 / S-O2) — latent-only, recorded for the next owner.

## Mergeability (pass 1)

Open blocking findings (compliance violation / code-review blocker / critical-high security): **ZERO.**

- Compliance: **compliant** — zero violations; both routings are planning/test-plan items, not PR violations.
- Code: zero findings at the blocker tier (1 should-fix, 2 nits); the lane's verdict is a straight **approve** and states C-1 does not gate merge (no false-green path; green with ~3× headroom).
- Security: zero findings at every severity above low (1 hardening note with no plausible exploit path, 4 observations).

**RESULT: MERGEABLE on pass 1 — the loop ends early on a clean pass. No fixer dispatch** (nothing blocking to fix; the open items are non-blocking quality findings, hardening notes, observations, and upstream routings, and the loop's fixed sequence ends on a clean pass). The user (merge authority) may merge as-is, waive specific findings, or route the should-fix/nit items to a pre-merge fixer pass or a follow-up ticket.

## Loop status

- Pass 1 (this round): all three lanes dispatched in parallel, zero open blocking findings → **MERGEABLE**. Loop ends early; passes 2–3 and both fix rounds unused.
- User action requested: merge PR #26. After merge confirmation, the ticket's status moves to `done` and the board can be regenerated.
- Open non-blocking items for the next owner (user's call): **C-1** (one-line `test.setTimeout` so the T4 retry is reachable — most valuable, small), C-2 / OBS-1 / S-O2 (form-state reset before in-form navigation lands), C-3 (promote the e2e helper), H-1 (defensive ledger money render), C-O1…O-4 / S-O3…O-5 / OBS-2 / OBS-3 (observations — no action required). Routings: **R-1**, **R-2** → test-planner/planner (plan-entry wording).

Ticket status remains `in-review` — the merge decision and the `done` transition belong to the user. This artifact is committed to the PR branch (gitignored `reviews/` dir force-added per the established pattern) so the review history lands in `dev` with the merge; the PR head moves forward by this docs-only commit and CI re-runs on it (expected green — touches only `.pipeline/plan/`).

## Evidence index

- Lead logs: `/tmp/opencode/review-exp-005/lead-{install,prisma-gen,lint,typecheck,build,test,e2e}.log`, `migrate-*.log`
- Lane reports: `/tmp/opencode/review-exp-005/{compliance,code,security}-report.md`
- Lane dispatch briefs: `/tmp/opencode/review-exp-005/brief-{compliance,code,security}.md` (+ `brief-code2.md`, redispatch after a first code-lane API timeout)
- Prior round routings checked: `.pipeline/plan/reviews/TKT-groups-004-round-1.md`, `.pipeline/plan/reviews/TKT-groups-006-round-1.md`
