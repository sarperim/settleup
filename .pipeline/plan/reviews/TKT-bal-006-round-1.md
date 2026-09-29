# Review Round 1 — PR #33 (TKT-bal-006: Balances & settle-up UI (e2e))

PR: https://github.com/sarperim/settleup/pull/33
Branch: `tkt-bal-006` → `dev` · Head at review: `e03bab8` · Base: `dev` tip `c2f99e9`
Review date: 2026-09-29
Isolated checkout: `/tmp/opencode/worktrees/review-TKT-bal-006` — branch `review/tkt-bal-006` at `e03bab8` (= remote `tkt-bal-006` head; tree clean at review start).

> **Lane dispatch.** Three concurrent subagents (`compliance-reviewer`, `code-reviewer`, `security-reviewer`) on the PR head. Consolidation, blocking classification and mergeability are the review lead's.

## Blast radius gate — decision: **FULL** (all three lanes)

Diff = 6 files: `apps/web/src/api/settlements.ts` (new — executable typed fetch service), `apps/web/src/api/settlements.spec.ts` (new test), `apps/web/src/pages/GroupViewPage.tsx` (executable React logic, +277 lines), two new e2e files under `apps/web/test/e2e/**`, and the ticket doc. Reasoning:

- The gate's LOW class requires **every touched file presentation-only or non-executable** and **no test files touched**. Both fail: two executable TS modules and three test files are added/modified.
- The ticket pins automated acceptance TCs (TC-BAL-021/022/023/024/026), which the compliance-reviewer must verify.

⇒ Full pipeline; pass 1 is not a fast pass. All three lanes ran.

## Scope fence — independently verified: **HELD**

`git diff origin/dev...HEAD --stat --name-status` = the 6 files above. Fence check `-- apps/api packages/shared root package.json pnpm-lock.yaml` → **empty**. Everything executable is under `apps/web/**`; the only non-web change is the ticket's `Status: in-review` + `PR:` lines (expected coder workflow).

