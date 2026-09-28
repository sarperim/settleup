# Review Round 1 — PR #20 (TKT-groups-005: Groups contract & scale — CSRF, multi-group, full-scale fixture, retention)

PR: https://github.com/sarperim/settleup/pull/20
Branch: `tkt-groups-005` → `dev` · Head at review: `c6fd417` · Base: `425fb1e` (= `origin/dev` tip; merge-base verified — the PR is a clean descendant of dev's tip)
Review date: 2026-09-28
Isolated checkout: `/home/sarp/review-tkt-groups-005` — branch `rl/tkt-groups-005` at `c6fd417` (same commit as the PR head). Tree clean at review start, after every lane, and at every gate (lead-verified; reviewers modified nothing — confirmed by `git status` after all three lanes). Scratch namespace `/tmp/opencode/review-grp-005/`. **Parallel group P-5:** TKT-groups-006 (PR #21, join-flow UI) reviewed CONCURRENTLY by another review-lead on its own worktree `/home/sarp/review-tkt-groups-006` — never touched; all databases in this loop use the fresh `_g5r` suffix (no collision with the sibling loop). All five `_g5r` databases (`settleup_test/e2e/review_c/review_k/review_s`) provisioned by the lead with migrations applied.

Scope context: verification-only, test-only ticket — the cross-route and scale acceptance specs that needed all routes from TKT-groups-001…003 to exist: TC-GRP-022 (CSRF on the 4 state-changing routes), TC-GRP-023 (multi-group membership), TC-GRP-024 (full-scale fixture 8 users / 5 groups / one 8-member group), TC-GRP-025 (lifecycle retention via direct table reads), per `.pipeline/plan/tickets/TKT-groups-005.md`.

Environment note: three reviewer sessions — `compliance-reviewer`, `code-reviewer`, `security-reviewer` — dispatched concurrently via `opencode run` against this checkout, each with its own provisioned PostgreSQL. Every claim in the PR body's implementation record was re-verified by the lead (including both mutation probes, re-run in a throwaway copy — never in the shared worktree); nothing was trusted. Full lane reports preserved at `/tmp/opencode/review-grp-005/{compliance,code,security}-report.md`.

## Blast radius gate (pass-1 dispatch decision)

**Classification: FULL — all three review lanes run.** Reasoning recorded:

- The diff adds four executable integration spec files (+602 lines of test code) — not presentation-only, not non-executable, not comment/formatting-only. The LOW gate's "no test files touched" condition fails on its face.
- The ticket pins automated acceptance TCs (TC-GRP-022/023/024/025 green) — the compliance lane must verify them. The LOW gate's "no pinned acceptance TCs" condition fails.
- TC-GRP-022 pins CSRF enforcement on four routes — squarely security-relevant; the security lane must confirm the spec genuinely binds the gate (not satisfiable by an unrelated 403).
- The fifth touched file (ticket status line) is non-executable markdown, but it cannot carry the classification alone. Ambiguous = full; nothing here is ambiguous.

## Scope fence (allowed set) — verified held exactly (lead + compliance lane, independently)

`git diff origin/dev...HEAD`: exactly 5 files, no renames, no mode changes (+603/−1):

| File | Change |
|---|---|
| `.pipeline/plan/tickets/TKT-groups-005.md` | status `todo`→`in-review (PR #20)` only (verified — every other line byte-identical) |
| `apps/api/test/integration/tc-grp-022-csrf-groups-routes.spec.ts` | new (130 lines, 1 test) |
| `apps/api/test/integration/tc-grp-023-multiple-memberships.spec.ts` | new (137 lines, 1 test) |
| `apps/api/test/integration/tc-grp-024-full-scale-fixture.spec.ts` | new (171 lines, 1 test) |
| `apps/api/test/integration/tc-grp-025-lifecycle-retention.spec.ts` | new (164 lines, 1 test) |

**Zero lines** (verified by direct path-filtered diff query — 0 lines each, lead and compliance lane independently) to `apps/web/**`, `packages/**`, `apps/api/prisma/**`, `apps/api/src/**` (no production change at all — no defect fixes surfaced, consistent with the ticket's "minimal defect fixes … if defects surface"), root `package.json`, `pnpm-lock.yaml`, any `package.json`, `.github/**`, any pre-existing spec or `support/` helper file. No new dependencies. **P-5 parallel-merge fence intact:** this PR writes only `apps/api/test/integration/**` + the ticket file; TKT-groups-006 writes `apps/web/**` only — disjointness holds exactly as the ticket's parallel-group line declares.

## Reviewer verdicts (pass 1, dispatched in parallel)

| Lane | Verdict | Blocking findings |
|------|---------|-------------------|
| compliance | **COMPLIANT** | 0 violations · 1 nit (C-1) · 2 observations routed upstream (C-2, C-3 — planning defects) |
| code | **APPROVE** | 0 blockers · 0 should-fix · 4 nits (K-1…K-4) |
| security | **APPROVE** | 0 findings at any severity · carried S-2/R-2 re-proved dormant on this head (live probe) |

## Baseline gates (review-lead run, from scratch in the isolated worktree)

- `pnpm install` — exit 0 (fresh worktree, 2.6 s from the shared store). `pnpm --filter api exec prisma generate` — exit 0.
- `pnpm lint` — exit 0 (shared, api, web). `pnpm typecheck` — exit 0 (shared, api, web).
- `pnpm build` — exit 0 (`apps/api/dist/main.js`, `apps/web/dist/` emitted; tree pre-built for the lanes — no lane ran a concurrent build).
- `DATABASE_URL=postgresql://settleup:settleup@127.0.0.1:5432/settleup_test_g5r pnpm test` — **`Test Files 73 passed (73)`, `Tests 209 passed (209)`, exit 0** (60.2 s) — matches the PR body's claim exactly (baseline 69/205 at merge-base; delta +4 files / +4 tests — arithmetic lead-verified AND independently by the compliance and code lanes: the 4 new spec files contain exactly one `it(` each; 77 spec files at HEAD vs 73 at base, the 4 Playwright e2e specs excluded from vitest on both sides).
- **The real e2e phase:** `E2E_DATABASE_URL=…settleup_e2e_g5r PSQL=<node shim> E2E_PORT=3025 pnpm test:e2e` — **exit 0**: e2e-db (database exists, migrations applied) → `pnpm test:system` **1/1 passed** → Playwright chromium **7 passed** (canary + TC-ACC-023…027 + TC-GRP-026, 4.9 s).
- CI on head `c6fd417`: run [36394837121](https://github.com/sarperim/settleup/actions/runs/36394837121) "Lint, test & build" **SUCCESS** (lead-verified via `gh pr checks 20`).
- All three reviewer sessions independently ran the suite green on their own databases (**73/209, exit 0** each — 89.4 s / 98.8 s / 97.6 s; compliance and code also re-ran the 4 new specs standalone, 4/4; code re-ran lint + typecheck green).
- **Lead re-verification of the PR body's mutation-probe evidence** (the ticket's non-vacuity proof — verification-only ticket, no natural red exists by construction): re-run in a throwaway copy at the same commit (`/tmp/opencode/review-grp-005/mut`, since removed; the shared worktree was never mutated):
  - **Mutation A** (CSRF middleware `STATE_CHANGING_METHODS` emptied): TC-GRP-022 **failed** `AssertionError: expected 201 to be 403` (the header-less create sailed through); the other three specs passed. Matches the PR body's claim.
  - **Mutation B** (`join-request.service.ts`: `if (decision === 'APPROVED' && false)` — membership-on-approve disabled): TC-GRP-023 **failed** (alice's overview: length 1 vs 2), TC-GRP-024 **failed** (Trip member list: 1 vs 8), TC-GRP-025 **failed** (member list alice-only vs {alice, bob}); TC-GRP-022 passed. Matches the PR body's claim in substance. (Variance, immaterial: the PR body quotes TC-GRP-025's failure as the membership-rows length assertion; the lead's re-run tripped first on the member-list assertion one step earlier in the same spec — same mutation, same binding.)
  - Both mutations reverted → the four specs green (4/4) in the same throwaway copy; probe worktree removed; shared worktree untouched at `c6fd417` throughout.
- **Lead spot-checks of the lanes' most consequential claims** (all confirmed by direct read/grep): (1) C-1's dead import — `CSRF_HEADERS` imported at `tc-grp-022:19`, zero usages in the file. (2) K-2's premise — `place()` throws `409 PENDING_REQUEST_EXISTS` for a live pending duplicate (`join-request.service.ts:125-131`), so carol's header-less place call would create no row even without the CSRF gate; that leg's load-bearing assertion is the `403` + `CSRF_HEADER_MISSING` pair. (3) Security's sole-producer claim — `CSRF_HEADER_MISSING` is emitted only by `csrf.middleware.ts` (`error-contract.ts` is vocabulary), so the spec cannot be satisfied by an unrelated 403. (4) K-3's premise — the re-request `decidedAt`-clearing is pinned by pre-existing `tc-grp-015:98` (`rows[0]?.decidedAt).toBeNull()`), so TC-GRP-025's comment over-claims relative to its own assertions but nothing is uncovered. (5) K-4's premise — `as Record<` casts appear only in `tc-grp-024` (lines 91, 102) across the integration suite. (6) K-1's premise — TC-GRP-023 asserts B's member list only via alice's `toMatchObject` presence, with no length/exact-set assertion on B.

## Compliance lane (summary)

- **TC coverage:** all four acceptance TCs present, translated clause-by-clause with several strictness-preserving strengthenings — TC-GRP-022 (all four routes' status + code asserted 4×; overview before/after + `group.count()`; row-set-unchanged + PENDING/`decidedAt`-null + membership-count baseline holds), TC-GRP-023 (join-info exact body, both member lists as alice, creator markers both directions, A's independence re-asserted exactly), TC-GRP-024 (all five fixture rows exact per the plan's table incl. designated creators; every member list read as its creator; every one of the 8 overviews; explicit `toHaveLength(8)` ceiling pin), TC-GRP-025 (full lifecycle sequence with each transition asserted; all three step-2 reads as alice; all three step-3 direct table reads — the plan entry's explicitly sanctioned vehicle; same-row-id flip pinned via `reRequest.id === bobRequest.id`). No `.skip`/`.only`/`.todo`/commented-out expects (grep-verified by lane and code lane); truncate-per-test in all 4 files; every state-changing setup call carries the CSRF header.
- **Scope:** held exactly (independently re-verified — see the fence table above, including the P-5 parallel-group disjointness and the TC-GRP-021 deferral check: no `tc-grp-021` spec exists, and none is required — the ticket line 18 defers it to the integration phase explicitly).
- **Architecture:** 03 §1 (CSRF) asserted exactly; 03 §3 route paths/shapes and the re-request row-flip semantics; 02-data-model §1 principle 4 + §5.1/§5.3 (retention, ≤1 row per pair, state machine with `decidedAt` clearing); 01 §7 NFR-GRP-004 row + NFR-ACC-005 (the fixture is that exact shape; strategy §6's verification method satisfied by TC-GRP-023+024 together); plan conventions header fully honored.
- **Gold-plating:** none — zero production lines, zero new test infrastructure; the extra assertions are strictness-preserving within each TC's own clauses.
- **Implementation record:** every checkable claim verified true (73/209 on the lane's own DB; arithmetic static + dynamic; scope fence; the mutation-probe account consistent with the lead's re-runs).

## Code lane (summary)

Verified correct, on record: all four specs deterministic (fixed identities, truncate-per-test, sequential awaits — zero `Promise.all` across the integration directory), API-driven where the plan demands it (TC-GRP-023/024 fully; TC-GRP-025's direct reads confined to plan step 3; TC-GRP-022's Prisma counts mirror the sibling `tc-acc-014` side-effect pattern), convention-consistent (the per-file boilerplate matches the 20+ sibling specs; extracting a shared harness would have been over-abstraction and a fence breach), `joinAndApprove`/`placeJoinRequest`/`createGroup` reused rather than reimplemented. **TC-GRP-024's `30_000` ms timeout judged justified** — the suite's only override; ~59 sequential HTTP round trips measuring ~1.5 s warm, 5–10× slower on loaded CI runners would flirt with the 5 s default; scoped to exactly the one test that needs it. **Non-vacuity conviction:** assertion structure genuinely binding (status+code pins tripped by mutation A; sorted-set member assertions tripped by mutation B in all three lifecycle specs; row-identity pins make replace-instead-of-flip undetectable-by-count regressions impossible); methodology caveats recorded (shared-mechanism probes, sensitivity ≠ coverage) — adequate bar for a verification-only ticket. Four nits (table below), all one-to-three-line optional strengthenings; zero blockers, zero should-fix.

## Security lane (summary)

Verified clean: no new input path, dependency, secret, or logging path exists in the diff. **The CSRF spec genuinely pins the invariant** — five-link chain verified on this head: per-leg status assertions; `CSRF_HEADER_MISSING` produced exclusively by `csrf.middleware.ts` (the domain's only other 403, `NOT_GROUP_CREATOR`, cannot satisfy the assertion); side-effect assertions bind the "before the handler" property (a 403-then-`next()` middleware would flip the row/add membership and fail); the positive leg inside the same file (preconditions must 201) excludes an over-broad gate; the lead's mutation A failed it empirically. Residual scope note (plan-level, not a finding): the spec pins the missing-header case only — the frozen contract (03 §1) specifies only that case, and the browser threat model doesn't require value-strictness. Fixture hygiene: `password-1` is the plan's mandated fixture literal; no PII echoed (member refs are `{id, displayName}`; join-info asserted exactly `{groupId, groupName}`); TC-GRP-024's scale build is bounded by fixed arrays. **Carried S-2/R-2 re-proved dormant on this head** (static: zero logging calls in the diff, request-logging middleware logs `req.path` which excludes the query string; live probe at `LOG_LEVEL=info` — 17 pino lines, zero join codes/password/emails/cookies/`joinCode` keys across register/create/join-info/place/approve/reject/404/401/CSRF legs) — still open, deadline-bearing, outside this ticket's fence; the lane's recommendation (bundle as an immediate one-line follow-up production PR or explicitly re-carry with a new deadline, rather than silently rolling over) is recorded for the user.

## Consolidated findings

IDs scoped to this PR/round. **No blocking findings at any tier.** Nits and observations never block.

| ID | Severity | Source | Location | Status | Summary |
|----|----------|--------|----------|--------|---------|
| C-1 | nit (non-blocking) | compliance | `tc-grp-022-csrf-groups-routes.spec.ts:19` | open | Dead import: `CSRF_HEADERS` imported, never used (the four calls under test must omit it; setup calls go through the factories). Harmless; lint passes with it. One-line removal. |
| C-2 | observation (non-blocking — planning defect, route to planner) | compliance | plan `groups-membership.md` L276–277 (TC-GRP-022 entry) | open — upstream | The plan entry is internally contradictory: its precondition gives carol the pending row, yet its step pins `POST /api/join-requests` "(as carol, valid code)" with "all other input valid" — carol's duplicate would hit `409 PENDING_REQUEST_EXISTS` (API §3) even without CSRF enforcement, so "valid" can never hold. Same defect family as g-003's C-4. Planner: amend the entry (second identity for the place probe, or reword the expected clause to the row-set form the spec uses). Not a PR violation — the spec's conservative resolution is faithful (adjudication A-2). |
| C-3 | observation (non-blocking — planning defect, route to planner/test-planner) | compliance | plan `groups-membership.md` L278 vs `tc-grp-022` L75–77, 115–128 | open — upstream | TC-GRP-022 verifies three side-effect clauses via direct Prisma reads, a vehicle its plan entry does not name (it names the API overview only for the group clause; TC-GRP-025's entry, by contrast, explicitly sanctions direct reads). The assertions are strictly stronger than any API-visible alternative. Fold into the same planner amendment carried as g-002 C-5 / g-003 C-5. Not a PR violation. |
| K-1 | nit (non-blocking) | code | `tc-grp-023-multiple-memberships.spec.ts:118-136` | open | The spec asserts A's member list exactly but only alice's *presence* in B's list — the independence claim runs one direction only (a regression dropping bob from B or duplicating rows in B would pass). Fix: `toHaveLength(2)` + sorted-id comparison for B, same idiom as A. |
| K-2 | nit (non-blocking) | code | `tc-grp-022-csrf-groups-routes.spec.ts:89-95, 113` | open | The place-probe's no-side-effect clause (`joinRequest.count()` stays 1) cannot distinguish CSRF-gate presence: carol's duplicate would return `409` and create no row even without the guard (`join-request.service.ts:125-131`). The leg's coverage is carried by the `403` + `CSRF_HEADER_MISSING` status/code assertion (which fails as 409 ≠ 403). Fix (comment-only, stays inside the plan's letter): one sentence noting the row-count clause is redundant-by-construction and the status assertion carries that route's coverage. Alternative (fresh fourth identity) deviates from the plan's literal step list — test-planner's call. |
| K-3 | nit (non-blocking) | code | `tc-grp-025-lifecycle-retention.spec.ts:83, 92-97` | open | The comment claims the re-request flip clears `decidedAt`, but the spec asserts only `id` equality and `status === 'PENDING'`. The clearing is pinned by pre-existing TC-GRP-015 (`tc-grp-015:98`), so nothing is lost — the comment over-claims. Fix: add `expect(reRequest.decidedAt).toBeUndefined()` or drop the clause from the comment. |
| K-4 | nit (non-blocking) | code | `tc-grp-024-full-scale-fixture.spec.ts:91, 102, 140` | open | `{} as Record<…>` unsafe casts — the suite's only ones (rg-verified). Bounded risk (the `users` loop is exhaustive over `IDENTITIES`), but `groups` is keyed by string and read back as the literal `groups['Trip']` — a fixture rename would yield a confusing `TypeError` instead of a clean assertion failure. Fix: type-safe `Map`s, or derive the ceiling check from `GROUP_FIXTURES[0]`. |
| — | below-nit observation | code | `tc-grp-024` loops | open — no action required | Loop assertions report failures without naming the failing fixture (matches sibling-spec convention; a `expect(..., fixture.name)` message would help if the file is ever touched again). |

**Upstream routings (planning defects, not PR violations — the fixer fixes code, not documents):** C-2 and C-3 (both to the planner; C-3 folds into the g-002/g-003 C-5 amendment on the direct-read verification vehicle).

## Deviation adjudications (the coder's three flagged items)

- **A-1 (non-vacuity via mutation probes) — adequate; no rule demands more.** The compliance lane checked strategy §1/§2/§4/§5, the domain plan, and the ticket: no document requires a naturally-red proof, and none could apply — the ticket is verification-only by declaration (routes necessarily predate the specs; no natural red exists by construction). The lead's re-run of both probes on this exact head proves every spec binds (each of the four specs is proven non-vacuous by at least one probe; the two mutations together cover both assertion families — status/code enforcement and state/read-model effects). The g-004 precedent (e2e TC-GRP-026, same verification-only shape) passed review on the same kind of account. The PR body's minor quote variance on TC-GRP-025's mutation-B failure point is immaterial (lead re-ran; same mutation, same binding).
- **A-2 (TC-GRP-022 literal translation — "as carol") — faithful; the plan entry is the defect (C-2, upstream).** The spec keeps the call exactly as pinned and asserts the join-request row set is unchanged (baseline captured before; still exactly carol's `PENDING` row, `decidedAt` null). Under the plan's own preconditions this is the strongest observable form of "no join request placed": a count-delta is unobservable because carol's precondition row already exists and a duplicate would be rejected by the domain anyway — the discriminating assertion for that leg is the `403 CSRF_HEADER_MISSING` status/code, which remains fully asserted and fails under CSRF removal (lead-verified: mutation A). Every expected-result clause of the entry is pinned, plus one strengthening (membership count). The code lane's K-2 records the residual structural note (the row-count clause is non-distinguishing by construction); the security lane independently confirmed the leg still exercises the CSRF-before-handler property on an entitled caller.
- **A-3 (carried follow-ups left untouched) — verified true and correct.** S-2/R-2 (`joinCode` pino redact) sits in `apps/api/src/common/logging/logger.ts`, outside this ticket's fence (`apps/api/test/**` + `apps/api/src/groups/**` only); touching it here would be scope creep and would risk the P-5 parallel merge. Verified: no groups-001/002 carried item surfaces through TC-GRP-022…025 (zero `ctx.logs` usage in the new specs; strictly sequential; overview entries asserted by id/name only; `listPending` at trivial scale). The security lane re-proved S-2 dormancy on this head with a live probe. **Tension recorded for the user:** the g-002/g-003 recommendation was a one-liner "at/before the next groups merge" — this is that merge, and the one-liner remains unlanded (outside the fence). Bundle/waive/re-carry is the user's decision alone.

## Mergeability (pass 1)

Open blocking findings (compliance violation / code-review blocker / critical-high security): **ZERO.**

- Compliance: **compliant** — zero violations; C-2/C-3 are planning defects routed upstream.
- Code: **approve** — zero blockers, zero should-fix; four optional nits.
- Security: **approve** — zero findings at any severity; the CSRF spec verified to genuinely bind the gate; S-2/R-2 dormant with live-probe evidence.

**RESULT: MERGEABLE on pass 1 — the loop ends early on a clean pass.** Pass 2/3 and both fixer rounds unused. No disputes arose (nothing to arbitrate). No upstream defect blocks this PR (C-2/C-3 are routings, not blockers).

## Carried items from prior rounds — status record (inputs weighed, not waived)

| Item | Status in/after this PR |
|---|---|
| S-2 / R-2 (g-002 S-2 = g-004 R-2, from PR #16): `joinCode` absent from pino `REDACTED_KEYS` | **Open, dormant (live-probe proof on this head), outside this ticket's fence.** Deadline-bearing recommendation ("at/before the next groups merge") — this is that merge; the one-liner (`joinCode`, NOT `code`) did not land here because the fence excludes `apps/api/src/common/**`. User's call: bundle as an immediate follow-up production PR, pin on the next groups/hardening ticket, or waive. Security lane recommends not silently rolling it over again. |
| S-1 (g-002): join-info probe oracle (low) | Unchanged — no new endpoints; TC-GRP-023's join-info call is an authenticated read by an entitled code-holding caller. |
| S-3 (g-003): unbounded `listPending` (low, contract hardening) | Unchanged — TC-GRP-025 exercises the pending list at trivial scale; no cap pinned by contract. Route to planner/hardening as before. |
| g-003 C-6: race-contract invariants verified by probes only | Unchanged — TC-GRP-022…025 add no concurrency spec (not their subject; the plan pins no concurrency TC). |
| g-002 C-5 / g-003 C-5: direct-read verification vehicle, no plan amendment | Continues as this round's **C-3** (TC-GRP-022's vehicle unnamed; TC-GRP-025's explicitly sanctioned). Upstream, planner/test-planner. |
| g-001 C-4 (planner pins overview joinCode) | Planner-side, not surfaced — this diff asserts overview fields only as the plan permits (id/name). |
| g-004 K-1/K-2, R-1, P-1 | Web-side / test-planner / planner items — belong to TKT-groups-006's lane (PR #21), untouched by this diff. |
| g-002 K-6/C-2 (REJECTED→PENDING flip coverage) | Closed by TC-GRP-015 in g-003; TC-GRP-025's flip assertions (same-row id, decidedAt transitions) add further coverage on top. |

## Loop status

- Pass 1 (this round): all three lanes dispatched in parallel (blast radius FULL — gate reasoning above) → **zero open blocking findings → MERGEABLE**. No fixer dispatch; passes 2–3 unused.
- **User action requested: merge PR #20** (head `c6fd417`). After merge confirmation, the ticket's status moves to `done` and the board can be regenerated.
- Per the dispatcher's instruction, this artifact is held for a docs-only commit to the PR branch (`docs(reviews): …`, gitignored `reviews/` dir force-added per the established pattern — cf. `docs(reviews): add PR #10 round-1 review artifact`) on the user's explicit go-ahead, so the review history lands in `dev` via the merge; the PR head moves forward by that docs-only commit and CI re-runs on it (expected green — touches only `.pipeline/plan/`).
- Open non-blocking follow-ups recorded for the next owner (user's call: fixer bundle, follow-up ticket, or waive): **C-1** (dead import), **K-1** (B member-list exactness), **K-2** (place-probe comment), **K-3** (decidedAt comment/assertion symmetry), **K-4** (Record casts) — all one-to-three-line test-file touches; **S-2/R-2** (joinCode redact — production one-liner, outside this ticket's fence, deadline-bearing); upstream **C-2/C-3** (planner/test-planner).

Ticket status remains `in-review` — the merge decision and the `done` transition belong to the user.
