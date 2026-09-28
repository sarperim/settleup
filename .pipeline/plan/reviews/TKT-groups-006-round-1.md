# Review Round 1 — PR #21 (TKT-groups-006: Join flow UI — join by code, approve/reject, member list & timing (e2e))

PR: https://github.com/sarperim/settleup/pull/21
Branch: `tkt-groups-006` → `dev` · Head at review: `a80cde3` · Base: `425fb1e` (= `origin/dev` tip; merge-base verified)
Review date: 2026-09-28
Isolated checkout: `/home/sarp/review-tkt-groups-006` — branch `rl/tkt-groups-006` at `a80cde3` (same commit as the PR head). Tree clean at review start and at every gate. Scratch namespace `/tmp/opencode/review-grp-006/` (databases suffixed `_g6r`; the concurrent TKT-groups-005 review — PR #20, another review-lead — owns its own namespace on `/home/sarp/review-tkt-groups-005`; zero collisions, lead-verified). All three reviewer databases verified after the lanes finished (only expected end-of-suite residue: 1 user row in the compliance lane's DB from per-test-start truncation; zero rows in code/security lanes; the e2e DB carries the run's 12-test data; no servers left listening — E2E_PORT 3026 down, lead-verified).

Scope context: the join-flow UI per `.pipeline/plan/tickets/TKT-groups-006.md` — the `/join/:code` page (join-info resolution with the group name shown before confirming, request placement, re-request after rejection), the creator-only join-request handling view inside the group view (pending list by display name, approve/reject), five new `groupsApi` methods over the shared client with mechanism specs, and e2e specs TC-GRP-027…031. Parallel group **P-5** (with TKT-groups-005, PR #20 — reviewed concurrently; write scopes verified disjoint). The PR also implements the PR #17 follow-ups routed to this ticket: **K-2/S-1** (per-group state reset on `groupId` change, default tab restored) and **R-1** (a non-creator never sees a join code — asserted in TC-GRP-028).

Environment note: three reviewer sessions — `compliance-reviewer`, `code-reviewer`, `security-reviewer` — dispatched concurrently via `opencode run` against this checkout, each with its own provisioned PostgreSQL (`settleup_review_c_g6r` / `_k_g6r` / `_s_g6r`; migrations applied). Every checkable claim in the PR body's implementation record was re-verified by the lead and independently by the lanes. Full lane reports preserved at `/tmp/opencode/review-grp-006/{compliance,code,security}-report.md`.

## Blast radius gate (pass-1 dispatch decision)

**Classification: FULL — all three review lanes run.** Reasoning recorded:

- The diff ships executable UI logic: five new typed API-service methods (`apps/web/src/api/groups.ts`), a rewrite of the join page (`JoinPage.tsx`: phase machine, data fetching, form submission), and a substantial extension of the group view (`GroupViewPage.tsx`: creator-only region, new async effect, decide/refresh path, state-reset rework). Plus a new Playwright e2e spec and five new web-unit mechanism specs. Not presentation-only, not non-executable, not comment/formatting-only — every LOW condition fails.
- The ticket pins five automated acceptance TCs (TC-GRP-027…031, e2e) — the compliance lane must verify them.
- The new surfaces consume membership/PII-adjacent data (display names per FR-ACC-008, creator-only join-code secrecy per FR-GRP-002/NFR-GRP-005, join-info minimal disclosure per FR-GRP-004) — squarely in the security lane's remit even for a web-only diff.

## Scope fence (P-5 constraint) — verified held (lead + compliance + security lanes, independently)

`git diff --name-status origin/dev...HEAD`: exactly 6 files, no renames, no mode changes (+589/−11):

| File | Change |
|---|---|
| `.pipeline/plan/tickets/TKT-groups-006.md` | status `todo`→`in-review (PR #21)` only (verified — nothing else changed) |
| `apps/web/src/api/groups.ts` | +47 — five new join-flow methods over the shared client |
| `apps/web/src/api/groups.spec.ts` | +77/−1 — additive mechanism specs (the −1 is the widened import; existing specs untouched) |
| `apps/web/src/pages/GroupViewPage.tsx` | +137/−4 — creator-only join-requests region + K-2/S-1 state reset + members-tab render gate |
| `apps/web/src/pages/JoinPage.tsx` | +128/−5 — placeholder → functional join page |
| `apps/web/test/e2e/join-flow-ui.spec.ts` | new +199 — TC-GRP-027…031 |

**Zero changes** to `apps/api/**`, `packages/shared/src/**`, root `package.json`, `pnpm-lock.yaml` (verified by direct diff query — 0-line diff on every must-not-touch path; the compliance and security lanes re-verified independently). No new dependencies (no manifest or lockfile change at all). The P-5 parallel-merge fence with PR #20 (TKT-groups-005, `apps/api/**`) holds exactly — the two PRs are file-disjoint.

## Reviewer verdicts (pass 1, dispatched in parallel)

| Lane | Verdict | Blocking findings |
|------|---------|-------------------|
| compliance | **COMPLIANT** | 0 violations · 4 observations (OBS-1…OBS-4, all non-blocking, none requiring a code change) |
| code | **APPROVE** | **0 blockers** · 4 should-fix (C-1…C-4) · 2 nits (C-5, C-6) · 10 observations (O-1…O-10) |
| security | **APPROVE** | **0 critical/high/medium/low** · 1 hardening note (S-3 — no plausible attack path today) |

## Baseline gates (review-lead run, from scratch in the isolated worktree)

- `pnpm install` / `prisma generate` / `pnpm lint` / `pnpm typecheck` / `pnpm build`: all exit 0 (logs: `/tmp/opencode/review-grp-006/lead-{install,prisma-gen,lint,typecheck,build}.log`).
- `pnpm test` on the lead's DB (`settleup_review_g6r`): **69 files / 210 tests, exit 0** (59 s) — matches the PR claim exactly (baseline pre-PR 205 + 5 new mechanism specs).
- Full e2e on a FRESH `settleup_e2e_g6r` (port 3026): system **1/1** + Playwright chromium **12/12** (6 pre-existing + TC-GRP-026 + the five new join-flow TCs), exit 0. Log: `/tmp/opencode/review-grp-006/lead-e2e.log`.
- CI "Lint, test & build" on head `a80cde3`: SUCCESS (run 36395254776, lead-verified via `gh`).
- Each lane independently re-ran `pnpm test` on its own DB: 69/210, exit 0 (compliance 94.4 s; code 53.4 s; security 55.2 s).

## Consolidated findings

IDs scoped to this PR/round. **No blocking findings at any tier.** Cross-lane overlaps: C-1 ↔ S-3 (same surface, code + security lanes); C-4 ↔ OBS-1 (same fact, code + compliance adjudications — both non-blocking).

| ID | Severity | Source | Location | Status | Summary |
|----|----------|--------|----------|--------|---------|
| C-1 | should-fix (non-blocking) | code | `GroupViewPage.tsx:133-160` (+ `decidingId` missing from the reset block at `:60-69`) | open, non-blocking | `decide()` has no cancellation guard: the post-decide refresh (`Promise.all` of pending + members) writes `setRequests`/`setMembers` with no guard tied to the effect lifecycle, so a `groupId` change mid-flight can land the previous group's data in the new group's view (latent — no param-only group→group navigation ships today; same reachability class as PR #17's K-2, which this PR fixes on the load path in the same file). Also `decidingId` is not reset on `groupId` change, leaving row buttons disabled until the in-flight `finally`. Fix: guard the post-await writes like the sibling effects (capture `groupId` at call time / per-group cancellation token) and add `setDecidingId(null)` to the reset block. |
| C-2 | should-fix (non-blocking) | code | `GroupViewPage.tsx:220,229` + `:133-160` | open, non-blocking | Concurrent decides on different rows race: `disabled={decidingId === request.id}` disables only the acted-on row, so two decides can run concurrently and their refreshes resolve last-write-wins — an already-approved request can reappear as pending (re-deciding it hits the API's 404 already-decided error; self-heals on reload; no server-side corruption — the API operates on pending rows only). Fix (one line ×2): `disabled={decidingId !== null}` — serialize decisions at the UI. |
| C-3 | should-fix (non-blocking) | code | `GroupViewPage.tsx:208-212` | open, non-blocking | The join-requests section renders "No pending join requests." underneath the load-failure alert — the K-1 defect class ("success-empty state under the error alert") recreated on the new surface, ten lines below the very render gate (`error === null ? <ul> : null`, `:191`) this PR adds to fix K-1's group-view half on the members tab. Fix: gate the empty state (and list) on `requestsError === null`, mirroring `:191`. |
| C-4 | should-fix (non-blocking) | code | `join-flow-ui.spec.ts:194-197` | open, non-blocking (cross-ref OBS-1) | TC-GRP-031's third route (`groupUrl#join-requests`) measures a hash-only **same-document navigation** — no document load occurs (~13 ms, `null` main response; empirically verified with the repo's Playwright 1.63.0), so the third leg can never breach the 2.0 s budget. Substantively covered by leg 2 (the handling view is a region of the group view, whose document load — with the region's content asserted present — leg 2 genuinely measures), but the leg as written is theater and would keep silently passing if the view later moved to its own route. Fix: re-navigate (e.g. `page.goto('/')`) before the third measurement to make it a real cross-document load, or drop the third route with a comment recording the region collapse. |
| C-5 | nit | code | `GroupViewPage.tsx:60-69` | open, non-blocking | One-frame flash of the previous group's data on a param-only transition (the K-2 reset runs post-paint in `useEffect`). Latent only; the implemented fix shape is one of the two the routing suggested. The alternative (keying the route element on `groupId` in `App.tsx`) would also settle `activeTab`, `decidingId`, and C-1's stale-closure class in one move — worth considering when in-group navigation lands. |
| C-6 | nit | code | `GroupViewPage.tsx:153-156` | open, non-blocking | `decide()`'s catch conflates decision failure with refresh failure: if approve/reject succeeds but the refresh fails, the user sees "Could not update the join request." although the decision applied. Split the messages. |
| S-3 | hardening note (non-blocking; below low) | security | `GroupViewPage.tsx:133-160` (unguarded `setRequests`/`setMembers` at `:151-152`) | open (same subject as C-1) | The `decide()` refresh re-opens a strictly narrower stale-display window than the S-1 this PR closes: only data the same session already legitimately held (as group A's creator) could redisplay under group B's heading; no privilege boundary crossed; the join code cannot resurrect (it renders from `group` state, which `decide()` never writes); where the user is not B's creator the region does not render at all. Identical adjudication to the prior round's S-1 — no plausible attack path. |
| OBS-1 | observation (non-blocking) | compliance | plan `groups-membership.md:368` vs `join-flow-ui.spec.ts:194` + `helpers/timing.ts:20` | open (same subject as C-4) | Adjudicated **not a weakened test**: 03 §6 pins no separate URL for the handling view and the ticket pins it "inside the group view", so the handling view's only load *is* the creator's group-view document load, which route 2 genuinely measures (content asserted present first). The plan's three surfaces legitimately collapse to two document loads. Suggested routing (see §Upstream): test-planner clarifies the TC-GRP-031 entry so the vacuous hash measurement isn't cargo-culted into future timing specs. |
| OBS-2 | observation (non-blocking) | compliance | `GroupViewPage.tsx:191` vs round-1 (PR #17) K-1 | open — split recorded | The K-1 **group-view half** (suppress the empty member `<ul>` on failed load) was fixed without being explicitly routed to this ticket. Adjudicated in-scope cleanup, not gold-plating: inside the declared write fence, on the page the ticket extends for the routed K-2/S-1 fix, one line, error-path only, no capability added, no TC assertion's meaning changed, cannot mask a regression. K-1's **overview half remains open and unrouted** (`GroupsOverviewPage.tsx` still renders "You are not a member of any groups yet." ungated on `loadError` — lead-verified in this worktree; the file is correctly untouched by this PR). |
| OBS-3 | observation (non-blocking) | compliance | round-1 (PR #17) R-1 vs `join-flow-ui.spec.ts:101-105` | open — planner half | **R-1 closed on the code side** in exactly the routed slot (TC-GRP-028's journey, kate's separate context, heading asserted first so the count-0 is meaningful). The plan's TC-GRP-028 entry doesn't pin the assertion — a strict strengthening. Route to test-planner: fold the non-creator join-code absence into the TC-GRP-028 plan entry so the strengthening survives spec regeneration. |
| OBS-4 | observation (non-blocking) | compliance | plan identities vs `helpers/auth.ts:34-38` | open (convention) | e2e identities are namespaced (`hank-e2e@test.local` etc.) rather than the plan's literal `hank@test.local` — the established, previously-adjudicated convention (PR #17 C-1; TKT-accounts-005 C-4 reality). Display names, passwords, determinism, self-containment, and UI-only registration preserved; TC-GRP-030's email-absence assertions correctly target the actual namespaced emails plus a catch-all `@` absence. Fidelity holds in substance. |

### Security-lane notes (non-findings, recorded so the merge decision is explicit)

- **Accepted-by-design:** the join code appears in the `/join/:code` URL path — pinned by 03-api-design.md §6, so a planning-level accepted exposure, not a PR defect. Residual exposure bounded: the code holder already knows the code; the page makes only same-origin requests (no Referer escape); BR-GRP-004's approval gate backstops a stolen history entry to a rejectable pending request.
- **Carried pre-existing (NOT this PR's, never blocked on):** the join-code `<p>` is not gated on live session state (PR #17 surface, byte-unchanged — a code the creator already saw stays rendered until navigation); **R-2** (joinCode absent from the API pino redact list — carried from PR #16/#17, API lane; this PR makes it slightly more pertinent since the code now transits the `/api/join-info?code=…` GET query string per the pinned §3 contract, but creates no new client-side leak path); join-info brute-force surface (2^40 Crockford CSPRNG + approval-gate backstop — pre-existing API property, no amplification).
- **Clean surfaces (verified):** XSS (every new render is an escaped React text node; zero DOM-sink/storage/console matches across `apps/web`); join-code secrecy in every new surface (the new JoinPage never renders the code; the only code render remains the pre-existing creator-gated one); `JoinInfoDto` minimal disclosure (`{ groupId, groupName }` exactly); client-side authZ (the pending-requests fetch never fires for a non-creator; `decide()` unreachable for a non-creator; the API enforces all three rows creator-only regardless; logout unmounts the region); PII (display names only at the DTO level — no email field exists on the rendered types); error messages (envelope constants + fixed generic fallbacks; no raw `caught.message`/stack); CSRF/transport (all five methods through the shared hardened client; header-on-POST/absent-on-GET pinned by the new mechanism specs); deps/config/secrets (zero changes).

### Code-lane observations recorded without action

O-1 `ALREADY_MEMBER`/`PENDING_REQUEST_EXISTS` branches are documented UC-GRP-002 alternate flows (A1/A2), not gold-plating — the `PENDING_REQUEST_EXISTS`→pending mapping is truthful (fires only for a still-pending requester; the rejected→re-request path is the 201 row-flip). O-2 the handling view as a region (not a §6 tab) is the correct reading of the pinned scaffold and the ticket's "inside the group view" — the only knock-on is C-4. O-4 `isCreator` timing is a non-issue (`RequireAuth` renders children only when authenticated). O-5 `requestsLoading` not in the main reset block is unobservable. O-6 the members render gate is justified (header alert already announces the failure). O-7 the red story is coherent and right-reasoned for these TCs. O-8 TC-GRP-029's `page.reload()` is correct and hides nothing (the in-place refresh is independently asserted by the count-0 checks; reload is the only way liam's view learns of the re-request — no live updates by design). O-9 the mechanism specs are deterministic and would catch their regressions (URL/method/CSRF/body pinned, including query and path encoding). O-10 e2e hygiene is good (plan-roster identities, contexts closed, exact accessible names, strong catch-alls). Security-lane side observation: the `pendingRequests` mechanism spec doesn't pin CSRF-absence-on-GET for its own row (mirrors prior round's K-4 asymmetry nit; covered generically in `client.spec.ts`).

## Compliance-lane verification summary (evidence for the verdict)

- **TC coverage:** all five acceptance TCs exist in `join-flow-ui.spec.ts`, translated line-by-line against the plan entries (`groups-membership.md` §2 lines 324–369) — every precondition, step, and expected-result clause present and asserted, none softened; several clauses strengthened (join-code format pin, empty-overview assertion, `@`-absence catch-all, R-1's count-0). Full clause-by-clause tables in the lane report.
- **Test integrity:** `groups.spec.ts` diff purely additive (the −1 line is the widened import, verified in the hunk); no `.skip`/`.only`/`.fixme`/commented-out assertions anywhere in the new or sibling specs; suite arithmetic exact (205 + 5 = 210).
- **Architecture:** 03 §3 join rows implemented exactly (paths, methods, CSRF, body; URL-encoding pinned); 03 §6 `/join/:code` filled per its row ("calls `GET /api/join-info` then `POST /api/join-requests`"); the handling view as a creator-only region deviates from nothing §6 pins; 01 §2 C1 (shared client only, zero raw `fetch`); FR-GRP-004 minimal disclosure; FR-GRP-011/BR-GRP-010 re-request semantics; NFR-GRP-003 asserted per the T4 policy (median of 3, one retry on breach, 2.0 s — `helpers/timing.ts` verified to match); e2e conventions hold (self-contained, order-independent, UI-only setup).
- **Routed follow-ups:** K-2/S-1 implemented as routed (reset at effect start including `setActiveTab('expenses')` — the routing's parenthetical); R-1 closed in the routed slot (see OBS-3).
- **Red story:** adjudicated credible and right-reasoned (mechanism red = the correct failure mode for the new API surface; e2e red with pages reverted = element-not-found, the correct failure mode for these TCs); arithmetically consistent; current state re-run green by the lead and all three lanes.

## Upstream routings (planner/test-planner — user's call; nothing here blocks this PR)

1. **TC-GRP-031 plan entry** (OBS-1/C-4): clarify that the "creator's join-request handling view" surface = the creator's group-view document load (03 §6 pins no separate route), so future timing specs don't cargo-cult a vacuous hash-route measurement.
2. **TC-GRP-028 plan entry** (OBS-3): fold the non-creator join-code absence assertion (R-1's closure) into the plan entry so the strengthening survives spec regeneration.
3. **R-2** (carried, API lane — TKT-groups-005/002/003 side): `joinCode` absent from the API's pino redact list; slightly more pertinent now that the code transits the join-info GET query string.

## Mergeability determination

**Zero open blocking findings** — no compliance violations (compliant), no code-review blockers (approve: 0 blockers), no critical/high security findings (approve: 0 at every tier). Blocking is defined as any compliance violation, any code-review blocker, or any critical/high security finding; should-fix, nits, hardening notes, and observations never block.

**RESULT: MERGEABLE on pass 1 — the loop ends early on a clean pass. No fixer dispatch** (nothing blocking to fix; the open items are non-blocking quality findings, hardening notes, observations, and upstream routings, and the loop's fixed sequence ends on a clean pass). The user (merge authority) may merge as-is, waive specific findings, or route the should-fix items (C-1…C-4) to a pre-merge fixer pass or a follow-up ticket.

## Open non-blocking items for the next owner (user's call: pre-merge fixer pass, follow-up ticket, or waive)

- **C-1** (`decide()` cancellation guard + `decidingId` reset; pairs with **S-3** and **C-5** — all three live on the same surface; the `App.tsx` route-key alternative would settle C-1/C-5 and the `activeTab`/`decidingId` residuals in one move)
- **C-2** (serialize concurrent decides — one line ×2)
- **C-3** (gate the join-requests empty state on success — mirrors the members-tab gate this PR itself adds)
- **C-4** (make TC-GRP-031's third leg a real cross-document load, or drop it with a comment — pairs with the OBS-1 planner routing)
- **C-5**, **C-6** (nits)
- **K-1 overview half** (`GroupsOverviewPage.tsx` empty state under load-error — pre-existing, unrouted, correctly untouched by this PR)
- **R-2** (API lane, carried)
- Routings: OBS-1/OBS-3 → test-planner (plan-entry clarifications); R-2 → API lane.
- Carried context from prior rounds (still open, not this PR's responsibility): grp-001's K-1/K-2, S-1, S-2 (== R-2), C-3/C-4, P-1; acc-005's P-1/P-2/P-3; FLAG-2 (e2e dir outside web lint/typecheck globs — pre-existing, confirmed unchanged by this diff; the new `join-flow-ui.spec.ts` sits in the same uncovered state as every existing e2e spec).

## Evidence index

- Lead logs: `/tmp/opencode/review-grp-006/lead-{install,prisma-gen,lint,typecheck,build,test,e2e}.log`, `migrate-*.log`
- Lane reports: `/tmp/opencode/review-grp-006/{compliance,code,security}-report.md` (full findings, clause-by-clause TC tables, verified-vs-trusted inventories)
- Lane dispatch briefs: `/tmp/opencode/review-grp-006/brief-{compliance,code,security}.md`
- PR body copy: `/tmp/opencode/review-grp-006/pr-body.md`
- Prior round (routing source): `.pipeline/plan/reviews/TKT-groups-004-round-1.md`
