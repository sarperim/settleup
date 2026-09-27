# Review Round 1 — TKT-foundation-006 (PR #7)

PR: https://github.com/sarperim/settleup/pull/7
Branch: `tkt-foundation-006` → `dev` · Head at review: `7d07c3f`
Review date: 2026-09-27
Isolated checkout: `/tmp/opencode/settleup-pr7` (branch `review/tkt-foundation-006` tracking `origin/tkt-foundation-006`, clean, in sync)

Provenance note: an earlier session left an **uncommitted** draft of this artifact on disk (`.pipeline/plan/reviews/` is gitignored, so its intended commit silently never landed — no commit in any ref touches it). That draft was treated as an unverified self-report: it was **discarded and every claim re-derived from scratch** in this session. Where this artifact differs from that draft, the difference is called out (see "Corrections vs. the discarded draft").

Environment note: this round's three review lanes (compliance / code / security) were executed in-session by the review lead against the same per-lane checklists and brief structure as prior rounds — no separate reviewer sessions were dispatchable from this session. Lane findings are reported per-lane below exactly as in prior rounds. Every claim in the coder's implementation record was re-verified from scratch, never trusted.

## Blast radius gate (pass-1 dispatch decision)

**Classification: FULL — all three review lanes run.** Reasoning recorded:

- The diff ships executable logic: a DB-backed Vitest integration project + support code (`apps/api/test/integration/**`), the Playwright config + e2e canary (`apps/web/playwright.config.ts`, `apps/web/test/e2e/**`), a root runner config change (`vitest.config.ts` projects), a new operational script doing DB DDL via `execFileSync` (`scripts/e2e-db.mjs`), and a root `package.json` script change (`test:e2e`; stub `scripts/e2e-stub.mjs` deleted). Not presentation-only, not non-executable, not comment/formatting-only — every LOW condition fails.
- The ticket pins 6 explicit automated acceptance criteria — the compliance lane must verify them, which mandates the full pipeline.

## Scope fence (must-NOT-touch) — verified held

