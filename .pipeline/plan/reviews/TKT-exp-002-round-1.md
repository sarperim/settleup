# Review Round 1 — PR #23 (TKT-exp-002: Log an expense — Ledger module create endpoint)

PR: https://github.com/sarperim/settleup/pull/23
Branch: `tkt-exp-002` → `dev` · Head at review: `2a8b510` · Base: `3e7d5c6` (= `origin/dev` tip; merge-base verified — the PR is a clean descendant of dev's tip)
Review date: 2026-09-29
Isolated checkout: `/tmp/opencode/worktrees/rl-tkt-exp-002` — local branch `pr-23` at `2a8b510` (same commit as the PR head `origin/tkt-exp-002`; the main checkout `/home/sarp/settleup` on `dev` at `3e7d5c6` was never touched; the sibling `/tmp/opencode/worktrees/tkt-exp-002` was not touched). Tree clean at review start, after every lane, and at every gate. Scratch namespace `/tmp/opencode/review-exp-002/`. Per-lane databases: lead `settleup_e2r_x`, compliance `settleup_e2r_c`, code `settleup_e2r_k`, security `settleup_e2r_s`, system `settleup_e2e_e2r` (all pre-provisioned, migrations applied).

Scope context: the C4 create endpoint — `POST /api/groups/:groupId/expenses` with `GroupMemberGuard`, DTO validation, the amended service-check order `NO_PARTICIPANTS` → `PARTICIPANT_NOT_MEMBER` → `SPLIT_SUM_MISMATCH`, shares computed by the exp-001 engine over the **real CSPRNG**, expense + shares in one transaction. Acceptance: TC-EXP-007…014. Per `.pipeline/plan/tickets/TKT-exp-002.md`.

Environment note: three reviewer sessions (`compliance-reviewer`, `code-reviewer`, `security-reviewer`) dispatched concurrently via `opencode run` against this checkout. **Dispatch incident (recorded for history integrity):** the security lane's first attempt died mid-run on a provider timeout — `{"code":"execution_unknown"}` ("model yanıtı zamanında tamamlanmadı") — after substantial work but before writing its report; nothing from it was relied on. The security lane was re-dispatched fresh against the same head (recorded at `/tmp/opencode/review-exp-002/security-session-crash1.log`; the completed run at `security-session.log`). Lane reports preserved at `/tmp/opencode/review-exp-002/{compliance,code,security}-report.md`.

## Blast radius gate (pass-1 dispatch decision)

**Classification: FULL — all three review lanes run.** Reasoning recorded:

- The diff adds executable production logic (`ledger.service.ts`, `ledger.controller.ts`, `ledger.module.ts`, `create-expense.dto.ts`, and `app.module.ts` wiring) — not presentation-only, not non-executable.
- Test files are touched (8 new integration specs + test support).
- The ticket pins automated acceptance TCs (TC-EXP-007…014 green) — the compliance lane must verify them.
- The diff introduces a new authenticated HTTP input path that persists CSPRNG-derived financial shares and wires production crypto — squarely security- and compliance-relevant.

## Scope fence (allowed set) — verified held (lead + compliance lane, independently)

`git diff origin/dev...HEAD`: exactly 16 files, no renames, no mode changes (+1186/−5):

| File | Change |
|---|---|
| `.pipeline/plan/tickets/TKT-exp-002.md` | status `todo`→`in-review` + one added `Evidence:` line only |
| `apps/api/src/app.module.ts` | +5/−4 — registers `LedgerModule`; doc comment updated (wiring; not on the must-NOT-touch list) |
| `apps/api/src/ledger/dto/create-expense.dto.ts` | new (72) |
| `apps/api/src/ledger/ledger.controller.ts` | new (67) |
| `apps/api/src/ledger/ledger.module.ts` | new (25) |
| `apps/api/src/ledger/ledger.service.ts` | new (199) |
| `apps/api/test/integration/support/factories.ts` | +54 — adds `createExpense` + types (ticket scope line 8) |
| `apps/api/test/integration/support/standing-group.ts` | new (58) |
| `apps/api/test/integration/tc-exp-00{7,8,9}-*.spec.ts` | new (109/80/83) |
| `apps/api/test/integration/tc-exp-01{0,1,2,3,4}-*.spec.ts` | new (64/56/129/100/83) |

**Zero lines** (independently re-verified by path-filtered diff) to the ticket's must-NOT-touch set: `apps/web/**`, `packages/shared/src/**`, `apps/api/prisma/**`, `apps/api/src/groups/**`, `apps/api/src/auth/**`, root `package.json` / `pnpm-lock.yaml`. No new dependencies. `apps/api/test/unit/**` untouched (exp-001's unit specs, incl. open K-2, unchanged). `apps/api/src/ledger/engine/**` untouched.

