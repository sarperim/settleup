# Review Round 1 — PR #19 (TKT-groups-003: Deciding join requests — approve, reject, re-request)

PR: https://github.com/sarperim/settleup/pull/19
Branch: `tkt-groups-003` → `dev` · Head at review: `cad3b0f` · Base: `ee56e5b` (= `origin/dev` tip; merge-base verified)
Review date: 2026-09-28
Isolated checkout: `/home/sarp/review-tkt-groups-003` — branch `rl/tkt-groups-003` at `cad3b0f` (same commit as the PR head). Tree clean at review start and at every gate (lead-verified after every lane). Scratch namespace `/tmp/opencode/review-grp-003/`. No parallel review loop (solo wave — verified no other `_g3` review DBs in use, no concurrent loops). All five `_g3r` databases (`settleup_test/e2e/review_c/review_k/review_s`) provisioned by the lead with migrations applied; this ticket is in NO parallel group, so no cross-loop fencing was needed.

Scope context: third domain ticket of Groups & Membership (solo wave) — the decision half of C3: the creator-only pending list `GET /api/groups/:groupId/join-requests`, and `POST /api/join-requests/:requestId/approve` / `.../reject` with the amended 03 §3 check order, plus the strategy §5 `joinAndApprove` factory, per `.pipeline/plan/tickets/TKT-groups-003.md`.

Environment note: three reviewer sessions — `compliance-reviewer`, `code-reviewer`, `security-reviewer` — dispatched concurrently via `opencode run` against this checkout, each with its own provisioned PostgreSQL (`settleup_review_c_g3r` / `_k_g3r` / `_s_g3r`; the lead used `settleup_test_g3r` + `settleup_e2e_g3r` on port 3023 for the e2e chain). Every claim in the PR body's implementation record was re-verified; nothing was trusted. Full lane reports preserved at `/tmp/opencode/review-grp-003/{compliance,code,security}-report.md`.

## Blast radius gate (pass-1 dispatch decision)

**Classification: FULL — all three review lanes run.** Reasoning recorded:

- The diff ships executable API logic: a new public read endpoint (`groups.controller.ts`: `GET :groupId/join-requests` behind two guards), two new public account-scoped write endpoints (`join-flow.controller.ts`: approve/reject), 108 lines of new service logic (`join-request.service.ts`: `listPending` read model + `decide()` with authorization checks and a transaction that creates membership), and test-support factory code (`factories.ts`: +65/−2) — plus 7 new integration spec files. Not presentation-only, not non-executable, not comment/formatting-only — every LOW condition fails.
- New authorization-relevant surfaces: a creator-only list route and two decision routes whose entire contract is a fixed authorization check order with 404-indistinguishability guarantees — squarely in the security lane's remit, and a write transaction with concurrency semantics — squarely in the code lane's.
- The ticket pins automated acceptance TCs (TC-GRP-013/014/015/017/018/019/020) — the compliance lane must verify them.

## Scope fence (allowed set) — verified held exactly (lead + compliance lane, independently)

`git diff --name-status origin/dev...HEAD`: exactly 12 files, no renames, no mode changes (+1007/−3):

| File | Change |
|---|---|
| `.pipeline/plan/tickets/TKT-groups-003.md` | status `todo`→`in-review (PR #19)` only (verified — nothing else changed) |
| `apps/api/src/groups/groups.controller.ts` | +19 — the list route behind `GroupMemberGuard` + `GroupCreatorGuard` |
| `apps/api/src/groups/join-flow.controller.ts` | +42 — the two decide routes |
| `apps/api/src/groups/join-request.service.ts` | +108 — `listPending` + `decide` + helpers |
| `apps/api/test/integration/support/factories.ts` | +65/−2 — `placeJoinRequest` + `joinAndApprove` (pinned deliverable, ticket L11) + `seedMembership` docblock reword |
| `apps/api/test/integration/tc-grp-{013,014,015,017,018,019,020}-*.spec.ts` | new (7 files, 11 tests) |

