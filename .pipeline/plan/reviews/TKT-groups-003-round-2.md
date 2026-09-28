# Review Round 2 — PR #19 (TKT-groups-003: Deciding join requests — approve, reject, re-request)

PR: https://github.com/sarperim/settleup/pull/19
Branch: `tkt-groups-003` → `dev` · Head at this pass: **`bfb7f16`** (post-fix; pass-1 head was `cad3b0f`) · Base: `ee56e5b` (`origin/dev` tip; merge-base verified)
Review date: 2026-09-28
Isolated checkout: `/home/sarp/review-tkt-groups-003` — branch `rl/tkt-groups-003` at `bfb7f16`. Tree clean at every gate (lead-verified after every lane and every probe run). Scratch namespace `/tmp/opencode/review-grp-003/`. Solo wave — no parallel review loops. Post-loop hygiene (lead-verified): all five lane/fixer/test `_g3r` databases at **zero rows by COUNT**; the e2e DB carries only its self-contained Playwright fixtures (recreated per run by design); zero leftover processes; zero listening ports in the review ranges.

This pass verifies fix round 1. Pass 1's record: `.pipeline/plan/reviews/TKT-groups-003-round-1.md` (this file's predecessor — findings K-1…K-3, C-1…C-5, S-3, verdicts, gate classification, and the full baseline-gate record).

## Fix round 1 (dispatched from round 1's artifact)