Diff files (11, `git diff --name-status origin/dev...HEAD`): `.pipeline/plan/tickets/TKT-foundation-006.md` (process bookkeeping, precedented), `apps/api/test/integration/**` (4 new), `apps/web/playwright.config.ts`, `apps/web/test/e2e/spa-canary.spec.ts`, root `package.json` (the `test:e2e` line only — exactly the ticket's mandate), `scripts/e2e-db.mjs` (new), `scripts/e2e-stub.mjs` (deleted), `vitest.config.ts` (root runner — the mechanism by which `pnpm test` grows to unit + integration; not on the must-NOT-touch list and required by the ticket's root-runner mandate). **Zero changes** to `.github/workflows/ci.yml`, `apps/api/src/**`, `packages/shared/src/**`, `apps/web/src/**`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`; `pnpm install --frozen-lockfile` passes.

## Reviewer verdicts (pass 1)

| Lane | Verdict | Blocking findings |
|------|---------|-------------------|
| compliance | **CLEAN** (compliant) | 0 violations (4 routing items → upstream owners) |
| code | **CLEAN** (approve) | 0 blockers, 0 should-fix (5 nits) |
| security | **CLEAN** (approve) | 0 critical/high (2 info observations) |

## Baseline gates (review-lead run; local Node 22.22.0 / pnpm 10.34.5, CI Node 24 — known and precedented)

`pnpm install --frozen-lockfile` ok · `pnpm --filter api exec prisma generate` ok (CLI 6.19.3; CI step-1 order) · `pnpm lint` exit 0 · `pnpm typecheck` exit 0 (requires the generated Prisma client, as CI's step order provides — pre-existing since f-004) · `pnpm build` exit 0 (web bundle 266.45 kB raw / **84.30 kB gzip** — unchanged from f-005) · `DATABASE_URL=… pnpm test` **three consecutive runs**: `Test Files 15 passed`, `Tests 72 passed`, exit 0 each · `pnpm test:e2e` against a **dropped-then-recreated** `settleup_e2e`: DB create + migrate + Playwright `1 passed`, exit 0; second run idempotent ("already exists" / "No pending migrations to apply."). `pnpm --filter web test`: 5 files / **47 tests** passed, exit 0 — the new `test/e2e/` Playwright spec does **not** leak into it (`apps/web/vite.config.ts` scopes the web Vitest project to `src/**/*.spec.{ts,tsx}`). CI run [36250120873](https://github.com/sarperim/settleup/actions/runs/36250120873) green on head `7d07c3f` (headSha verified; every step incl. "Unit & integration tests" and "E2E smoke tests (Playwright)" success); PR `mergeStateStatus: CLEAN`.

Environment accommodations (documented for reproducibility): the review host has no native `psql` client, so `scripts/e2e-db.mjs` was exercised through its supported `PSQL` env override (`/tmp/opencode/pr7-psql-shim.cjs`, read and verified line-by-line before use: faithful to the two invocation shapes the script uses — tuples-only SELECT via `-tAc`, command execution via `-c` with non-zero exit on error, matching ON_ERROR_STOP semantics). The local PostgreSQL (127.0.0.1:5432, user `settleup`, same credentials shape as the frozen CI workflow) is the same server prior rounds used.

## Acceptance criteria verification (compliance lane)

| Criterion | Verdict | Evidence |
|-----------|---------|----------|
| 1. `pnpm test` unit + integration on real PG; second consecutive run also passes | **PASS** | Three consecutive runs: 15 files / 72 tests, exit 0. Truncate isolation proven twice: (a) within-run — canary test 1 persists a `User` (count 1), test 2 starts from 0; (b) **mutation-verified** — with `truncateAllTables` neutered (env-gated early return, reviewer mutation), test 2 fails `expected 1 to be +0` (exit 1); reverted, tree byte-identical, final green run re-confirmed (the leftover row from the neutered run was itself cleaned by the next real truncate — self-healing proof). |
| 2. Unit passes with `DATABASE_URL` unset; integration fails with a clear message | **PASS** | `env -u DATABASE_URL pnpm test` → exit 1; unit `14 files / 70 tests passed`; integration canary FAIL at `setup-env.ts:24` with the full actionable guard message (points at strategy §2, gives a ready `DATABASE_URL=… pnpm test` line, notes the unit project is unaffected). |
| 3. Deliberately breaking a canary makes `pnpm test` exit non-zero | **PASS** | Both canary status assertions broken (404→500): `Tests 2 failed \| 70 passed`, exit 1, `AssertionError: expected 404 to be 500` ×2; reverted clean. |
| 4. `pnpm build && pnpm test:e2e` on a fresh `E2E_DATABASE_URL` DB | **PASS** | `settleup_e2e` dropped first (verified gone); `test:e2e` → `[e2e-db] creating database "settleup_e2e"` + migrations applied; Playwright booted `apps/api/dist/main.js` on 3011 serving the built SPA; spa-canary `1 passed` (217 ms), exit 0. Idempotent re-run verified (the CI shape). |
| 5. CI green with no workflow-file change | **PASS** | Run 36250120873 on headSha `7d07c3f…`: all steps success ("Upload build artifact" skipped — main-only, by design). Diff touches nothing under `.github/`. |
| 6. `pnpm lint` / `pnpm typecheck` exit 0 (harness code lint/type clean) | **PASS with FLAG-2 caveat** | Both exit 0. Because the new dirs sit outside the package globs (FLAG-2), the lanes verified the files directly: ESLint on the new TS files → 0 problems; scratch `tsc` → api-side `test/integration/**` clean as-is; web-side (`playwright.config.ts`, `spa-canary.spec.ts`) clean **once node types are supplied** — `apps/web` does not declare `@types/node` (lockfile freeze; same class as f-005 F-8). **Correction:** `scripts/e2e-db.mjs` is *not* direct-ESLint-clean — see F-5b/C-2. Substance of the criterion holds (the gates exit 0); the coverage gap is routed (C-2). |

## Consolidated findings (all non-blocking — nits and routing items; nothing enters a fix loop)

| ID | Severity | Source | Location | Status | Summary |
|----|----------|--------|----------|--------|---------|
| F-1 | nit | code | `scripts/e2e-db.mjs:22-27,34` | open (no action required) | A malformed `E2E_DATABASE_URL` (unparseable as URL) escapes as a raw `TypeError` instead of the friendly guard message (the guard checks presence, not validity); the no-database-name error echoes the full URL incl. credentials. Test tooling with controlled, throwaway-by-convention credentials — cosmetic. |
| F-2 | nit | code | `apps/web/playwright.config.ts:63` | open (no action required) | `reuseExistingServer: !CI` — a locally leftover process on 3011 would be silently reused (stale build / wrong DB). Standard Playwright tradeoff; acceptable. |
| F-3 | nit | code | `vitest.config.ts:46-47` | open (no action required) | `maxWorkers: 1` is redundant with `fileParallelism: false` — harmless, self-documenting. |
| F-4 | nit | code | `apps/api/test/integration/support/app.ts:47` | open (no action required) | `CSRF_HEADERS` exported ahead of its first consumer — intended plumbing for the domain specs this harness hosts (ticket: factories/headers land with domain tickets). |
| F-5 | nit | code | `apps/api/test/integration/support/app.ts:31-32` | open (no action required) | **New this round.** The doc comment says the ambient `DATABASE_URL` is "validated by `global-setup.ts`" — no such file exists anywhere in the repo; the guard is `setup-env.ts` (a project-scoped `setupFiles` guard, per NOTE-1). The comment contradicts the ticket's own NOTE-1 reasoning and could mislead domain-ticket coders. Comment-only. |
| C-1 | routing | compliance | root runner / CI | **routed out of loop → planner** | **Third consecutive ticket carrying f-005 F-3/C-2/F-8:** the web mechanism specs (`apps/web/src/**/*.spec.{ts,tsx}` — **5 files / 47 tests** on this head, verified by running `pnpm --filter web test`) still run in no CI-executed runner — zero ongoing regression protection for `apps/web` code. Not fixable here: the frozen workflow is must-NOT-touch, strategy §8 wires `pnpm test` as unit + integration only, and this ticket's scope follows both. Needs a planner/test-plan decision (root vitest project, a CI step, or explicit acceptance). |
| C-2 | routing | compliance | package lint/typecheck globs + root-script lint coverage + `apps/web` deps | **routed out of loop → planner** (ties to FLAG-2 / f-005 F-8) | New harness dirs are outside every lint/typecheck gate; `apps/web` cannot declare `@types/node` under the lockfile freeze, so `playwright.config.ts` + e2e specs are not type-gateable (scratch-verified: `Cannot find module 'node:url'`, `Cannot find name 'process'`). **FLAG-2 record correction (F-5b):** the ticket's "the new files were ESLint-verified directly (clean)" is not reproducible for `scripts/e2e-db.mjs` — a direct `npx eslint scripts/e2e-db.mjs` from the repo root yields **14 `no-undef` errors** (the root flat config ships no node globals for `.mjs`); no lint script covers root scripts at all (the deleted `e2e-stub.mjs` had the same gap — pre-existing convention, but the ticket's "clean" claim overstates). The TS harness files are direct-lint clean; api-side `test/integration/**` is scratch-`tsc` clean; extending the api globs today would fail on pre-existing `test/unit` errors (exactly the two files FLAG-2 names — `tc-foundation-004-a5-request-logging.spec.ts` ×2 at lines 159–160, `unmapped-exception-status.spec.ts` ×1 at line 114; reviewer-reproduced). One central decision: declare deps when the freeze lifts + fix the pre-existing unit-spec type errors + decide root-script lint coverage, then extend the globs. |
| C-3 | routing | compliance | `scripts/e2e-db.mjs` vs strategy §5 | **routed out of loop → planner/test-planner + domain-e2e owners** | Strategy §5's "the e2e database is recreated per run" holds only in CI (fresh service container). Locally `e2e-db.mjs` reuses a persistent `settleup_e2e` — once domain e2e journeys land with §5's fixed identities created through the UI, local re-runs will collide (e.g. `EMAIL_TAKEN`). Today's read-only canary is unaffected and the ticket delivers exactly 04 §4 step 4's create+migrate shape. Decide before the domain e2e suites: a dev-only reset mode, journey idempotency, or a §5 amendment for local runs. |
| C-4 | routing | compliance | `apps/web/playwright.config.ts:53` | **routed out of loop → test-planner** (new this round) | `fullyParallel: true` against a **single shared** e2e database + strategy §5's **fixed** identities: today's single read-only canary is unaffected, but stateful domain e2e journeys running in parallel would race on shared identities/rows (e.g. two specs registering `alice@test.local` concurrently). Not a defect of this ticket's deliverable; must be decided (serialize the suite, per-worker identities, or per-worker databases) before the domain e2e suites land — strategy §7 rule 1 (order-independence) is at stake. |
| S-1 | info | security | `playwright.config.ts` webServer | open (no action) | The e2e webServer boots the production artifact with its production listen behavior (all interfaces) for the run's duration against the throwaway e2e DB — inherent to "boot the real artifact" e2e; auto-stopped by Playwright afterwards. Adjacent (code-lane note, folded here): `CREATE DATABASE "${databaseName}"` interpolates the URL-derived name into a double-quoted identifier without escaping — operator/CI-controlled input in test tooling (the operator can already run arbitrary psql), so no plausible attack path; same trust class as F-1. |
| S-2 | info | security | DEVIATION-1 consequence | open (no action) | `playwright install chromium` downloads per CI run (no cache step). Current CI total 1m4s — well inside budget; 04 §4 explicitly defers browser caching as optional. |

## Positions on the ticket's FLAG/DEVIATION record

- **DEVIATION-1** (`playwright install chromium` inline in root `test:e2e`): **accepted.** Premise verified: `pnpm-workspace.yaml`'s `onlyBuiltDependencies` allowlist (argon2, esbuild, `@prisma/client`, `@prisma/engines`, prisma) blocks Playwright's postinstall, and the frozen `ci.yml` has no browser-install step; the in-scope alternative (allow-listing `playwright`) edits `pnpm-workspace.yaml`, outside this ticket's stated root-`package.json` scope. Proven necessary and sufficient: CI green with the script as-is. Follow-up (browser caching) is 04 §4's own optional item (S-2).
- **DEVIATION-2** (idempotent e2e DB create + migrate in `scripts/e2e-db.mjs`): **accepted.** Both paths verified live: fresh create (dropped DB → created + migrated) and the CI shape (already exists → skip, `migrate deploy` no-op). Mirrors the frozen workflow's f-007 C-2 fix (maintenance-connection CREATE). Local-run freshness gap routed as C-3.
- **NOTE-1** (project-scoped `setupFiles` guard, not `globalSetup`): **accepted — verified correct.** The unset-`DATABASE_URL` run shows the unit project completing 70/70 while only the integration file fails with the guard message; a `globalSetup` throw would have aborted the unit project too, failing criterion 2. The ticket's reasoning is exactly right. (The stale `global-setup.ts` comment in `app.ts` is F-5 — comment-only, does not affect behavior.)
- **NOTE-2** (canary's direct Prisma `User` write): **accepted, boundary clearly drawn.** Strategy §5's "write paths through the API" governs domain suites; the canary's write is the harness proving its own isolation, there is no API write route until the domain tickets, and the write is inert (fake hash, test DB). The spec file's header pins this distinction. Domain suites must not adopt the pattern for domain facts.
- **FLAG-1** (web mechanism specs stay outside root `pnpm test`): **accepted as scope-accurate** — the ticket defines `pnpm test` as the f-007 unit project + integration per the frozen 04 §3 contract, and strategy §8 wires the web suite as e2e only. The consequence is not waived, it is carried: C-1.
- **FLAG-2** (harness dirs outside lint/typecheck globs): **accepted in structure, corrected in one detail.** Verified: new TS files ESLint-clean; api-side type-clean; web-side type-clean given node types; extending the api globs today would fail on exactly the two pre-existing files named. **Correction:** the "new files were ESLint-verified directly (clean)" sentence does not hold for `scripts/e2e-db.mjs` (14 `no-undef` errors under the root config; no gate covers root scripts — see C-2/F-5b). Carried as C-2.

## Security verification summary

No vulnerability with a plausible attack path. No new dependencies (lockfile untouched, `--frozen-lockfile` install passes; `supertest` root-declared and `@playwright/test` web-declared both predate this PR — verified via `git log -S` to scaffold commit `f125751`). Process execution uses `execFileSync` with argument arrays (no shell interpolation); SQL identifiers come from `pg_catalog` (not user input) and the one interpolated literal is quote-escaped; the remaining interpolation (`CREATE DATABASE "${name}"`, S-1 note) is operator-controlled test tooling. `TRUNCATE … RESTART IDENTITY CASCADE` is correctly scoped to `public` application tables and correctly excludes `_prisma_migrations` (truncating it would corrupt migration bookkeeping — the exclusion is a correctness detail, verified in code). The e2e webServer isolates `DATABASE_URL` to the e2e database (spread order verified — the ambient integration URL cannot win). No secrets/PII in specs; the canary's `passwordHash` is an inert literal; the only credential echo is F-1's nit in an error path with throwaway-by-convention test credentials. Dependencies, configuration, and resource-exhaustion lanes clean.

## Upstream defects routed out of the loop (never enter the fix loop)

1. **C-1 → planner:** decide how `apps/web`'s mechanism specs (5 files / 47 tests) get CI regression protection (third ticket carrying f-005 F-3/C-2/F-8). Recommend the loop gates this decision before dependent web-heavy domain tickets land.
2. **C-2 → planner:** dependency declarations under the lockfile freeze (`@types/node` for apps/web; f-005 F-8's `vitest`), the pre-existing `apps/api/test/unit` type errors, the lint/typecheck globs, and root-script (`scripts/*.mjs`) lint coverage — one central decision, then the gates can extend over the harness dirs and the FLAG-2 record correction can be folded in.
3. **C-3 → planner/test-planner + domain-e2e owners:** local e2e-database freshness vs strategy §5's fixed identities — decide before the domain e2e suites land.
4. **C-4 → test-planner:** `fullyParallel` + single shared e2e DB + §5 fixed identities — decide the parallelism/identity scheme before stateful domain e2e journeys land.

## Mergeability (pass 1)

Open blocking findings (compliance violation / code-review blocker / critical-high security): **ZERO.** All findings are nits (F-1…F-5) or routing/info items (C-1…C-4, S-1, S-2) — none block by rule.

**RESULT: MERGEABLE on pass 1.**

## Loop status

Clean pass 1 — the loop ends early. No fixer dispatch (nothing to fix: no blocking findings, and every routed item is an upstream/planner decision, not a code defect on this branch). The artifact is committed to the PR branch per the established pattern (as f-005's rounds were — force-added past the `.pipeline/plan/reviews/` gitignore entry, which is also why the prior session's identical-named draft never landed); the PR head moves forward by this docs-only commit and CI re-runs on it — expected green (touches only `.pipeline/plan/` docs).

Ticket file status left at `in-review` — the merge decision and the `done` transition belong to the user.

## Corrections vs. the discarded draft

1. Web mechanism spec count: **47 tests / 5 files** (draft said "45" — that was f-005 round-1's count; two specs were added in f-005's fix round).
2. FLAG-2 "all new files ESLint-clean": **not reproducible for `scripts/e2e-db.mjs`** (14 `no-undef` errors; see C-2).
3. New findings the draft missed: **F-5** (stale `global-setup.ts` comment) and **C-4** (`fullyParallel` vs fixed identities on a shared e2e DB).
4. The draft's "logs retained under `/tmp/opencode/pr7-*.log`" was wrong (only the psql shim matches that glob); this round's logs are `/tmp/opencode/r7-*.log`.

Environment notes: verification on Node v22.22.0 local (CI Node 24; engine warning known and precedented). Reviewer mutations (broken canary, neutered truncate) applied via env-gated/edited files, reverted; scratch tsconfigs created and removed; worktree left clean. Review-lead logs retained under `/tmp/opencode/r7-*.log`.