**Zero changes** (verified by direct path-filtered diff query — 0 lines each) to `apps/web/**`, `packages/shared/src/**`, `apps/api/prisma/**`, `apps/api/src/auth/**`, root `package.json`, `pnpm-lock.yaml`, `.github/**`, any `package.json`, any pre-existing spec file. No new dependencies. The `factories.ts` touch is in scope via the ticket's pinned `joinAndApprove` deliverable (compliance lane adjudicated explicitly).

## Reviewer verdicts (pass 1, dispatched in parallel)

| Lane | Verdict | Blocking findings |
|------|---------|-------------------|
| compliance | **COMPLIANT** | 0 violations · 1 nit (C-1) · 4 observations (C-2…C-5; C-4/C-5 planning defects routed upstream) |
| code | **REQUEST CHANGES** | **1 blocker (K-1)** · 2 nits (K-2, K-3) |
| security | **APPROVE** | 0 critical/high/medium · 1 new low (S-3) |

The code lane's request-changes verdict carries **one blocker-tier finding (K-1)** — reproduced by the reviewer, re-reproduced independently by the lead (below). Per the immutable mergeability rule, a code-review blocker blocks regardless of the other lanes' clean verdicts.

## Baseline gates (review-lead run, from scratch in the isolated worktree)

- `pnpm install` — exit 0 (fresh worktree, 2.4 s from the shared store). `pnpm --filter api exec prisma generate` — exit 0.
- `pnpm lint` — exit 0 (shared, api, web). `pnpm typecheck` — exit 0 (shared, api, web).
- `pnpm build` — exit 0 (`apps/api/dist/main.js`, `apps/web/dist/` emitted; tree pre-built for the lanes — no lane ran a concurrent build).
- `DATABASE_URL=postgresql://settleup:settleup@127.0.0.1:5432/settleup_test_g3r pnpm test` — **`Test Files 69 passed (69)`, `Tests 205 passed (205)`, exit 0** (50.4 s) — matches the PR body's claim exactly (baseline 62/194 + 7 files/+11 tests; delta arithmetic verified by the lead AND independently by the compliance lane: the 7 new spec files contain exactly 11 `it(` blocks, 1+1+1+1+3+3+1).
- **The real e2e phase:** `E2E_DATABASE_URL=…settleup_e2e_g3r PSQL=<node shim> E2E_PORT=3023 pnpm test:e2e` — **exit 0**: e2e-db (database exists, migrations applied) → `pnpm test:system` **1/1 passed** → Playwright chromium **7 passed** (canary + TC-ACC-023…027 + TC-GRP-026, 4.6 s).
- CI on head `cad3b0f`: run [36385789555](https://github.com/sarperim/settleup/actions/runs/36385789555) "Lint, test & build" **SUCCESS** (lead-verified via `gh pr checks 19`).
- All three reviewer sessions independently ran the suite green (**69/205, exit 0** each, own databases — 63.5 s / ~60 s; compliance also re-ran lint + typecheck green).
- **Lead spot-checks of the lanes' most consequential claims:** (1) **K-1 independently re-reproduced by the lead** on its own DB (`settleup_test_g3r`, port 3988, lead copy of the reviewer's script `/tmp/opencode/review-grp-003/lead-race-decide.cjs`): scenario A (5× concurrent approve, 5 rounds) → `[200,500,500,500,500]` / `[200,404,500,500,500]` — the racing losers surface `500 INTERNAL` (P2002 `unhandled_exception` server logs captured) where the contract pins `404 NOT_FOUND`; scenario B (concurrent approve+reject, 10 rounds) → **both `200` in 10/10**, final state `REJECTED` + membership row in **7/10** (reviewer saw 6/10 — same defect, timing variance) — a silent decided→decided transition producing a persistent `REJECTED`-row-with-membership state; scenarios C (approve racing re-request flip) and D (two approves, different rows) verified benign. (2) C-1 verified by direct read: `tc-grp-018` row 3 (L144–159) asserts only request-remains-PENDING; rows 1–2 call `expectNoSideEffects` (L122, L141). (3) The plan's TC-GRP-018 parenthetical contradiction verified by direct read (plan L235 "(alice only)" vs L225 "bob is a member (not creator)"). (4) The worktree was clean after every lane (reviewers modified nothing).

## Compliance lane (summary)