- **Fixer:** dispatched with the round-1 artifact; triaged 4 findings — 3 FIX, 1 DISPUTE, 0 ESCALATE; took the lead-sanctioned optional bundle. Report: `/tmp/opencode/review-grp-003/fixer-report.md`.
- **Commit `bfb7f16`** ("fix(groups): enforce PENDING gate in decide() transaction; map place() P2002 to 409"), pushed to `origin tkt-groups-003` (lead-verified: `git ls-remote` = PR headRefOid). Diff: exactly 2 files, +71/−14 — `apps/api/src/groups/join-request.service.ts` and `apps/api/test/integration/tc-grp-018-decide-authorization.spec.ts` (+1 line). Both inside the ticket's fence; nothing else touched (lead re-verified by direct diff query; compliance lane re-verified independently).
- **What the fix does:**
  1. **K-1 (the blocker):** `decide()`'s transaction now closes the request **conditionally first** — `tx.joinRequest.updateMany({ where: { id, status: 'PENDING' }, data: { status: decision, decidedAt } })`; `count === 0` → `notFound()`. The winner's row lock serializes every racing loser into the pinned `404 NOT_FOUND` for both race shapes (double-approve and approve-vs-reject — a decided request is outside the routes' domain per the amended 03 §3 note, which explicitly rejects decided→decided transitions). On APPROVED, `membership.create` carries a belt-and-braces P2002 catch → `notFound()`. The response row is re-read in-transaction (`findUnique`, same select) so the `{ joinRequest }` shape (incl. `requester`, `decidedAt`) is unchanged. The outer authorization pre-checks (missing → non-member → non-creator → decided) are kept **verbatim** — every non-raced error path is byte-identical to pass 1.
  2. **C-1:** `tc-grp-018` row 3 now calls `await expectNoSideEffects(fixture);` — the members-list half of the plan's step 4 is asserted on every failed row. Purely additive (+1 line, zero deletions).
  3. **K-2:** `listPending`'s docblock carries the sibling's "order is unspecified upstream" sentence. Comment-only.
  4. **Lead-sanctioned bundle (g-002's carried K-1):** `place()`'s create branch extracted to `createPendingRequest()` with P2002 → the byte-identical pre-existing `409 PENDING_REQUEST_EXISTS` (FR-GRP-012's pinned behavior; was an unhandled 500 on the race loser). Sequential path unchanged.
  5. New file-local helper `isUniqueConstraintViolation()` (mirrors the `groups.service.ts:41-46` precedent); new import `Prisma` from the existing `@prisma/client` (zero manifest/lockfile diff — verified).
  6. **K-3: DISPUTED** (not-worth-churn — pre-existing house idiom, refactor-scale). Non-blocking nit dispute; the finding's owner (code lane) accepted it this pass — closed-as-disputed, suggestion stays on record.

## Reviewer verdicts (pass 2, dispatched in parallel — all three lanes)

| Lane | Verdict | Blocking findings |
|------|---------|-------------------|
| compliance | **COMPLIANT** | 0 · C-1 **verified fixed** · C-2…C-5 unchanged · 1 new non-blocking observation (C-6) · the `place()` bundle adjudicated **in scope, sanctioned, no violation** |
| code | **APPROVE** | 0 · K-1 **verified fixed with the lane's own probes** · K-2 resolved · K-3 closed-as-disputed (accepted) · 1 new nit (K-4) |
| security | **APPROVE** | 0 · no new findings · all pass-1 authZ legs re-probed byte-identical on the new head · forced-P2002 path verified clean |

## Lead gates on `bfb7f16` (review-lead run)

- `DATABASE_URL=…settleup_test_g3r pnpm test` — **`Test Files 69 passed (69)`, `Tests 205 passed (205)`, exit 0** (51.7 s; counts unchanged — the C-1 assertion lives inside an existing test).
- `E2E_DATABASE_URL=…settleup_e2e_g3r PSQL=<shim> E2E_PORT=3023 pnpm test:e2e` — **exit 0** (system 1/1; Playwright chromium 7 passed, 4.4 s).
- CI on `bfb7f16`: run [36391563203](https://github.com/sarperim/settleup/actions/runs/36391563203) "Lint, test & build" **SUCCESS** (lead-verified via `gh pr checks 19`).
- All three pass-2 lanes independently ran the suite green on their own databases (69/205, exit 0 each); code lane re-ran lint + typecheck green; dist verified current (contains the fix) by lead, code lane, and security lane independently.
- **Lead re-probe of the fixed race** (own DB, port 3988, same script as pass 1's independent reproduction): scenario A (5× concurrent approve, 5 rounds) → `[200,404,404,404,404]` **every round** (pass 1: `[200,500,500,500,500]` with P2002 `unhandled_exception` logs); scenario B (concurrent approve+reject, 9 rounds) → **exactly one 200 per round, every loser 404, zero REJECTED+membership outcomes** (pass 1: both-200 ×10/10, REJECTED+membership 7/10); scenarios C/D unchanged benign. This is the **fourth** independent probe set confirming the fix (fixer, code lane A×6/B×22 incl. the reject-wins interleaving, security lane incl. a forced-P2002 rollback test, lead).

## Consolidated findings — status after pass 2

| ID | Severity | Source | Status | Resolution |
|----|----------|--------|--------|------------|
| K-1 | blocker (code) | code | **verified-fixed** (lead + code + security probes; compliance clean from its angle) | Commit `bfb7f16`: conditional in-transaction PENDING gate + P2002 catch; outer check order verbatim; response shape unchanged. The silent decided→decided transition and the 500-on-raced-loser are both gone; every race shape now lands on the contract answers. |
| C-1 | nit (compliance) | compliance | **verified-fixed** | `tc-grp-018` row 3 +1 line (`expectNoSideEffects`); plan step 4 asserted on every failed row; additive only. |
| K-2 | nit (code) | code | **verified-fixed** | Docblock sentence at `join-request.service.ts:153-154`; zero behavior change. |
| K-3 | nit (code) | code | **closed-as-disputed** (fixer disputed not-worth-churn; finding owner accepted) | House idiom (silent empty-display-name fallback, occurrences #3/#4); refactor suggestion stays on record for the next read-model ticket. Non-blocking; no arbitration needed. |
| K-4 | nit (code, NEW this pass) | code | open, non-blocking — fix-optional | `createPendingRequest()` lacks an explicit return-type annotation (every other method in the class annotates; inference is stable, typecheck green). One-line fold-into-next-touch. |
| C-2 | observation (compliance) | compliance | open, no action required | TC-019 per-row batched state reads; all plan facts asserted; no coverage hole. |
| C-3 | observation (compliance) | compliance | open, no action required | TC-018's dave fixture has no other-group membership; TC's own precondition satisfied; matters only for TC-GRP-021 (not this ticket's). |
| C-6 | observation (compliance, NEW this pass) | compliance | open, non-blocking — planner/user decision | The race-contract invariants this fix establishes (decide race loser → 404; exactly-once membership; place race loser → 409) are verified by probes only — no automated regression spec. The plan pins no concurrency TC, so nothing is missing per the checklist; the vehicle for pinning them is a plan amendment / hardening ticket. |
| S-3 | low (security) | security | open, non-blocking — contract-level hardening | Unbounded `listPending` (no `take`); contract pins no cap for this route. Route to planner/hardening (pin a cap/pagination in 03 §3 mirroring the expenses cap-500, and/or throttle placement). Bundle with S-1/S-2. |
| S-1 | low (security, carried from g-002) | security | open, non-blocking — hardening bundle | Join-info probe oracle; calculus unchanged by this PR (requestId oracle strictly weaker — cuid2, member-group-only signal). |
| S-2 | low (security, carried from g-002, deadline-bearing) | security | open, non-blocking — dormant with proof on this head too | `joinCode` still absent from `REDACTED_KEYS` (`common/logging/logger.ts` — outside this ticket's fence). Zero logging calls in the new code; zero join codes in server logs across pass-1 and pass-2 live probes. Recommendation stands: one-liner (`joinCode`, NOT `code`) at/before the next groups merge or pinned on the next groups/hardening ticket. |
| C-4 | planning defect (compliance) | compliance | **routed upstream — planner** | TC-GRP-018 expected-4's "(alice only)" parenthetical contradicts its own precondition; the PR's faithful substitution adjudicated acceptable-as-is. Planner fixes the parenthetical; fold in C-1-class literalness when the plan is touched. Untouched by the fix (correct). |
| C-5 | planning defect (compliance) | compliance | **routed upstream — planner/test-planner** (continues g-002's P-2) | No plan amendment yet re: TC-009/011/012's verification vehicle; the PR correctly left the old specs untouched; `joinAndApprove` is landed and exercised, so a future migration is unblocked. |

**Carried items closed by this loop:** g-002 **K-1** (place() race → 409, fixed via the sanctioned bundle and verified by four probe sets); g-002 **K-6/C-2** (REJECTED→PENDING flip coverage — closed by TC-GRP-015 in pass 1). **Carried items still open:** g-002 K-2 (half-closed: `joinAndApprove` exists; migration is the planner's C-5), K-3 (requireUserId — still 2 copies, trigger not fired), K-4 (fallback idiom — folded into this round's K-3 disposition), S-1, S-2.

## Mergeability (pass 2)

Open blocking findings (compliance violation / code-review blocker / critical-high security): **ZERO.**

- Compliance: **compliant** — zero violations across both passes; the fix commit introduced none; the `place()` bundle adjudicated in-scope.
- Code: **approve** — the pass-1 blocker is verified fixed with the lane's own reproduction; one new cosmetic nit (K-4), non-blocking.
- Security: **approve** — zero critical/high/medium across both passes; the fix introduces no security regression (envelope-identical new error paths, no oracle, no partial state, forced-P2002 rollback clean).

**RESULT: MERGEABLE on pass 2 — the loop ends early on a clean pass.** Pass 3 and the second fix round unused.

## Loop status

- Pass 1 (round-1 artifact): 3 lanes parallel → 1 blocker (K-1) → not mergeable → fixer dispatched.
- Fix round 1: commit `bfb7f16` (K-1 fixed, C-1 + K-2 taken, K-3 disputed, sanctioned `place()` bundle taken).
- Pass 2 (this round): 3 lanes parallel, all verifying prior findings resolved and auditing the fix commit → zero open blocking findings → **MERGEABLE**.
- **User action requested: merge PR #19** (head `bfb7f16`). After merge confirmation, the ticket's status moves to `done` and the board can be regenerated.
- Open non-blocking follow-ups recorded above for the next owner (user's call: follow-up ticket, hardening bundle, or waive): **K-4** (return-type annotation), **C-6** (pin the race invariants in a spec via a plan amendment), **C-2/C-3** (literalness/roster observations), **S-3** (listPending cap/pagination — contract decision), **S-1/S-2** (hardening bundle; S-2's one-liner recommended at/before the next groups merge), plus upstream **C-4/C-5** (planner/test-planner).
- Non-blocking dispute resolved within the loop (no user arbitration required): **K-3** — fixer disputed, finding owner (code lane) accepted; recorded here and in the fixer report.
- Post-loop: the merge was granted by the user (the merge authority — the loop never merges). This artifact and its round-1 predecessor are committed to the PR branch as a single docs-only commit (`docs(reviews): …`, gitignored `reviews/` dir force-added per the established pattern) on the user's explicit go-ahead, so the review history lands in `dev` via the merge; the PR head moves forward by this docs-only commit and CI re-runs on it (expected green — touches only `.pipeline/plan/`).
