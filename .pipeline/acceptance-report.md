# Acceptance Report — Foundation Phase (TKT-foundation-001…007)

**Verdict: ACCEPTED** for the foundation phase, with findings (§7) — two process-integrity items (**F-2/F-3**) need a user decision. No red tests, no missing foundation TCs, no scope creep, no unverified foundation acceptance criterion. **Post-verdict: F-1 fixed (PR #9) and F-6 resolved by design (USER-DECISION-3, PR #8) — see §8.**

- **Scope:** phase acceptance of the 7 foundation tickets only (all marked `done`). This is **not** project acceptance — 27 of 34 tickets are `todo`, 122 of 125 planned TCs are owned by domain tickets and not yet due. Project-level SC verification (§5) is pending by design.
- **Verified ref:** `dev` @ `35011da` (2026-09-27), clean worktree, synced with `origin/dev`. All seven PR merges (#1–#7) are ancestors of this ref. Post-verdict fixes merged at `5d7227c` (PR #8, docs-only) and `27fb714` (PR #9, F-1 harness fix) — §8.
- **Verifier:** acceptance agent (independent re-execution; no code or documents modified except this report).
- **Environment note:** local runs on Node 22.22.0 / pnpm 10.34.5 against PostgreSQL 17.11 (repo pins `engines >=24`; CI runs Node 24). Same recorded precedent as every foundation ticket's local verification (F-8, informational).

## 1. Environment & full-suite results (independent, on dev @ 35011da)

| Check | Command | Result |
|---|---|---|
| Frozen install | `pnpm install --frozen-lockfile` | ✅ exit 0 |
| Prisma client | `pnpm --filter api exec prisma generate` | ✅ exit 0 |
| Lint | `pnpm lint` | ✅ exit 0 (3 projects) |
| Typecheck | `pnpm typecheck` | ✅ exit 0 (3 projects) |
| Migrations (fresh DB `settleup_acceptance`) | `prisma migrate deploy` | ✅ applied cleanly; **re-run exit 0, "No pending migrations"** (idempotent) |
| Unit + integration | `DATABASE_URL=… pnpm test` — **run twice consecutively** | ✅ **15 files / 72 tests passed, both runs** (truncate-per-test isolation holds) |
| DB-unset guard | `pnpm test` with `DATABASE_URL` unset | ✅ unit 70/70 pass; integration fails with "The integration test project requires DATABASE_URL."; **exit 1** |
| Build | `pnpm build` | ✅ shared → api → web; SPA bundle **84.30 kB gzip** (≤ 300 KB budget) |
| Web mechanism suite | `pnpm --filter web test` | ✅ **47/47** (5 files) — note: outside root runner, see F-4 |
| E2E (full fresh path) | drop `settleup_e2e` → `E2E_DATABASE_URL=… pnpm test:e2e` | ✅ script re-creates + migrates DB, Playwright boots built `apps/api/dist/main.js` serving the built SPA, **1/1 passed** |
| CI (GitHub Actions, Node 24) | run `36285384382` (PR #7 head `ad7f77c` = merge ref of dev) | ✅ every step green: install, generate, lint, typecheck, migrate, 72-test run, build, E2E-db, Playwright |

The only commits after that CI run are `68ee322` (the merge itself — tree-identical to the validated merge ref) and `35011da` (ticket-status flip + `.gitignore` line; no code). Combined with the local re-execution above, the integrated dev state is fully verified.

Runner-gating proof (f-007 c3 / f-006 c3): directly observed — the `DATABASE_URL`-unset run fails the command with exit 1; recorded mutation proofs on file (f-006 round-1 artifact: broken canary → 2 failed/exit 1, neutered truncate → canary fails; f-004 round-2: five behavior-fix pins verified fail-pre-fix; f-005 round-1/2: route-break mutations fail exactly the right cases). I did not mutate code myself (acceptance rules).

## 2. Ticket acceptance verification (all 7 `done`)

**TKT-foundation-001 (monorepo scaffolding)** — criteria 1–5 ✅: frozen install, lint, typecheck, build (dist artifacts produced), real `pnpm test`/`test:e2e` runs (stubs since replaced by f-006/f-007 wiring, both exit 0), boot verified via the e2e webServer booting `dist/main.js` and the a1 boot specs. PR #1 → master, merged 2026-09-26.

**TKT-foundation-002 (Prisma model & migration)** — criteria 1–4 ✅: schema transcribed field-for-field from 02-data-model.md §4 (I compared all 8 models: fields, types, defaults, 3 enums with values/order, all `@unique`/`@@unique`, all 4 `@@index`es, `onDelete: Cascade` on ExpenseShare→Expense); FLAG-1 formatting normalization documented in-file with names/values/order unchanged. Fresh-DB `migrate deploy` ✅, idempotent re-run ✅ (both re-verified by me on a throwaway DB). `prisma generate` + typecheck ✅. PR #3 → master. (Merged without a formal review loop — user-directed, mitigations on record in the ticket; schema exercised green in CI runs 36221858640 / 36285384382.)

**TKT-foundation-003 (shared package)** — acceptance = TC-EXP-001/002/003 green ✅ (§3); criterion 1 (DTO exports for 03 §2/§3/§3b/§3c/§4) ✅ `dto-shapes.spec.ts` 5/5; criterion 2 (error-code union exactly 03 §4 + `LIST_TOO_LARGE`) ✅ `error-codes.spec.ts` 3/3; criterion 3 (no runtime deps) ✅ — `packages/shared/package.json` declares zero dependencies. PR #4 → dev.

**TKT-foundation-004 (API platform)** — criteria 1–5 ✅: a1 boot-env specs (13 tests) + missing-env non-zero exit; a2 CSRF/error-envelope specs (7); a3 validation-internal (3, hand-injected paramtypes — see F-1); a4 static-SPA (5); a5 request-logging (4); plus round-2 pins (csrf-method-set 7, unmapped-exception-status 3, payload-too-large 1, error-code-mirror 1). Real-dist serving verified by the Playwright boot of the built app. Review loop closed at pass 3; deviations/flags on record. PR #6 → dev.

**TKT-foundation-005 (SPA shell)** — criteria 1–4 ✅: routes/placeholders via App.spec + routes.spec (in the 47/47); wrapper mechanism via client.spec/errors.spec (CSRF header on mutations, envelope parsing, 401 redirect) + recorded dev-proxy round-trip (FLAG-1's live-envelope leg was permitted to be proven at unit level — f-004 has since landed the real envelope, and the e2e canary now exercises the real SPA/API pair); build 84.30 kB gzip ≤ 300 KB; no-email/no-input assertions in App.spec. Review loop closed clean at pass 2. PR #5 → dev.

**TKT-foundation-006 (integration & e2e harness)** — criteria 1–6 ✅: two consecutive 72-test runs; DB-unset guard (unit 70/70 + clear failure, exit 1 — independently reproduced); canary-break gating (recorded mutation proof + my direct exit-1 observation); fresh-DB e2e (independently reproduced end-to-end); CI green with **no workflow-file change** (verified via merge diff: 11 files, `ci.yml` untouched — must-NOT-touch held for `apps/api/src/**`, `packages/shared/src/**`, `apps/web/src/**` too); lint/typecheck exit 0. Review loop closed clean at pass 1. PR #7 → dev.

**TKT-foundation-007 (CI pipeline)** — criteria 1–5 ✅ with documented deviations: ci.yml implements 04 §4's four logical steps + service container + env + concurrency + artifact upload; DEVIATION-1..5 (pnpm `version:` input, `master` trunk per USER-DECISION-1, maintenance-DB CREATE fix, `permissions: contents: read`, explicit `--schema`) each justified in-file with architect amendments routed (F-7). Criterion 2: TC-EXP-001/002/003 execute in the unit project, passing with `DATABASE_URL` unset (70/70) — independently reproduced. Criterion 4 (local rehearsal of workflow steps in order) — I executed the exact sequence, all green. Criterion 5: CI green on the PR (runs 36250120873 / 36285384382); the "on main once merged" leg is pending trunk promotion (F-6). Review loop closed clean at pass 3. PR #2 → dev.

## 3. Coverage-matrix reconciliation (foundation scope)

- **Planned TCs due now:** TC-EXP-001, TC-EXP-002, TC-EXP-003 (placed on TKT-foundation-003 per the matrix/Gate-4 ledger). **All three exist, are exact translations of the plan's steps/expected values** (verified line-by-line: all 6 valid forms, all 7 rejected forms + the `21474836.47`/`.48` BVA pair, all 4 format cases + round-trip), **and pass** (18 tests: 6+8+4, green in the 72 and in CI). The plan's "throws / returns an error result" latitude is resolved as a non-throwing error result, documented in the spec.
- **Planned TCs not yet due:** 122/125 — owned by `todo` domain tickets (accounts/groups/exp/bal/integ). Placement was audited at Gate 4 (125/125 placed, zero orphans, zero duplicate owners); no done ticket claims any TC beyond EXP-001–003. Not a finding — this is the phase boundary.
- **Tests without planned TCs (extra-test direction):** 54 additional automated tests exist — 4 shared mechanism specs (8 tests), 34 api platform/pin specs, 2 integration-canary tests, 1 e2e canary, 47 web mechanism tests (some overlap in counts by file, 72 root + 47 web + 1 e2e total). All are **documented** in their tickets as criteria-level mechanism specs, consistent with the matrix's own note that foundation carries no TCs. None falsely claims a TC ID. The genuinely open item is that the 47 web mechanism tests are in **no CI-executed runner** (F-4).

## 4. Integration & e2e (cross-domain, my ownership)

The only system-level tests that exist at this phase are the harness canaries; both run green on dev — integration canary (unknown `/api` path → 404 in §4 envelope; truncate-per-test proven by the User-row self-test and two consecutive full runs) and the e2e SPA canary (fresh DB → built app → rendered SPA), verified locally and in CI run 36285384382. All other system/e2e TCs in the domain plans (23 e2e + 1 system) are owned by todo tickets.

## 5. Success criteria status (project level — pending, by design)

| SC | Verification path (matrix §2) | Status at foundation exit |
|---|---|---|
| SC-001 | real-world adoption (not automatable) + TC-BAL-025 path | pending (domain) |
| SC-002 | TC-EXP-004/005/008 · TC-BAL-001…004 | pending (exp-001 / bal-001, todo) |
| SC-003 | TC-EXP-028 | pending (exp-005, todo) |
| SC-004 | TC-ACC-027 · GRP-031 · EXP-032/033 · BAL-026 | pending (domain e2e) |
| SC-005 | TC-EXP-023 + TC-BAL-016 | pending (domain) |
| SC-006 | TC-ACC-015 + TC-GRP-021 | pending (integ-001, todo) |
| SC-007 | TC-BAL-025 | pending (bal-007, todo) |

No foundation artifact claims any SC as verified. Every SC has a defined, approved verification path — no unverifiable SCs. Foundation's contribution to the SC infrastructure is verified: ASM-002 money discipline (TC-EXP-001–003 green), the frozen DTO/error contracts, and the harness that will execute the remaining 122 TCs.

## 6. NFR verification status

None of the 20 NFRs' verification methods were due for execution in the foundation phase (all trace to domain TCs or the deployment ticket). The one foundation-translated NFR check — SPA initial bundle ≤ 300 KB gzip (NFR-ACC-003 translation, f-005 criterion 3) — **was executed and passes** (84.30 kB). NFR-ACC-002 (hosting review) is due at integ-003. No unexecuted-but-claimed NFRs.

## 7. Findings

| # | Type | Finding & evidence | Severity | Suggested routing |
|---|---|---|---|---|
| **F-1** | routed flag dropped (forward risk) | **f-004 FLAG-3 never reached f-006.** FLAG-3: "Vitest compiles with esbuild, which does not emit `design:paramtypes`… Unless TKT-foundation-006 enables decorator-metadata emission (e.g. an SWC-based transform), every domain DTO-validation integration test will silently skip validation" (TKT-foundation-004.md:33; also a code comment in `tc-foundation-004-a3-validation-internal.spec.ts:45-54`). Grep across `.pipeline/` finds FLAG-3 **only** in the f-004 ticket — absent from the f-006 ticket, its round-1 review artifact, and the board. The delivered harness (`vitest.config.ts`, integration support) has no decorator-metadata/SWC transform. All current tests are honest (a3 hand-injects metadata), but the first domain DTO-validation integration tests (accounts-001 onward — the plans are full of 400-VALIDATION_FAILED cases) risk **false greens** under the current harness. **→ RESOLVED (fixed):** user-directed fix via PR #9 — SWC decorator-metadata transform + permanent harness pin (§8), merged before any domain ticket started. | ~~High — resolve before TKT-accounts-001~~ → Resolved | planner/test-planner (harness contract) + coder (done) |
| **F-2** | missing review artifact (dangling reference) | TKT-foundation-003.md cites `.pipeline/plan/reviews/TKT-foundation-003-round-1.md` ("merged by owner after review round 1 and its fixes"); **no such file exists** on disk or in any branch (`git log --all` empty). The round-1 substance (DEVIATION-1/2) survives inside the ticket file (commit 46e7549), but the cited artifact is gone. | Medium | user / review-lead — reconstruct or correct the reference |
| **F-3** | review-artifact retention gap | `.gitignore:4` ignores `.pipeline/plan/reviews/`. Only 6 of 12 artifacts are tracked (f-004 ×3, f-005 ×2, f-006 ×1 — force-added); f-001 ×2, f-002 ×1, f-007 ×3 exist **only as untracked local files** (present on this machine, `git status --ignored` confirms). A fresh clone loses them — the exact failure mode f-006's provenance note describes ("uncommitted on disk — its commit never landed"). | Medium | user — decide: force-add the six local artifacts for record integrity, or accept ticket-file summaries as the record |
| **F-4** | ungated tests (open, 3rd consecutive ticket) | 47 web mechanism tests (`apps/web/src/**/*.spec.{ts,tsx}`) are outside root `pnpm test` (vitest.config includes shared+api unit, api integration only) and outside CI. They pass when run manually (47/47, verified) but nothing enforces them. Routed as C-1 in f-005 round 1 and f-006 round 1; still open. | Medium | test-planner |
| **F-5** | lint/typecheck coverage gaps (open, routed) | Test dirs, `playwright.config.ts`, and root `scripts/*.mjs` sit outside all lint/typecheck globs; known pre-existing type errors in `apps/api/test/unit` (f-006 FLAG-2/C-2; `scripts/e2e-db.mjs` has 14 `no-undef` under the root config). | Low | planner |
| **F-6** | trunk promotion pending (user action) | `dev` (35011da) is 73 commits ahead of `origin/master`, 0 behind — a clean fast-forward. CI's push trigger fires only on `master`, so f-007 criterion 5's "green on main once merged" leg and the board's "first trunk-push run" checklist item are still open. `master` branch protection is likewise pending. Local `master` is also stale (bd3e13d, behind origin/master). **→ RESOLVED (by design):** user decision 2026-09-27 — master intentionally lags dev until MVP release; recorded as USER-DECISION-3 in TKT-foundation-007.md via PR #8 (§8). Promotion, first trunk-push run, and master protection are MVP-release-time owner steps. Local-master staleness is cosmetic. | ~~Info (user-owned)~~ → Resolved | user (decided) |
| **F-7** | architecture-doc amendments pending (open, non-blocking) | 02-data-model §4/§7 (f-002 FLAG-1 normalization + naming), 04-ci-pipeline §4/§5 (f-007 DEVIATION-1..5, `main`→`master`), 03-api-design §3c (f-003 DEVIATION-2: `SettlementDto.status` field the doc's inline shape omits — the test plan and data model both pin it). All routed with recommended amendments; docs currently trail the shipped code. | Info | architect |
| **F-8** | environment observation | All local verification (coders' and mine) ran Node 22.22.0 vs pinned `engines >=24`; CI runs Node 24 and is green. Recorded precedent in f-002/f-004/f-005/f-006. | Info | none |
| **F-9** | open flags on f-004 (routed, in place) | FLAG-1 build-ordering workaround (error-code mirror in `apps/api/src/common/errors/error-contract.ts` + guard spec `error-code-mirror.spec.ts`; delete when the shared-dist build-ordering fix lands) and FLAG-2 (`VALIDATION_FAILED.details` shape `{ fields: string[] }` needs architect confirmation before domain tickets assert against it). | Info | architect / planner |

## 8. Post-verdict record (2026-09-27)

- **User decision on F-6:** "it is by design that master will be behind dev till MVP release." Recorded as **USER-DECISION-3** in `.pipeline/plan/tickets/TKT-foundation-007.md` — dev is the integration branch for the entire build; the dev→master promotion (clean fast-forward), the first trunk-push CI run, and `master` branch protection are owner steps at MVP-release time. f-007 criterion 5's "and on main once merged" leg is satisfied by design at promotion; until then PR merge-ref CI runs are the trunk evidence.
- **Fix routed and landed:** coder dispatched (user-directed), PR [#8](https://github.com/sarperim/settleup/pull/8) — docs-only, 1 file (+2/−1: USER-DECISION-3 bullet + rewritten user-side step, which also fixed the stale `main` word), CI green (run 36287477017), verified against the brief (no code/workflow/test changes; `ci.yml` byte-identical) and merged at `5d7227c`. The gitignored `board.md` owner-actions view was updated locally to match (nothing CI-related pending during the build; architect §5 amendment rider noted).
- **Fix routed and landed (F-1, user-directed "fix it"):** coder dispatched → PR [#9](https://github.com/sarperim/settleup/pull/9) — `unplugin-swc` + `@swc/core` root devDeps (lockfile waiver recorded, precedent f-007 USER-DECISION-2), `swc.vite()` on both Vitest projects, a3's hand-injected metadata removed, permanent harness-pin spec added (`apps/api/test/unit/harness.decorator-metadata.spec.ts`), full record in the TKT-foundation-006 addendum. **Red proof captured pre-fix** (invalid DTO → 201 instead of 400, verbatim assertion failure). **Review-lead pass 1 (user-directed):** all three lanes CLEAN (compliance / code / security — supply-chain verified: trusted-publisher releases, official NestJS recipe, dev-only), mutation proof run (plugin disabled → pin reds with exactly its documented signature; restored byte-identical), artifact `PR-0009-f1-harness-fix-round-1.md` committed to the PR branch. **Acceptance re-execution** (independent, on the PR head): install/generate/lint/typecheck exit 0, full suite **16 files / 74 tests × 2 consecutive runs** (72 baseline + 2 pin tests), DB-unset guard exit 1 with unit 72 passing, build exit 0, web 47/47, CI green on the final head (run 36289178494), frozen `ci.yml` untouched. Merged at `27fb714`. The domain waves (accounts-001 onward) now run DTO validation for real under Vitest.
- **Still open after these fixes:** F-2/F-3 (user decisions), F-4/F-5 (test-planner/planner), F-7 (architect), F-9 (architect/planner). F-1 and F-6 are closed.

## 9. Checks performed (summary)

Environment (clean/synced/ancestry of all 7 merges) · full local CI-equivalent sequence (11 checks, all green) · twice-consecutive test runs · DB-unset guard behavior · fresh-DB migration + idempotency · fresh-DB e2e · web mechanism suite · CI run inspection (step-level, Node 24) · must-NOT-touch scope audit of PR #7's merge diff · line-by-line verification of TC-EXP-001/002/003 against the plan · field-for-field schema comparison vs 02 §4 · shared-package dependency audit · review-artifact existence/tracking audit · routed-flags cross-check across tickets, board, and review artifacts · SC/NFR due-now reconciliation · coverage-matrix both-direction reconciliation for the foundation scope.

**Bottom line:** the foundation is solid — every ticket's acceptance criteria hold under independent re-execution, the runner contract is complete and CI-gated, and the merged dev state is green end-to-end. Accept the phase; F-1 (decorator metadata) and F-6 (trunk promotion) are resolved post-verdict (PRs #9 / #8); decide F-2/F-3 as owner. The domain waves are unblocked with the harness honest for DTO validation.