- **TC coverage:** all seven acceptance TCs present and faithfully translated — TC-GRP-013/014 (all four steps each, incl. `decidedAt` presence — it is exposed — and the emptied pending list `toEqual({ requests: [] })`), TC-GRP-015 (all three verification vehicles: 201 PENDING with same-row id reuse, exactly-one-pending via the list, direct table read with `decidedAt` null — **closes the g-002 K-6/C-2 flip-coverage hand-off**), TC-GRP-017 (exact `{ id, displayName: "Carol" }` requester ref + 403 with `NOT_GROUP_CREATOR` code + email-absence hardening), TC-GRP-018 (three rows from fresh fixtures, exact codes, no-side-effect invariants — one nit C-1: row 3 misses the members-list half), TC-GRP-019 (rows a/b/c incl. the amendment's combined case, status + member-set invariance per row — state reads batched per row, observation C-2, no coverage hole), TC-GRP-020 (exact empty shape). Strengthenings (exact outer key sets, same-row-id, email-absence) are additions, not weakenings. No `.skip`/`.only`/`.todo`/commented-out expects (grep-verified); every state-changing POST carries `CSRF_HEADERS`; truncate-per-test in all 7 files. Count 1+1+1+1+3+3+1 = 11 ✓.
- **Scope:** held exactly (independently re-verified by direct diff query — see the fence table above).
- **Architecture:** 03 §3 rows and the amended "Approve/reject semantics" note verified step by step in `decide()` (missing → non-member → non-creator → decided; authorization precedes request-state; requester-self in the non-member class via `place()`'s ALREADY_MEMBER check — FR-GRP-013); guard layering per 01 §8.1 (layer 2 `GroupMemberGuard` 404-hides, layer 3 `GroupCreatorGuard` 403s); 02 §5.3 approve-transaction semantics; no new error codes; FR-ACC-008 display-name projection (never email).
- **Gold-plating:** none at capability level (`listPending`'s `createdAt asc` ordering is an unpinned implementation choice — code lane's K-2 doc nit, not scope creep; `placeJoinRequest`/`notFound()` load-bearing).
- **Implementation record:** every checkable claim verified true (69/205, baseline arithmetic, scope fence, CI, lint/typecheck re-ran green; red proof verified by reasoning with per-file failure analysis).

## Code lane (summary)

Verified correct, on record: the `decide()` check order exactly per the amended note; routes/guards/status codes per §3; error mapping to the standard envelope; `:requestId` needs no validation pipe (consistent with every `:id` param in the codebase — unknown ids flow to `findUnique` → 404, pinned by TC-GRP-018 row 3); `requireUserId` count stays 2 (no third copy — the new routes reuse join-flow's); all 7 specs deterministic with loud-failure factories.

**One blocker finding (K-1, detail in the table below):** check-then-act race in `decide()` — the PENDING pre-check runs outside the transaction and the closure write is unconditional, so concurrent decisions escape the contract two ways: (A) concurrent double-approve → the loser's `membership.create` hits `@@unique(groupId,userId)` P2002 → unhandled → **500 INTERNAL where the contract pins 404** (constraint holds, retry correct); (B) concurrent approve+reject → **both return 200** and the final state can be `REJECTED` + membership — a **silent decided→decided transition** that the architect amendment explicitly rejected ("would imply a decided→decided transition that does not exist; TC-GRP-019 asserts no state change") plus a persistent state contradicting 02 §5.3's `PENDING → REJECTED (no membership)` (BR-GRP-004). Reproduced by the reviewer (A ×5/5 rounds; B both-200 ×10/10, REJECTED+membership 6/10) AND independently by the lead (A ×5 rounds; B both-200 ×10/10, REJECTED+membership 7/10). Mitigations acknowledged: creator-only single-actor self-race, no privilege boundary crossed, membership created is one the creator was authorized to create, PR #18 merged with the equivalent finding carried — but symptom B is silent (worse than a 500), 100% reproducible, and the second consecutive ticket shipping the same race family into the same file after g-002 recommended a fix "at 003". Fix (small, precedented, in-scope): close the request conditionally FIRST inside the transaction (`updateMany` with `status: 'PENDING'` in the where; 0 rows updated → throw `notFound()`), then create membership on approve; belt-and-braces P2002 catch per the `groups.service.ts:41-46` precedent.

Two nits: **K-2** — `listPending`'s `createdAt asc` ordering is unpinned upstream without the sibling's "order is unspecified upstream" docblock note (one sentence; cf. `membership.service.ts:63-65`). **K-3** — the silent empty-display-name fallback idiom replicated (occurrences #3 and #4 of the house pattern; six total in `apps/api/src`).

## Security lane (summary)

Verified clean: **AuthN** — all three new routes behind the global `AuthGuard`, anonymous → 401 (live). **AuthZ** — list route: creator 200 / member non-creator 403 / non-member + other-group member + unknown-group 404 **byte-identical**; decide routes: every leg of the pinned order verified live, requester self-approve/self-reject → 404 identical to unknown-id (self-decision structurally impossible), cross-group both directions → identical 404 (no oracle); 403s carry code+message only. **CSRF** — both POSTs → `403 CSRF_HEADER_MISSING` without the header (middleware covers the paths). **Injection** — typed parameterized Prisma only; malformed ids (injection strings, `$where`, `{"$ne":null}`, 100k chars) → uniform 404 / route-agnostic 431, never 5xx. **Transaction reachability** — `membership.create` unreachable by any non-creator path. **Logs/PII** — zero logging calls in the new code; zero join codes in server logs across ~70 live requests (S-2 dormancy proof); requester refs are `{id, displayName}` only. **Deps/config** — lockfile and package.jsons zero-diff. One new low finding (**S-3**): `listPending` is an unbounded read (no `take`) — pending rows are the one group-scoped collection that grows through unattended self-service (any code holder, one row per registered user), so a scripted attacker can balloon the creator's list; bounded by the 2^40 code space and the domain's nuisance-acceptance (OQ-GRP-002); the contract pins no cap for this route (the expenses cap-500 is pinned elsewhere) — a contract-level hardening decision, not a code fix this PR could make without inventing contract. Carried S-1 calculus unchanged (the new requestId oracle is strictly weaker — cuid2 ~125 bits, 403-vs-404 only for one's own member groups); the double-approve 500 race reproduced with a fully generic envelope (no internals, DB consistent) — no security angle.

## Consolidated findings

IDs scoped to this PR/round. **One blocking finding (K-1).** Nits and observations never block.

| ID | Severity | Source | Location | Status | Summary |
|----|----------|--------|----------|--------|---------|
| K-1 | **blocker (BLOCKS MERGE)** | code | `join-request.service.ts:192-246` (`decide()` — pre-checks :197/:220-222 outside the tx; unconditional `tx.joinRequest.update` :234-238; `tx.membership.create` :226-232 without P2002 handling) | **open — reviewer-reproduced AND lead-reproduced** | Check-then-act race in `decide()`: (A) concurrent double-approve → loser hits P2002 on `@@unique(groupId,userId)` → unhandled → **500 INTERNAL instead of the pinned 404 NOT_FOUND** (contract: decided request → 404); constraint holds, retry correct. (B) concurrent approve+reject → **both 200** in 10/10 lead+reviewer rounds, final state `REJECTED`+membership in 7/10 (lead) / 6/10 (reviewer) — a **silent decided→decided transition** the architect amendment explicitly rejected, producing a persistent state contradicting 02 §5.3 (BR-GRP-004: `PENDING → REJECTED` means no membership). Same defect family as g-002 K-1 (`place()`), second consecutive ticket. Fix: conditional closure first inside the transaction (`tx.joinRequest.updateMany({ where: { id, status: 'PENDING' }, data: {...} })`; `count === 0` → `notFound()`), then `membership.create` on approve; optional P2002 → `notFound()` catch per `groups.service.ts:41-46`. |
| C-1 | nit (non-blocking) | compliance | `tc-grp-018-decide-authorization.spec.ts:144-159` (row 3) | open | Plan L226-230/L235 demand the members-list check after **every** failed row; row 3 asserts only request-remains-PENDING (rows 1-2 use `expectNoSideEffects`). Logically implied (nonexistent-id path throws before any mutation) but the plan's step is literal. One-line fix: `await expectNoSideEffects(fixture);`. Also aligns the spec-header claim. |
| K-2 | nit (non-blocking) | code | `join-request.service.ts:161` | open | `listPending`'s `orderBy: { createdAt: 'asc' }` is an unpinned choice without the sibling read model's "order is unspecified upstream" docblock note (cf. `membership.service.ts:63-65`). One sentence. |
| K-3 | nit (non-blocking) | code | `join-request.service.ts:168, 244` | open | Silent empty-display-name fallback `?? { id, displayName: '' }` — occurrences #3/#4 of the house idiom (g-002 K-4/C-4), six total in `apps/api/src`. Refactor-scale; not worth churn in this ticket. |
| C-2 | observation (non-blocking) | compliance | `tc-grp-019-decide-decided.spec.ts:100-145` | open — no action required | State reads batched once per row (after both calls) instead of after each call; all plan facts still asserted; net-effect verification catches every realistic regression. Strict-literality improvement only. |
| C-3 | observation (non-blocking) | compliance | `tc-grp-018-decide-authorization.spec.ts:127-132` | open — no action required | Spec's dave has no other-group membership (conventions header describes him as member of another group); TC-018's own precondition ("registered non-member of Trip") is satisfied and the asserted contract is unaffected. Matters only for TC-GRP-021 (not this ticket's acceptance). |
| S-3 | low (non-blocking) | security | `join-request.service.ts:157-171` (`listPending`) | open, non-blocking — routed to planner/hardening | Unbounded `findMany` (no `take`): pending rows grow through unattended self-service (any code holder, one row per registered user; registration + placement unthrottled). Creator-facing payload/DB growth, not disclosure. Contract pins no cap for this route — fix is a contract-level decision (pin a cap/pagination in 03 §3 mirroring the expenses cap-500, and/or throttle placement per (IP, group)). Bundle with S-1/S-2 hardening. |

**Upstream routings (planning defects, not PR violations — the fixer fixes code, not documents):**

- **C-4 (route to planner):** TC-GRP-018 expected-result 4's parenthetical "members list unchanged **(alice only)**" contradicts the same TC's precondition ("bob is a member (not creator)" — required for row 1's 403 to be exercisable). The precondition must win; the parenthetical is the defect. The PR's substitution (member set `{alice, bob}` unchanged, carol never added, request PENDING) is the faithful reading — adjudicated **acceptable-as-is with upstream routing** by the compliance lane; the lead verified the contradiction by direct read. Planner: fix the parenthetical (e.g. "unchanged (the precondition set — alice and bob)" or drop it). Fold in C-1's one-liner when the plan is touched.
- **C-5 (route to planner/test-planner — continues g-002's P-2, still open):** no plan amendment exists yet re: TC-GRP-009/011/012's verification vehicle (direct `join_requests` reads / `seedMembership`). The ticket consequently pins no migration; the PR correctly left the old specs untouched (adjudicated acceptable-as-is). Planner: either permanently sanction the technique or pin a migration ticket (noting TC-GRP-011's `count() === 0` becomes `1` under the real `joinAndApprove` — g-002 C-3). `joinAndApprove` is now landed and exercised, so the migration is unblocked whenever the planner calls for it.

## Deviation adjudications (the coder's three flagged items)

- **A-1 (TC-GRP-018 expected-result-4 parenthetical) — acceptable-as-is with upstream routing (C-4); NOT a violation.** The plan self-contradiction is real (lead-verified); the precondition must win or row 1 is unexercisable. The substituted invariant is the faithful reading of expected 4's operative clause ("no failure path establishes membership or closes the request") — member set `{alice, bob}` unchanged, carol never added, request PENDING on every row. Residual literal gap recorded independently as C-1 (row 3's missing members GET — unrelated to the parenthetical). Routed upstream as C-4.
- **A-2 (deferred migration of PR #18's specs) — acceptable-as-is; the correct reading.** The ticket's "add specs" means this ticket's TCs; TC-009/011/012 are TKT-groups-002's adjudicated acceptance (g-002 A-1/A-3). Migrating here would alter another ticket's acceptance specs without a plan amendment and force re-interpreting TC-GRP-011's `count() === 0` (g-002 C-3). Strategy §5's API-driven-write-path demand is met by every NEW spec (preconditions via `placeJoinRequest`/`joinAndApprove`; the only direct reads are the sanctioned ones). `joinAndApprove` landed and exercised. P-2 stays open upstream (C-5).
- **A-3 (no out-of-scope changes) — verified true by direct query** (both lanes independently; see the fence table).

## Mergeability (pass 1)

Open blocking findings (compliance violation / code-review blocker / critical-high security): **ONE — K-1 (code lane, blocker).**

- Compliance: **compliant** — zero violations; C-4/C-5 are planning defects routed upstream.
- Code: **one blocker (K-1)** — reproduced by the reviewer and independently by the lead; the lane explicitly assigned the blocker tier with argued severity (acknowledging the g-002 K-1 precedent and its mitigations, and explicitly leaving the downgrade-vs-carry decision to the user).
- Security: zero critical/high (one low S-3, non-blocking).

**RESULT: NOT MERGEABLE on pass 1.** The loop continues per its fixed sequence: fixer dispatch (round 1) → pass 2 verification. The user may at any point waive K-1 (accepting the carry, as PR #18 did with the equivalent finding) — that decision belongs to the user alone; the loop does not waive findings itself.

## Carried items from prior rounds — status record (inputs weighed, not waived)

| Item (g-002 ID) | Status in this PR |
|---|---|
| K-1 — concurrent same-user `POST /api/join-requests` P2002 → 500 instead of 409 (in `place()`) | **Still present, byte-untouched** (as the ticket demands — not a deliverable). Same defect family as this round's K-1; the code lane's fix pattern applies identically. Remains open non-blocking debt; user's call (fixer bundle / follow-up ticket / waive). **Lead note for the fixer dispatch:** fixing it alongside K-1 is sanctioned if the fixer judges it in scope — same file, same pattern, closes a contract-pinned behavior (FR-GRP-012's 409); it is NOT required for mergeability. |
| K-2 — no member+APPROVED-row fixture | **Half-closed:** `joinAndApprove` now creates exactly that state through the public API; `tc-grp-011` still seeds without the row (migration is the planner's call, C-5). |
| K-3 — `requireUserId` "extract at three" | **Not worsened:** still exactly 2 copies; this PR added none. |
| K-4/C-4 — silent empty-display-name fallback | **Grown by two** (this round's K-3) — nit, house idiom. |
| K-6/C-2 — REJECTED→PENDING flip coverage handed to TC-GRP-015 | **CLOSED** — TC-GRP-015 asserts the flip end-to-end (same-row id reuse, exactly one row, PENDING, `decidedAt` null); a `decidedAt`-not-cleared regression fails the spec. |
| S-1 — join-info probe oracle (low) | **Unchanged** (calculus re-verified; the new requestId oracle is strictly weaker). Hardening bundle. |
| S-2 — `joinCode` absent from `REDACTED_KEYS` (low, deadline-bearing) | **Dormant with empirical proof** (zero logging calls in the new code; zero codes in logs across all live probes). Outside this ticket's scope fence. g-002's recommendation stands: one-liner at/before a near-term merge or pinned on the next groups/hardening ticket; add `joinCode`, NOT `code`. |
| g-002 P-2 | **Continues as C-5** (upstream, planner/test-planner). |

## Loop status

- Pass 1 (this round): all three lanes dispatched in parallel; **one open blocking finding (K-1)** → NOT mergeable → **fixer dispatched (fix round 1)** with this artifact. Pass 2 will verify the fix and check the fix commits for new problems; reviewers never trust the fixer's self-report.
- Fixer mandate (triage per its contract): **K-1 must be fixed** (or disputed with evidence → immediate user arbitration). C-1 and K-2 are trivial one-liners — fix if taken. K-3/K-2-tier nits may be disputed as not-worth-churn. The g-002 K-1 `place()` catch is an explicitly sanctioned optional bundle (see the carried-items table). S-3/S-1/S-2 and C-4/C-5 are NOT fixer items (contract-level / upstream).
- Open non-blocking follow-ups recorded for the user: C-1, K-2, K-3, C-2, C-3, S-3 + carried S-1, S-2, g-002 K-1/K-2/K-3, upstream C-4/C-5.

Ticket status remains `in-review` — the merge decision and the `done` transition belong to the user.