## Reviewer verdicts (pass 1, dispatched in parallel)

| Lane | Verdict | Blocking findings |
|------|---------|-------------------|
| compliance | **COMPLIANT** | 0 violations · D1/D2/S-1/C-4 routed non-blocking · 1 nit (CMP-N1) |
| code | **APPROVE** | 0 blockers · 2 should-fix (K-1, K-2) · 4 nits (K-3…K-6) |
| security | **REQUEST CHANGES** | **1 high blocking (S-1a)** · 1 medium (S-1b) · 3 low (S-1c/d/e) |

## Baseline gates (review-lead run, from scratch in the isolated worktree)

- `pnpm --filter api exec prisma generate` — exit 0.
- `pnpm lint` — exit 0 (shared, api, web). `pnpm typecheck` — exit 0 (shared, api, web).
- `pnpm exec vitest run --project unit` — **21 files / 91 tests passed, exit 0** (unchanged from exp-001; this ticket adds no unit specs).
- `DATABASE_URL=…/settleup_e2r_x pnpm test` (unit + integration + web-unit on real PostgreSQL 17) — **84 files / 247 tests passed, exit 0** — matches the ticket's evidence claim exactly (+8 files / +21 tests over the 76/226 baseline).
- `pnpm build` — exit 0 (api `dist/main.js`, shared, web emitted).
- `E2E_DATABASE_URL=…/settleup_e2e_e2r PSQL=/tmp/opencode/review-exp-002/psql pnpm test:system` (TC-ACC-028 built-CLI) — **1/1 passed, exit 0**.
- CI on head `2a8b510`: run [36443408013](https://github.com/sarperim/settleup/actions/runs/36443408013) "Lint, test & build" **SUCCESS** (`gh pr checks 23`).

## Consolidated findings

IDs scoped to this PR/round. **One blocking finding (S-1a).** Severity: blocking = compliance violation / code-review blocker / critical-high security.

### Blocking

| ID | Severity | Source | Location | Status | Summary |
|----|----------|--------|----------|--------|---------|
| S-1a | **high (blocking)** | security | `create-expense.dto.ts:69-71` → `ledger.service.ts:97-104`; engine `split-engine.ts:137-147` | open | Negative `exactAmounts` values whose sum equals the amount are accepted and **persisted** as negative `shareKurus` (probe-confirmed on `settleup_e2r_s`: `createMany([{1500},{-500}])` stored `[1500,-500]`; no DB CHECK). Any group member can shift an arbitrary balance (up to ~2^31−1 kuruş) to/from another member via a single `POST` — e.g. `amountKurus: 0` with `exactAmounts: {attacker: -N, victim: +N}`. Violates the frozen data-model §5.4 field constraint `expense_shares.shareKurus ≥ 0` (zero allowed, OQ-EXP-003) and BR-EXP-010/FR-EXP-002 non-negative intent. The new HTTP path (this PR) is what makes it reachable and persistent. Fix: validate `exactAmounts` values pre-engine — integer, `[0, amountKurus]`, keys ⊆ `participantIds`. |

### Should-fix / medium (non-blocking)

| ID | Severity | Source | Location | Status | Summary |
|----|----------|--------|----------|--------|---------|
| S-1b | medium (non-blocking) | security | same path | open | Fractional `exactAmounts` values (e.g. `{a:500.5,b:500.5}` vs amount 1001) sum in float, pass the engine, and are **silently truncated** to `Int` on write (probe: stored `[500,500]`, sum 1000 ≠ 1001) — a silent, persistent violation of the share-sum invariant, attacker-repeatable. Fix: integer validation at the fence (same fix as S-1a). |
| K-1 | should-fix (non-blocking) | code | `create-expense.dto.ts:68-71` → `ledger.service.ts:97-101` | open | Same defect as S-1a from the code lane: negative/> amount `exactAmounts` persisted, violating data-model §5.4. Unpinned by any TC/BR; disclosed as deferred S-1. Fix ~15 lines + few test rows; close before exp-003/C5 build on stored shares. |
| K-2 | should-fix (non-blocking) | code | `ledger.service.ts:97-135` | open | Duplicate `participantIds` under EQUAL make the engine sum exceed the amount (`equalSplit(3,['u0','u0'])` → sum 4); the only thing preventing persistence is the `@@unique([expenseId,participantId])` constraint → P2002 → **`500 INTERNAL`** on accepted-but-malformed input. No post-engine sum check for EQUAL. Fix: de-duplicate/reject before the engine. (Security rates the same vector S-1c **low** — no corruption, generic 500.) |

### Low / nits / observations (non-blocking)

| ID | Severity | Source | Location | Status | Summary |
|----|----------|--------|----------|--------|---------|
| S-1c | low | security | `create-expense.dto.ts:59-63`; `ledger.service.ts:71-100` | open | Duplicate `participantIds` → P2002 → generic `500 INTERNAL` (no corruption, no stack leak). Fix with K-2. |
| S-1d | low | security | `create-expense.dto.ts:69-71` | open | `exactAmounts` keys outside `participantIds` silently ignored (no effect). Optional: reject for a deterministic contract. (= code K-3, compliance C-4.) |
| S-1e | low (observation) | security | `ledger.service.ts:71-83` | open | Sequential per-participant `isMember` lookups; bounded by the 100 kb body cap and NFR-EXP-004 scale — negligible. Note only. |
| K-3 | nit | code | `create-expense.dto.ts:68-71`; engine `:138-141` | open | Extra `exactAmounts` keys silently dropped; C-4 shape contract still unpinned. Fold into K-1's fix. |
| K-4 | nit | code | `factories.ts:217-236` | open | `createExpense` lands unconsumed (all 8 specs hand-roll the POST). In-scope by ticket line 8 and the declared vehicle for exp-003; its non-201 path is untested. Optional: use it in a happy-path spec. |
| K-5 | nit | code | `tc-exp-012…spec.ts:92,118` | open | Row b omits the plan's "shares all 0" clause (redundantly pinned by TC-EXP-014 §2 / TC-EXP-005). One additive assertion. |
| K-6 | nit | code | `tc-exp-011…spec.ts:40-54` | open | `NO_PARTICIPANTS`-vs-`PARTICIPANT_NOT_MEMBER` combined case unpinned; code order correct by trace. Optional strengthening. |
| CMP-N1 | nit | compliance | `tc-exp-012…spec.ts` row b | open | Same under-assertion as K-5. |
| CMP-S1 | observation (planning defect) | compliance | ticket scope vs exp-001 artifact | open — upstream | The exp-001 artifact routed S-1's fence to exp-002's acceptance, but the generated ticket did not encode it (no TC pins it) — a planner/backlog defect. Does not change S-1a's blocking status: data-model §5.4/§9 designate `LedgerService` as the enforcement point regardless. |
| CMP-D1 | observation (planning defect) | compliance | ticket scope line 6-10 vs TC-EXP-007 step 2 | open — upstream | Ticket is create-only and does not trace FR-EXP-011, yet its pinned acceptance TC-EXP-007 step 2 issues `GET …/:expenseId` (owned by exp-003). Internal work-order contradiction. |
| CMP-D2 | observation (docs) | compliance | `00-test-strategy.md:63-66` | open — upstream | Strategy §5 omits `server` on all four HTTP factory signatures; shipped code (all four factories) takes it. Doc fix. |
| CMP-C4 | observation (evidence inaccuracy) | compliance | `TKT-exp-002.md:4` | open | Coder's claim that C-4 is "already pinned by the exp-001 engine specs" is false: `tc-exp-006` supplies only complete maps; the missing-key→0 path is uncovered (= exp-001 K-2 open). |

**Lane conflict (recorded, not resolved here):** the code lane reasons non-integer `exactAmounts` are rejected by Prisma as a `Int` type error → `500 INTERNAL`; the security lane **probed** the DB and reports silent truncation to `Int`. Either way it is a defect and the S-1a fix removes the ambiguity; pass 2 should re-verify the post-fix behavior.

**Carried, not this PR's (inputs weighed, not waived):** S-2/R-2 (`joinCode` absent from pino `REDACTED_KEYS`) remains open/dormant; this diff adds no logging or groups/common code. exp-001 K-2 (engine missing-key→0 untested) remains open — untouched by this PR (`apps/api/test/unit/**` unchanged). exp-001 K-1/K-3/K-5/C-2/C-3 nits remain open.

## Deviation and carryover adjudication (lead synthesis of the three lanes)

### D1 — minimal `GET /api/groups/:groupId/expenses/:expenseId` detail route — **adjudicated: necessary minimal consequence of a ticket/plan contradiction; non-blocking; route to planner.**
All three lanes agree. The ticket scope authorises create only and does not trace FR-EXP-011, but the pinned acceptance TC-EXP-007 step 2 requires the GET route, and `03-api-design.md` §3b defines exactly this endpoint (`200 { expense }` / `404 NOT_FOUND`). The implementation matches and stays minimal — no list route, no 500-cap, no `LedgerReadService` (all left to exp-003, which depends on this ticket). Omitting it would have been a missing-TC violation, strictly worse than a minimal in-fence extension. Planning action: reconcile the ticket/acceptance (exp-003 extends, or move the read step to exp-003).

### D2 — `createExpense(server, memberCookie, groupId, expenseInput)` vs strategy §5's shortened form — **adjudicated: §5 is shorthand; the shipped signature is correct; non-blocking; docs fix.**
Every pre-existing HTTP factory in `factories.ts` takes `server` first (`registerUser`, `createGroup`, `placeJoinRequest`, `joinAndApprove`), and `createGroup`'s own JSDoc already cites §5's shorthand while implementing the `(server, …)` form. §5 omits the transport handle from all four signatures; the literal form would make `createExpense` the lone non-conforming factory. Adopting repo convention is correct.

### C-1 (drift guard) — **adjudicated: WIRED and non-vacuous.** 
`create-expense.dto.ts` imports the engine's `SplitType` and declares `SPLIT_TYPE_VALUES: Record<SplitType, true> = { EQUAL: true, EXACT: true }` with `SPLIT_TYPES` derived for `@IsIn`. Widening (or narrowing) the engine union makes the literal fail to compile at this seam in both directions; `apps/api/tsconfig.json` includes `src/**/*`, so it is typechecked. This is exactly the DTO→engine pin exp-001's C-1 requested. The `packages/shared` mirror remains un-pinned under FLAG-1 (build-before-check tooling), correctly not re-attempted.

### S-1 (input hardening) — **adjudicated: the coder's "not scoped / just an observation" call is INCORRECT as applied now that this PR wires the HTTP path; the fence is in-scope and must be implemented.**
The compliance lane is right that no acceptance TC pins these paths and the generated ticket did not encode the routed S-1 checklist (a planner defect). But the permanent docs do: data-model §5.4 pins `expense_shares.shareKurus` Int **≥ 0** and §9 assigns enforcement to "`LedgerService` computes/validates before write"; and this PR is the first to expose the engine output over HTTP and persist it. So the gap is a code defect inside the allowed `apps/api/src/ledger/**` fence, not a document defect to route away. The security lane is therefore upheld: S-1a is **new and blocking for this PR**. The fix is small, in-scope, and does not alter any pinned test (TC-EXP-009/010/013's maps are all non-negative integers).

### C-4 — **adjudicated: coder's "already pinned" justification is inaccurate; non-blocking; route to planner.** See CMP-C4. Fold the missing-key semantics into the K-1/S-1a validation work (which must decide the shape contract anyway).

## Mergeability (pass 1)

Open blocking findings: **ONE — S-1a (high, security).**

- Compliance: compliant — no violation. D1/D2/C-4 non-blocking; S-1 recorded as a planning defect but acknowledged as a reachable data-model gap the user may choose to block.
- Code: approve — no blocker; K-1/K-2 should-fix independently describe the same persist/500 family.
- Security: request changes — S-1a high blocking.

**RESULT: NOT MERGEABLE on pass 1 — fixer dispatch begins.** The pinned-test contract is fully met and the suite is green, but the security lane's high finding governs: negative share values are persisted, violating a frozen data-model field constraint via the new endpoint. This enters the fix loop per the standing rules (a high security finding is blocking; the fix is code, in-scope).

### Fixer routing (pass 1)
Dispatch the fixer with this artifact. Priorities:
1. **S-1a/K-1 (blocking):** validate `exactAmounts` at the DTO/service fence — every value an integer in `[0, amountKurus]`, keys ⊆ `participantIds`; surface `400 VALIDATION_FAILED` (DTO) or the documented error, never a `500`. Reject non-integer values too (S-1b).
2. **K-2/S-1c (should-fix):** de-duplicate or reject duplicate `participantIds` before the engine (→ 400, not P2002/500). Orthogonally, an engine-output sum guard for EQUAL would make the §9 invariant code-enforced rather than DB-accidental.
3. **K-3/S-1d:** fold the extra-key rule into (1).
4. Nits K-4/K-5/K-6 and the unpinned K-6 strengthening: fixer judgment (non-blocking).
Do **not** alter any pinned test's expected results; stay inside `apps/api/src/ledger/**` (+ the ticket's test files if adding coverage). Fixes push to `tkt-exp-002`; pass 2 re-verifies S-1a is closed on the new head **and** re-checks the fix commits for new problems. Do not merge.

## Loop status

- Pass 1 (this round): all three lanes dispatched in parallel (blast radius FULL) → **one blocking finding (S-1a) → NOT MERGEABLE → fixer dispatch**. Passes 2–3 and fixer round 2 remain.
- Round artifact committed to the PR branch per convention. Ticket status remains `in-review`.

## Suite re-run evidence (final head this round: `2a8b510`)

| Gate | Command | Result |
|---|---|---|
| Lint | `pnpm lint` | exit 0 |
| Typecheck | `pnpm typecheck` | exit 0 |
| Unit | `pnpm exec vitest run --project unit` | 21 files / 91 tests passed |
| Full (unit+integration+web-unit, real PG17) | `DATABASE_URL=…/settleup_e2r_x pnpm test` | 84 files / 247 tests passed |
| Build | `pnpm build` | exit 0 |
| System (built CLI) | `E2E_DATABASE_URL=…/settleup_e2e_e2r PSQL=… pnpm test:system` | 1 file / 1 test passed |
| CI | `gh pr checks 23` | "Lint, test & build" SUCCESS |
