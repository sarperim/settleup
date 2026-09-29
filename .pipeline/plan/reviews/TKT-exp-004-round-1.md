# Review Round 1 — PR #25 (TKT-exp-004: Edit & delete expenses — logger-only, recompute rule, cross-route 404, CSRF) — FINAL

PR: https://github.com/sarperim/settleup/pull/25
Branch: `tkt-exp-004` → `dev` · **Code head: `9005834`** · Base: `23134a3` (= `dev` tip; merge-base verified — the PR is a clean descendant of dev's tip)
Preceding: none (pass 1).
Review date: 2026-09-29 · Isolated checkout `/tmp/opencode/worktrees/rl-tkt-exp-004` (branch `pr-25` at `9005834`, clean at every gate; the main checkout `/home/sarp/settleup` was never touched). Scratch namespace `/tmp/opencode/review-exp-004/`. Per-lane databases: lead `settleup_e4r_x`, compliance `settleup_e4r_c`, code `settleup_e4r_k`, security `settleup_e4r_s`, system/e2e `settleup_e2e_e4r` (all provisioned, migrations applied). Lane reports preserved at `/tmp/opencode/review-exp-004/{compliance,code,security}-report.md`; sessions at `*-session.log`.

Diff under review: `git diff 23134a3...HEAD` — 15 files, +1260/−2: `apps/api/src/ledger/{dto/update-expense.dto.ts, guards/expense-logger.guard.ts, ledger-request-context.ts}` (new), `ledger.controller.ts` (+50), `ledger.module.ts` (+2), `ledger.service.ts` (+154), eight new integration specs `tc-exp-0{15,16,17,18,19,20,26,27}-*.spec.ts`, and the ticket file (status/evidence only).

## Blast radius gate (pass-1 dispatch decision)

**Classification: FULL — all three review lanes run.** Reasoning recorded:

- The diff adds/re-layers **executable production logic** (`ledger.service.ts`, `ledger.controller.ts`, `ledger.module.ts`, the new update DTO and `ExpenseLoggerGuard`) — not presentation-only, not non-executable.
- **Test files are touched** (8 new integration specs).
- The ticket **pins automated acceptance TCs** (TC-EXP-015..020, 026, 027) — the compliance lane verifies them.
- The diff adds two authenticated **state-changing** HTTP routes and a new authorization guard over group-scoped financial data — security- and compliance-relevant.

## Scope fence (allowed set) — verified held (lead + all three lanes, independently)

Changed-file set: `.pipeline/plan/tickets/TKT-exp-004.md` (status `in-review` + evidence line) and files under `apps/api/src/ledger/**` + `apps/api/test/integration/tc-exp-0{15..20,26,27}-*.spec.ts` — exactly the ticket's declared **Extend `apps/api/src/ledger/**` and add integration specs** scope (ticket line 6).

**Zero lines** (independently re-verified by path-filtered diff) to the ticket's must-NOT-touch set: `apps/web/**`, `apps/api/src/groups/**`, `apps/api/src/auth/**`, `apps/api/prisma/**`, root `package.json` / `pnpm-lock.yaml`. No new dependencies. No schema/migration change (`onDelete: Cascade` on `expense_shares` pre-existed at `base`). exp-002/exp-003 specs and shared test support untouched.

**Parallel group P-6 — independently verified disjoint.** exp-004 writes `apps/api/src/ledger/**` + `apps/api/test/integration/**` + its ticket only; the concurrent PR #26 (TKT-exp-005, Expense UI, worktree `/tmp/opencode/worktrees/rl-tkt-exp-005` @ `f97c5df`) writes `apps/web/**` + its ticket only. Path sets are provably disjoint; neither touches the lockfile. **No cross-PR conflict.**

## Reviewer verdicts (pass 1, dispatched in parallel)

| Lane | Verdict | Blocking |
|------|---------|----------|
| compliance | **COMPLIANT** | no (3 non-blocking nits) |
| code | **APPROVE** | no (K-1..K-3 should-fix; K-4..K-8 nits) |
| security | **APPROVE** | no (2 low, 2 observations) |

## Consolidated findings

| ID | Lane | Severity | Status | Summary |
|----|------|----------|--------|---------|
| K-1 / CMP-2 / S-4 | code + compliance + security | non-blocking (should-fix/nit) | open | `exactAmounts`-only edit (same amount/participants/splitType) is accepted `200` with `editedAt` set but the supplied `exactAmounts` are silently ignored (shares stand). Faithful to FR-EXP-006/arch §5.1's recompute-trigger letter, but in tension with API §3b's editable-field list and uncovered by any TC — an internal docs conflict. **Routing item (planner/architect + test-planner)**, not a fix-loop item. |
| K-2 | code | non-blocking (should-fix) | open | Cross-group PATCH/DELETE with an existing foreign expense is not tested: TC-EXP-020 covers cross-group on GET + *missing* ids on PATCH/DELETE (faithful to the plan's wording), so a lost `groupId` scope in `ExpenseLoggerGuard` would not fail any spec. Ticket scope bullet says GET/PATCH/DELETE. Security lane probed the behavior correct today. **Routing item (test-planner/planner)** — plan under-covers the ticket's own scope bullet. |
| K-3 | code | non-blocking (should-fix) | open | TC-EXP-015 rows a/e assert the *negative* recompute rule, but the even-split fixture (9000/3) redraws identically under a spurious recompute — a "recompute-always" regression would ship undetected. Deterministic closure available (share-row identity snapshot). Test-strengthening. |
| CMP-1 | compliance | non-blocking (nit) | open | TC-EXP-015 asserts `editedAt >= createdAt` only in row a; the plan's aggregate expectation phrases it for every row. Core `editedAt`-present assertion holds per row. |
| CMP-3 | compliance | non-blocking (nit) | open | 01 §8.1 layer 3 says role checks run "inside handlers"; C3's `GroupCreatorGuard` and this `ExpenseLoggerGuard` implement layer-3 role checks as guards, blessed by API §4 ("guard order"). Docs-wording routing. |
| K-4 | code | non-blocking (nit) | open | A non-object JSON body on PATCH bypasses DTO validation (platform pipe quirk, pre-existing), yielding `200` + `editedAt` on a garbage body. Newly exposed by PATCH; POST-side twin pre-exists. |
| K-5 | code | non-blocking (nit) | open | Explicit `null` is silently treated as "field omitted" by `@IsOptional()` + `??`. Harmless today (no field is clearable). |
| K-6 / S-2 | code + security | non-blocking (nit/obs) | open | Same-logger race between guard resolution and write (double-submit) → Prisma P2025 → generic `500 INTERNAL` instead of `404`. No corruption; no cross-group/cross-user effect. |
| K-7 / S-1 | code + security | non-blocking (nit/low) | open | Update `exactAmounts` constraint diverges from create's: unknown keys silently ignored when `participantIds` omitted; values checked even under EQUAL; `> amountKurus` bound only when amount supplied. Probed: no invalid data persists, no 500, no share-invariant regression. |
| K-8 | code | non-blocking (nit) | open | Empty-body PATCH (`{}`) returns `200` and stamps `editedAt` on an unchanged expense. Conformant to "editedAt set on success", degenerate input. |
| S-3 | security | non-blocking (low, carried) | open | No `@ArrayMaxSize` on `participantIds` — identical pre-existing create-path shape, now on a second route; bounded by Express's 100kb body cap and requires an authenticated in-group session. |
| carried | security | pre-existing | open | `joinCode` redaction debt — untouched by this diff, carried only. |

**Open blocking findings: ZERO.**

## Flagged-point adjudication (the two points the user asked to be adjudicated)

### D1 — `NOT_LOGGER` + group-scoped 404 enforced in a route-level `ExpenseLoggerGuard` running BEFORE the global validation pipe (not duplicated in the service) → **COMPLIANT (no deviation); one non-blocking doc-wording routing**

- **Within contract?** Yes. API §4 (amended 2026-09-25 — the ticket's cited authority) specifies expense edit "runs the same order over its field validations, **after the `NOT_LOGGER` check (authorization first — guard order)**"; the word *guard* names exactly this seam. TC-EXP-016 step 2 pins `403 NOT_LOGGER` for a member non-logger submitting a field-invalid body (`amountKurus: -1`) — a result only reachable if authorization precedes the validation pipe. The spec asserts it, and the security lane's live probe reproduced the full order (CSRF → AuthGuard → GroupMemberGuard → ExpenseLoggerGuard → pipe).
- **Against 01 §8.1 layer 3 ("role checks inside handlers")?** Not a genuine deviation. The codebase already materializes layer-3 role checks as guards (`GroupCreatorGuard`, self-described as "layer-3 role guard"); §8.1's parenthetical is loose wording in tension with the more specific, more recent API §4 amendment and existing C3 code. The specific/recent contract controls. Routed as CMP-3 (docs wording, non-blocking).
- **Ordering correctness (all lanes agree):** Nest composes global → controller → route guards, then pipes. So a non-member gets `404` from `GroupMemberGuard` before `NOT_LOGGER` can run (no membership leak); a foreign/missing id resolves to `404` before the logger check; a member non-logger gets `403` even with an invalid body; within the handler the DTO pipe still precedes the service-level `NO_PARTICIPANTS → PARTICIPANT_NOT_MEMBER → SPLIT_SUM_MISMATCH`. **`NOT_LOGGER` is absent from `LedgerService`** (comments only) — no duplication.
- **Disposition:** compliant, not blocking.

### D2 — Partial `UpdateExpenseDto`; an EXACT amount-only edit validates against the stored shares as the effective `exactAmounts` → **COMPLIANT for the pinned cases; one genuine contract gap routed to the planner (non-blocking)**

- **Partial DTO faithful?** Yes: API §3b PATCH row lists "any of description, amount, payer, participants, splitType, exactAmounts"; every property is `@IsOptional` and each supplied field is re-validated with the create rules (bounds, length, enum, `exactAmounts` range fence). Omitted fields correctly retain stored values.
- **Does stored-shares-as-effective-`exactAmounts` alter TC-EXP-017?** No. The plan itself models the step as "the stored exactAmounts now sum to 5000 ≠ 6000" and expects `SPLIT_SUM_MISMATCH` "against the **new** amount" — precisely what the defaulting produces. The spec's `400` is faithful, not weakened; `editedAt` untouched on the failure path.
- **Contract gap (real, non-blocking → routing):** an `exactAmounts`-only edit triggers no recompute (the predicate is amount/participants/splitType only, FR-EXP-006/arch §5.1), so the supplied amounts are silently discarded while the response is `200` with `editedAt`. API §3b lists `exactAmounts` as editable — an **internal docs conflict** (K-1/CMP-2/S-4). No plan TC pins this case, so it is **not a missing TC** and not a violation of this ticket. Route to the planner/architect (is re-distributing an EXACT split without changing amount/participants/splitType a legal edit, and if so should it be a recompute trigger with a TC?).
- **Security angle:** the partial path does not regress the exp-002 S-1 input-hardening class — negative/oversized/ghost `exactAmounts` all reject or no-op without persisting invalid shares (probes P9/P10/P11); no `shareKurus < 0` write, no 500, no participant injection.
- **Disposition:** compliant for the ticket; contract gap routed as a planning item.

## Mergeability (pass 1) — MERGEABLE

- Open blocking findings (compliance violation / code-review blocker / critical-high security): **ZERO.**
- CI green on the code head (`9005834`): "Lint, test & build" **SUCCESS** (run 36541148131).
- Independent lead suite re-run green on `9005834` (below), matching the ticket's evidence.
- Remaining items are non-blocking should-fix/nits and three routing items (K-1/CMP-2/S-4 docs conflict; K-2 test-plan coverage gap; CMP-3 docs wording) — the user arbitrates (bundle, fold into a follow-up, or waive).

**RESULT: MERGEABLE on pass 1.** The loop ends early — no fixer dispatch, no escalation. The user (or the orchestrator under its merge grant) owns the merge and the ticket's `done` transition. Per the standing routing rule, K-1/K-2/CMP-3 are test-plan/doc defects and never enter the fix loop.

## Suite / CI evidence — lead independent re-run on `9005834`

| Gate | Command | Result |
|---|---|---|
| CI | `gh pr checks 25 --watch` | "Lint, test & build" **SUCCESS** on `9005834` (run 36541148131, 2m26s) |
| Lint | `pnpm lint` | exit 0 |
| Typecheck | `pnpm typecheck` | exit 0 |
| Full (unit + integration + web-unit, real PG17) | `DATABASE_URL=…/settleup_e4r_x pnpm test` | **96 files / 270 tests passed** (+8 files / +13 tests over the `23134a3` baseline 88/257) |
| Build | `pnpm build` | exit 0 |
| System (built CLI) | `E2E_DATABASE_URL=…/settleup_e2e_e4r PSQL=… pnpm test:system` | **1 file / 1 test passed** |

PostgreSQL 17.11 at `127.0.0.1:5432` (lead DB `settleup_e4r_x`, migrations applied). Logs: `/tmp/opencode/review-exp-004/lead-{lint,typecheck,test,build,system}.log`.
