# Review Round 3 — PR #23 (TKT-exp-002: Log an expense — Ledger module create endpoint) — FINAL

PR: https://github.com/sarperim/settleup/pull/23
Branch: `tkt-exp-002` → `dev` · **Code head: `640a10c`** (fixer round 2) · Base: `3e7d5c6` (= `origin/dev` tip)
Preceding: round-1 `.pipeline/plan/reviews/TKT-exp-002-round-1.md` (`2a8b510`/`aca27f8`); round-2 `.pipeline/plan/reviews/TKT-exp-002-round-2.md` (`e401b9e`).
Review date: 2026-09-29 · Isolated checkout `/tmp/opencode/worktrees/rl-tkt-exp-002` (clean at every gate).
Fix commit under review: `git diff e401b9e..640a10c` — `apps/api/src/ledger/dto/create-expense.dto.ts` (+6/−1: `const ids = Array.isArray(dto.participantIds) ? dto.participantIds : []; const participantIds = new Set(ids);`) + one additive regression row in `ledger-input-hardening.spec.ts` (+15).

This is the third and final review pass (pass cap reached; both fixer rounds used). All three lanes dispatched in parallel; lanes did not run the suite (CI is the authority).

## Reviewer verdicts (pass 3)

| Lane | Verdict | Blocking |
|------|---------|----------|
| compliance | **COMPLIANT** | no |
| code | **APPROVE** | no (one cosmetic comment nit, non-blocking) |
| security | **APPROVE** | no |

## Verification of the final fix (N-1 / S-2a)

- Guard confirmed correct and total: `Array.isArray` never throws; non-arrays fall back to `[]`, so no non-iterable reaches `new Set()`. `@IsArray` failure still surfaces → `400 VALIDATION_FAILED` with `details.fields` including `participantIds`.
- Code probe (compiled DTO, class-validator 0.14.4): number/boolean/object/null/string `participantIds` → **no throw**, DTO error on `participantIds`.
- Security probe (real HTTP, `settleup_e2r_s`, 26 probes): all non-iterable vectors → **400 `VALIDATION_FAILED`**, `0` persisted, **0×500**, no `TypeError`/`unhandled_exception` in the server log. AuthN/AuthZ/group-scoping/CSRF/CSPRNG re-confirmed unchanged (403/401/404 probes; `CryptoRandomSource` binding intact).
- Regression row is additive and faithful (no pinned test altered; `git diff` of `tc-exp-007…014` against `origin/dev` is additions only — those files are new to this ticket).

## Consolidated final status of all findings

| ID | Severity | Status |
|----|----------|--------|
| S-1a / K-1 | high (blocking, r1) | **verified-fixed** |
| N-1 / S-2a | blocker/medium (r2) | **verified-fixed** |
| S-1b | medium (r1) | verified-fixed |
| K-2 / S-1c | should-fix/low (r1) | verified-fixed |
| K-3 / S-1d | nit/low (r1) | verified-fixed (EXACT) |
| K-4 | nit (r1) | verified-fixed |
| NEW-1 | low (r2) | open — non-blocking (non-EXACT split ignores `exactAmounts`; no persistence path) |
| N-2 | nit (r2, pre-existing) | open — non-blocking (`exactAmounts: null` skipped via `@IsOptional`; no corruption) |
| Code comment nit | nit (r3) | open — non-blocking (comment says "below" for a JSDoc that is above; plus a non-empty `exactAmounts` also yields an `exactAmounts` error) |
| K-5/CMP-N1, K-6 | nits | disputed by fixer — acceptable, non-blocking |
| CMP-S1, CMP-D1, CMP-D2, CMP-C4 | upstream (planning/docs/evidence) | open — routed upstream, non-blocking |
| S-1e, S-2/R-2, exp-001 K-2 | observations / carried | open — non-blocking |

**Open blocking findings: ZERO.**

## Deviation / carryover adjudication (final)

- **D1 — minimal `GET /api/groups/:groupId/expenses/:expenseId`:** adjudicated a necessary minimal consequence of a ticket↔acceptance contradiction (TC-EXP-007 step 2 pins the read; ticket scope is create-only; `03 §3b` defines the route). Minimal (no list/cap/`LedgerReadService`). Non-blocking; planner to reconcile. **Not changed by the fixes.**
- **D2 — factory signature `(server, …)`:** adjudicated correct (strategy §5 is shorthand; every existing HTTP factory takes `server` first). Non-blocking; test-strategy §5 doc fix. **Not changed.**
- **C-1 drift guard:** **wired and non-vacuous**, intact after both fixes.
- **S-1 (input hardening):** the coder's "out of scope / observation" call was **overruled** — the data-model §5.4 `shareKurus ≥ 0` constraint and §9 (service is the enforcer) make the fence in-scope once the HTTP path is wired. Security's high finding stood; the fixer implemented the fence at the DTO seam in round 1 and completed it in round 2. **Resolved.**

## Mergeability (pass 3) — MERGEABLE

- Open blocking findings (compliance violation / code-review blocker / critical-high security): **ZERO.**
- CI green on the code head (`640a10c`); suite green (below).
- Remaining items are non-blocking nits/observations and upstream routings — the user arbitrates (bundle, fold into a follow-up, or waive).

**RESULT: MERGEABLE on pass 3.** The loop's three passes and both fixer rounds are complete; no escalation. The user (or the orchestrator under its merge grant) owns the merge and the ticket's `done` transition.

## Suite / CI evidence (final code head `640a10c`)

| Gate | Command | Result |
|---|---|---|
| Lint | `pnpm lint` | exit 0 (run on `2a8b510`; unchanged since) |
| Typecheck | `pnpm typecheck` | exit 0 |
| Unit | `pnpm exec vitest run --project unit` | 21 files / 91 tests passed |
| Full (unit+integration+web-unit, real PG17) | `DATABASE_URL=…/settleup_e2r_x pnpm test` | **85 files / 254 tests passed** (final head; was 84/247 at pass 1) |
| Build | `pnpm build` | exit 0 |
| System (built CLI) | `E2E_DATABASE_URL=…/settleup_e2e_e2r PSQL=… pnpm test:system` | 1 file / 1 test passed |
| CI | `gh pr checks 23` | "Lint, test & build" SUCCESS on `640a10c` (run 36534914408) |
