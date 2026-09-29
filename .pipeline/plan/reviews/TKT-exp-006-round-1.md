# Review Round 1 — PR #27 (TKT-exp-006: Expense UI — edit & delete (logger-only), page timing, 50-expense page (e2e))

PR: https://github.com/sarperim/settleup/pull/27
Branch: `tkt-exp-006` → `dev` · Head at review: `4f05e39` · Base: `dev` tip `5236987` (verified clean descendant)
Review date: 2026-09-29
Isolated checkout: `/tmp/opencode/worktrees/rl-tkt-exp-006` — branch `pr-27` at `4f05e39` (= PR head; tree clean at review start and at every gate). Scratch namespace `/tmp/opencode/review-exp-006/`. Databases: lead `settleup_e6r` (integration), e2e `settleup_e2e_e6r` (both created fresh, port 5436). Never touched the main checkout or another session's worktree.

> **Note on lane dispatch.** This environment exposes no subagent/Task dispatch tool, so the three lanes were conducted **in-process by the review lead** rather than as separate dispatched reviewers. Each lane's method, evidence and findings are recorded separately below; the consolidation, blocking classification and mergeability rules are unchanged.

Scope context: per `.pipeline/plan/tickets/TKT-exp-006.md` — the **EditExpensePage** single-screen form (`/groups/:groupId/expenses/:expenseId/edit`, prefilled from the expense detail), the **GroupViewPage** logger-only Edit link + Delete button, the typed `expensesApi.detail/update/remove`, and e2e **TC-EXP-029 / TC-EXP-030 / TC-EXP-032 / TC-EXP-033**. Parallel group **P-7** (with TKT-bal-001/002 — disjoint: this PR writes `apps/web/**` only).

## Blast radius gate (pass-1 dispatch decision)

**Classification: FULL — all three lanes run.** Reasoning recorded:

- The diff ships **executable UI logic**: `EditExpensePage.tsx` placeholder → 366-line stateful form (data fetch, prefill, validation, `PATCH` submission); `GroupViewPage.tsx` gains delete state + logger-gated affordances; `expensesApi` gains three real methods. Not presentation-only, not non-executable, not comment/formatting-only — every LOW condition fails.
- **Test files are touched** (a new e2e spec, a refactored pre-existing e2e spec, and new e2e helpers).
- The ticket **pins automated acceptance TCs** (TC-EXP-029/030/032/033, e2e) — the compliance lane must verify them.
- New surfaces consume group-scoped financial data and membership display names — squarely in the security lane's remit even for a web-only diff.

## Scope fence (P-7 constraint) — verified held

`git diff --name-status dev...HEAD`: exactly 10 files, no renames, no mode changes (+860/−90):

| File | Change |
|---|---|
| `.pipeline/plan/tickets/TKT-exp-006.md` | status `todo`→`in-review (PR #27 → dev, 2026-09-29)` + Evidence line (sanctioned ticket-flip convention) |
| `apps/web/src/api/expenses.ts` | +`detail`/`update`/`remove` over the shared client |
| `apps/web/src/api/expenses.spec.ts` | +3 web-unit mechanism tests (request shaping) |
| `apps/web/src/pages/EditExpensePage.tsx` | placeholder → functional single-screen edit form |
| `apps/web/src/pages/GroupViewPage.tsx` | ledger gains logger-only Edit/Delete affordances |
| `apps/web/test/e2e/expense-edit-ui.spec.ts` | new — TC-EXP-029/030/032/033 |
| `apps/web/test/e2e/expense-ui.spec.ts` | refactored onto the promoted helpers |
| `apps/web/test/e2e/helpers/group-setup.ts` | new — promoted `createGroupViaUi`/`requestToJoin`/`addApprovedMember` |
| `apps/web/test/e2e/helpers/seed.ts` | new — direct-Prisma scale-fixture seeding |
| `apps/web/test/e2e/join-flow-ui.spec.ts` | refactored onto the promoted helpers |