**P-8 parallel disjointness (TKT-bal-006 vs TKT-bal-005, PR #32):** confirmed independently — this PR writes `apps/web/**` only; TKT-bal-005's `apps/api/test/**` is untouched here. No overlap, no shared file, neither touches the lockfile.

## CI gate

Actions run [`36588106895`](https://github.com/sarperim/settleup/actions/runs/36588106895) — `pull_request`, `headSha=e03bab8…` = current PR head — **success**; `Lint, test & build` all steps green, including `E2E smoke tests (Playwright)` (the coder-flagged intermittent e2e 409 SUGGESTION_STALE did **not** manifest on this run; CI's single retry is configured).

> Note: `gh pr checks 33` returned "no checks reported" (`statusCheckRollup` empty) even though the workflow run exists — an Actions↔check-run reporting quirk on this repo, not a missing run. The run was verified green directly via `gh run watch 36588106895 --exit-status`. CI is the test authority; no local suite was run.

## Reviewer verdicts (pass 1)

### compliance-reviewer — verdict: **compliant** (0 violations)

All five pinned TCs exist and are translated faithfully from `testing/balances-settlement.md` §2 — same identities, amounts, steps and expected results; no test weakened, skipped, or re-interpreted; no `.skip`/`.only`/`.todo`/`fixme`.

| TC | Plan entry | Faithfulness |
|----|-----------|--------------|
| TC-BAL-021 | §2 (dana+emre, 90.00 exact {30,60}, view as emre, +60/−60, sum 0, no email) | Faithful — includes the FR-ACC-008 no-email assertion. |
| TC-BAL-022 | §2 (ferit+gokce, 0.01 exact {0.00,0.01}, "Gökçe pays Ferit ₺0.01", settled empty) | Faithful — sub-lira rendered exactly (BR-BAL-011). |
| TC-BAL-023 | §2 (hale+ilhan owed 60.00, mark paid by payer, settled shown, both 0.00) | Faithful — adds `data-status="SETTLED"`. |
| TC-BAL-024 | §2 (jale+kaan settled→undo as kaan, outstanding again, balances revert, undone labelled) | Faithful — asserts `data-status="UNDONE"` + `settled-undone` + reverted ±60. |
| TC-BAL-026 | §2 (nadia self-contained setup, both tabs, T4 median-of-3 + one retry ≤ 2.0 s) | Faithful — `measureTabMedian` implements T4; `≤ PAGE_LOAD_BUDGET_MS` on both tabs. |

Architecture adherence: tabs on the single `/groups/:groupId` route (`03-api-design.md` §6), §1/§3c REST paths, CSRF on state-changing calls, URL-encoded ids — no deviation. Exact-split fixtures per strategy T5; every case self-contained (register → create → join+approve → expense via the form), no API seeding. The extra `settlements.spec.ts` mechanism spec mirrors the existing per-service spec convention — not gold-plating.

### code-reviewer — verdict: **approve** (0 blockers; 1 should-fix; 5 nits)

| ID | Sev | Location | Finding | Status |
|----|-----|----------|---------|--------|
| CODE-1 | should-fix | `GroupViewPage.tsx:129-172`, refetches `:326,:349` | Lazy loaders `loadBalances`/`loadSettleUp` (and post-mutation refetches) have no cancellation/staleness guard — both sibling effects in the same file guard async setState with a `cancelled` flag citing "PR #17 K-2 / S-1". On a param-only `groupId` transition with a fetch in flight, group A's response could render under group B; also setState-after-unmount. Trigger window is narrow (history nav + adverse ordering); no pinned TC exercises it. | open, non-blocking |
| CODE-2 | nit | `GroupViewPage.tsx:77-82` | Coder-flagged `SettlementDto.status` mismatch: verified — the GET view omits `status` (API `SettledPaymentView`), write routes carry it; `settlementStatus()`'s `undoneAt` fallback is load-bearing and correct for both shapes. Real fix lives in must-not-touch `packages/shared`. | open, non-blocking (routed, see CMP-1/UP-1) |
| CODE-3 | nit | `GroupViewPage.tsx:327-333` | No resync after a failed mark-paid/undo: a 409 keeps the stale suggestion rendered with a re-enabled button until a tab switch. Suggested: refetch the settle-up view on mutation failure. | open, non-blocking |
| CODE-4 | nit | `helpers/settlement-setup.ts:23,38-40,54,81-86` | Dead/speculative helper surface: `payerLabel` never passed, `TwoMemberGroup.code` never consumed, `openBalancesTab`'s `Locator` never used. | open, non-blocking |
| CODE-5 | nit | `helpers/timing.ts` / `balances-ui.spec.ts:44-56` | DRY: the T4 median+retry loop is copied a third time; suggestion-key template built twice (`markPaid` + render map); `measureTabMedian` hardcodes group name `'Trip'`. | open, non-blocking |
| CODE-6 | nit | `balances-ui.spec.ts` | No spec pins the non-party settle-up view (BR-BAL-006 UI aspect: neither payer nor recipient sees no Mark paid / Undo) — beyond the pinned TC list. | open, non-blocking |

### security-reviewer — verdict: **approve** (0 findings; 0 critical/high/medium/low)

No vulnerability names a plausible attack path. XSS clean (all user-controlled strings rendered as React text children/attribute values; zero `dangerouslySetInnerHTML`/`innerHTML` in `apps/web/src`; `data-status` values are a literal union). Ids pass through `encodeURIComponent`; the shared client rejects absolute/`//` paths, so origin smuggling is structurally impossible. AuthZ: `isSuggestionParty()` gates the affordances, and the server actually enforces the party rule (`settlements.service.ts:169` mark-paid, `:258` undo) plus `GroupMemberGuard` on every route — UI gating is UX layered over real enforcement. Data exposure: `UserRefDto` is `{id, displayName}` only (never email, FR-ACC-008); error text is the server's typed envelope; non-JSON bodies are discarded. No secrets (test `password-1`/`*@local` are throwaway fixtures), no new deps, no lockfile/config change.

- **SEC-OBS-1** (info, non-blocking): `financialError` is a single shared state across both tab loaders; the concurrent `Promise.all([loadSettleUp(), loadBalances()])` refetch means one failure can clear/overwrite the other's state. Correctness nit, follows the pre-existing single-error pattern. Not a vulnerability.

## Coder-flagged items — assessment (within gate, not exceeded)

1. **`SettlementDto.status` mismatch** — confirmed non-blocking and correctly handled. The frozen read contract `03-api-design.md` §3c lists `settled` **without** `status`; the shared `SettlementDto` over-specifies it. Since `undoneAt` is present **iff** undone, `settlementStatus()`'s `undoneAt` fallback reproduces §3c exactly. The coder correctly did **not** edit the fenced `packages/shared` DTO. The underlying doc/DTO contradiction is an **upstream defect → routed** (UP-1), not a PR finding.
2. **Intermittent e2e-only `409 SUGGESTION_STALE`** — assessed, not blocking. The code-reviewer walked every UI-side candidate and found **no UI race** in the TC-BAL-023/024 flows: unique per-test identities/groups, one click → one POST, `mutatingKey` disables the row (React 18 flushes discrete updates synchronously), and the e2e runs the production build (no StrictMode double-invoke). The likely culprit is **server-side**: `markPaid` runs at Serializable and maps Prisma `P2034` aborts to `409 SUGGESTION_STALE`; under `fullyParallel: true`, concurrent settlement transactions can spuriously abort under Postgres SSI. That is `apps/api` territory (must-not-touch) and the UI handles it correctly. Recorded as a follow-up observation (OBS-1), not a finding.

## Consolidation

| ID | Severity | Source | Status |
|---|---|---|---|
| CMP-1 | — (no violation) | compliance | n/a — compliant |
| UP-1 | upstream defect (shared DTO ↔ §3c) | compliance + code (CODE-2) | **routed** to planner/architect — not chargeable to this PR |
| CMP-NOTE-1 | nit (non-violation) | compliance | open, non-blocking (dup T4 helper — same as CODE-5) |
| CODE-1 | should-fix | code | open, non-blocking |
| CODE-2 | nit | code | open, non-blocking (= UP-1) |
| CODE-3 | nit | code | open, non-blocking |
| CODE-4 | nit | code | open, non-blocking |
| CODE-5 | nit | code | open, non-blocking |
| CODE-6 | nit | code | open, non-blocking |
| SEC-OBS-1 | info | security | noted, non-blocking |
| OBS-1 | info (API-side follow-up) | code + security | noted, non-blocking |

No blocking findings. No disputes (no fixer ran). One upstream-routing item (UP-1).

## Mergeability check (pass 1)

- Open **blocking** findings: **none** (any compliance violation / code-review blocker / critical-high security finding). CODE-1 is a should-fix — narrow-window race, no pinned TC, verdict approve — and nits/observations never block.
- CI: **green** on `e03bab8`.
- ⇒ **PR is MERGEABLE on pass 1** (clean first pass; loop ends early — no fixer dispatch, fixer/pass caps untouched).

## Verdict

Zero open blocking findings and green CI on `e03bab8` — **MERGEABLE on pass 1**. Non-blocking items recorded for the user/backlog: CODE-1 (cancellation-guard should-fix), CODE-2…CODE-6 (nits), SEC-OBS-1 (shared error state), OBS-1 (API-side P2034/SSI follow-up). Upstream routing: **UP-1** — reconcile `packages/shared` `SettlementDto` (requires `status`) with `03-api-design.md` §3c (read view omits it); the planner/architect — not the fixer — owns it, and the PR's `undoneAt` fallback is the correct defensible handling meanwhile.

> This artifact commit is docs-only and advances the PR head past `e03bab8`; CI will re-run on the new head. The pass-1 verdict above is for `e03bab8`, the commit all three lanes reviewed. Dispatched by the user: **merge when ready** — after the user confirms the merge, the ticket file's Status becomes `done` and the board is regenerated.