**Zero changes** to `apps/api/**`, `packages/shared/src/**`, root `package.json`, `pnpm-lock.yaml` (path-filtered diff re-verified). No new dependencies; `pnpm install --frozen-lockfile` exited 0 with the lockfile unchanged. The P-7 fence holds exactly.

## Reviewer verdicts (pass 1)

| Lane | Verdict | Blocking |
|------|---------|----------|
| compliance | **COMPLIANT** | 0 violations · 2 observations · 1 upstream routing |
| code | **APPROVE** | **0 blockers** · 1 nit · observations |
| security | **APPROVE** | **0 critical/high/medium** · 1 low hardening note · observations |

## Baseline gates (review-lead run, from scratch in the isolated worktree)

- `pnpm install --frozen-lockfile` — exit 0. `pnpm --filter api exec prisma generate` — exit 0 (resolved `@prisma/client` from `node_modules/.pnpm`, confirming the seed helper's `createRequire` path). `pnpm lint` — exit 0. `pnpm typecheck` — exit 0. `pnpm build` — exit 0. Logs `/tmp/opencode/review-exp-006/lead-{install,prisma-gen,lint,typecheck,build}.log`.
- Fresh `settleup_e6r`: `prisma migrate deploy` exit 0; `DATABASE_URL=…/settleup_e6r pnpm test` — **`Test Files 97 passed (97)`, `Tests 275 passed (275)`, exit 0** (92.6 s) — exactly the ticket's claim. Log `lead-test.log`.
- Fresh `settleup_e2e_e6r` (port 3036, real psql 17.11 via `PSQL`): `E2E_DATABASE_URL=… PSQL=… pnpm test:e2e` — exit 0: e2e-db create + migrate → `pnpm test:system` **1 file / 1 test passed** → Playwright chromium **18 passed** (14 pre-existing + **TC-EXP-029 4.8 s + TC-EXP-030 3.9 s + TC-EXP-032 2.0 s + TC-EXP-033 4.1 s**). Log `lead-e2e.log`.
- CI "Lint, test & build" on head `4f05e39`: **SUCCESS** (run [36550069351](https://github.com/sarperim/settleup/actions/runs/36550069351)). `gh pr checks 27` → `pass`.
- Local node v22.22.0 vs root `engines >=24` prints a pnpm "Unsupported engine" WARN — pre-existing, CI uses node 24 and is green; not a finding.

## Consolidated findings

IDs are lane-scoped. **No blocking findings at any tier.**

| ID | Severity | Source | Location | Status | Summary |
|----|----------|--------|----------|--------|---------|
| C-1 | nit (test) | code | `helpers/group-setup.ts:44-52` vs old `expense-ui.spec.ts` copy | open | The promoted `addApprovedMember` asserts `join-group-name` **`toBeVisible()`**, whereas the original `expense-ui.spec.ts` copy asserted **`toHaveText('Trip')`**. Net effect: expense-ui's join-step text assertion was relaxed (the join-flow copy already used `toBeVisible`, and its TC-GRP-027 separately asserts the text). No acceptance assertion depends on it, but the PR body's "no assertion in either spec's tested behavior changed" is not strictly accurate. Refactor is otherwise faithfully behavior-preserving (identical flow, same pass). |
| C-2 | observation | code | `EditExpensePage.tsx:182-188` | open | Every save sends the full field set (description/amount/payer/participants/splitType) rather than only changed fields. Harmless against the partial `PATCH` contract (server recomputes shares iff amount/participants/splitType changed and preserves them otherwise); no defect. |
| C-3 | observation | code | `EditExpensePage.tsx:78-81`; `GroupViewPage.tsx:94-98` | open | `Promise.all` couples members+expense (and group+members+expenses) to one failure gate — the pre-existing pattern; no TC distinguishes per-panel failure. |
| C-4 | observation | code | `expense-edit-ui.spec.ts:56-66` | open | TC-EXP-029 asserts 3 of 5 prefilled fields (description/amount/payer); participants, splitType and EXACT share prefill are not asserted. TC-EXP-029 does not require it; coverage could be tightened. |
| C-5 | nit | code | `EditExpensePage.tsx:88,97`; `GroupViewPage.tsx:261` | open | `formatKurus(… as Kurus)` casts recur (same surface as exp-005 H-1/O-2). Only way to render DTO money without re-validating; throws only on contract-excluded values. |
| H-1 | low / hardening note (non-blocking) | security | `EditExpensePage.tsx`/`GroupViewPage.tsx` money casts | open | A contract-violating payload would crash the render with no error boundary; no plausible exploit path (server-generated `Int`, validated on write). Same note as exp-005 H-1. |
| S-1 | observation | security | `GroupViewPage.tsx:275-294` | open | Logger-only gating is a UI boundary only; the API's `ExpenseLoggerGuard` returns `403 NOT_LOGGER` for hand-typed URLs (verified in the merged exp-004 controller/guard). Correct defence-in-depth. |
| S-2 | observation | security | `helpers/seed.ts` | open | Direct-Prisma access is test-only, bound to `E2E_DATABASE_URL` (fallback `DATABASE_URL`), never shipped in the SPA bundle. Acceptable per strategy §5. |
| S-3 | observation | security | `expenses.spec.ts:106-137` | open | CSRF header pinned on PATCH/DELETE and absent on GET; no email leakage (display-name-only rendering verified by TC-EXP-031). |
| OBS-1 | observation (non-blocking) | compliance | ticket Evidence vs `lead-e2e.log` | open | Ticket quotes TC-EXP-029/030/032/033 as 5.2/4.3/2.3/4.1 s; the lead's fresh-DB run measured 4.8/3.9/2.0/4.1 s. Expected runner variance, both far inside the 2.0 s gate where relevant. No action. |
| OBS-2 | observation (non-blocking) | compliance | PR body deviation bullets | open | Same item as code C-1: the "no assertion changed" claim is slightly overstated. Doc-level only. |

**Upstream routing (planning / test-plan, not a PR violation):**

- **R-1 → test-planner:** TC-EXP-029/030/032/033 preconditions cite the literal `uma@test.local` / `vic@test.local` / `wren@…` / etc., but the sanctioned e2e convention (`helpers/auth.ts`, TKT-accounts-005 C-4) namespaces emails to `<base>-e2e@test.local`. The specs correctly use `e2eIdentity`; the plan wording should point at `e2eIdentity` output. Same as exp-005 R-1.

## Deviation adjudications (the coder's four flagged items)

- **D-1 (`expensesApi.detail` + `update`/`remove`) — faithful.** `detail` was explicitly deferred to TKT-exp-006 by the exp-005 review **A-2** ("TKT-exp-006 owns the edit form (prefilled from the detail)"), and 03-api-design.md §3b pins `GET …/expenses/:expenseId`. `update`/`remove` back the edit form and the ledger delete respectively. All three are inside the declared `apps/web/src/**` fence, typed against the shared DTOs, and covered by the sanctioned web-unit mechanism spec. **Matches A-2.**
- **D-2 (helper promotion + `join-flow-ui.spec.ts` refactor) — sanctioned, behavior-preserving with one nit.** Directly addresses exp-005 review **C-3**. The extracted helpers compose the same user-visible actions; the new e2e suite is 18/18 green and the pre-existing join-flow TCs (GRP-027…031) pass unchanged. The one exception is **C-1**: the old expense-ui copy asserted `join-group-name` text; the promoted helper only asserts visibility. Test-only, no acceptance impact → **non-blocking nit**.
- **D-3 (direct-Prisma scale fixture via `createRequire`) — sanctioned and functional.** 00-test-strategy.md §5/§7 explicitly permits direct-Prisma seeding for **scale fixtures** (the 50-expense ledger) with the share-sum invariant asserted — which `seedEqualExpenses` satisfies (deterministic remainder distribution; the in-test loop asserts each seeded expense's shares sum to its amount). `apps/web` genuinely has no `@prisma/client` dependency and the ticket forbids lockfile/root-dependency changes; the `createRequire` resolution from the API workspace was verified to resolve (`node -e … r.resolve('@prisma/client')` → the `.pnpm` client) and the suite passes on a fresh DB. **Correct non-gold-plating.**
- **D-4 (exp-005 C-2/OBS-1/S-O2 and C-1 not addressed) — correctly out of scope.** TKT-exp-006's scope owns the edit form and TCs 029/030/032/033 only; it does not mention `AddExpensePage` own-text reset or `TC-EXP-028`. **Neither is scoped by this ticket.** Note the new timing specs (TC-EXP-032/033) set their own generous per-test timeouts, so they do not repeat exp-005 C-1. The new `EditExpensePage` *does* reset all per-expense state at effect start (heeding the C-2 defect class on its own surface).

## Prior-review UI-pattern routings — checked where they apply

- **State reset on route-param change** (`TKT-groups-004` K-2/S-1; exp-005 C-2): `EditExpensePage` resets members/fields/errors/submitError at effect start and keys the effect on `[groupId, expenseId]` — **heeded**. `GroupViewPage` still resets group/members/expenses/error/loading/activeTab/requests/deletingId/deleteError — **heeded**.
- **Load-failure vs success-empty**: unchanged; the edit form renders only when `loadError === null`, and the ledger's empty/list states nest inside `error === null` — **heeded**.
- **Logger-only affordance** (BR-EXP-007 UI aspect): rendered only when `expense.logger.id === user.id`; verified by TC-EXP-029/030 (non-logger sees count 0) — **heeded**.

## Mergeability (pass 1)

Open blocking findings (compliance violation / code-review blocker / critical-high security): **ZERO.**

- Compliance: **compliant** — zero violations; the sole routing is a plan/test-plan wording item.
- Code: zero blockers (1 test-only nit + observations); verdict **approve**.
- Security: zero findings at every severity above low (1 hardening note with no plausible exploit path + observations).
- CI: **green** on head `4f05e39`.

**RESULT: MERGEABLE on pass 1 — the loop ends early on a clean pass. No fixer dispatch** (nothing blocking to fix; the open items are non-blocking quality findings, hardening notes, observations and one upstream routing, and the loop's fixed sequence ends on a clean pass). The user (merge authority) may merge as-is, waive specific findings, or route the nit/new-coverage items to a pre-merge fixer pass or a follow-up ticket.

## Loop status

- Pass 1 (this round): all three lanes run, zero open blocking findings → **MERGEABLE**. Loop ends early; passes 2–3 and both fix rounds unused.
- User action requested: merge PR #27. After merge confirmation, the ticket's status moves to `done` and the board can be regenerated.
- Open non-blocking items for the next owner (user's call): **C-1 / OBS-2** (restore the `join-group-name` text assertion in the promoted helper, or correct the PR body wording), C-4 (assert the remaining prefills), C-5 / H-1 (defensive money render or a route-level error boundary), C-2/C-3/S-1/S-2/S-3 (observations — no action required). Routing: **R-1** → test-planner (plan-entry wording).

Ticket status remains `in-review` — the merge decision and the `done` transition belong to the user. This artifact is committed to the PR branch (gitignored `reviews/` dir force-added per the established pattern) so the review history lands in `dev` with the merge; the PR head moves forward by this docs-only commit and CI re-runs on it (expected green — touches only `.pipeline/plan/`).

## Evidence index

- Lead logs: `/tmp/opencode/review-exp-006/lead-{install,prisma-gen,lint,typecheck,build,migrate-e6r,test,e2e}.log`
- Prior round/routing references: `.pipeline/plan/reviews/TKT-exp-005-round-1.md` (A-2, C-3, H-1/O-2, C-1, C-2), `TKT-groups-004-round-1.md` (K-2), `TKT-groups-006-round-1.md`.
- Plan anchors checked: `testing/expense-tracking.md` §2 (TC-EXP-029/030/032/033), `testing/00-test-strategy.md` §3 (T4), §5/§7 (scale-fixture seeding + invariants), `architecture/03-api-design.md` §3b (GET/PATCH/DELETE rows), §4, §6.
