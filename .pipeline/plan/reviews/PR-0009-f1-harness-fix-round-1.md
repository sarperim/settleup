# Review Round 1 — PR #9 (post-acceptance harness fix, acceptance finding F-1)

PR: https://github.com/sarperim/settleup/pull/9
Branch: `fix/f1-decorator-metadata-harness` → `dev` · Head at review: `16db510` · Base: `b77409c` (= `origin/dev` tip; merge-base verified)
Review date: 2026-09-27
Isolated checkout: `/tmp/opencode/review-f1` — **detached HEAD at `16db510`** (the branch is concurrently checked out by acceptance verification in `/tmp/opencode/verify-f1`; a detached checkout at the same commit reviews the identical tree without disturbing it). Tree clean at review start and at every gate.

Scope context: user-directed post-acceptance fix closing acceptance finding **F-1** (`.pipeline/acceptance-report.md` §7) — TKT-foundation-004 **FLAG-3** (Vitest/esbuild emits no `design:paramtypes`; production `nest build`/tsc does; the global ValidationPipe therefore silently skips DTO validation under Vitest) was routed to TKT-foundation-006 in f-004's round-1 artifact and dropped in transit. PR #9 lands the transform (official NestJS+Vitest recipe: `unplugin-swc` + `@swc/core`), deletes the a3 hand-injection workaround, and adds a permanent harness-pin spec.

Environment note: this round's three review lanes (compliance / code / security) were executed in-session by the review lead against the same per-lane checklists as prior rounds — no separate reviewer sessions were dispatchable from this session (same precedent recorded in TKT-foundation-006 round 1). Lane findings are reported per-lane below exactly as in prior rounds. Every claim in the ticket addendum's evidence record was re-verified from scratch, never trusted. Review-lead test DB: `settleup_test` (concurrent acceptance verification owns `settleup_acceptance`; local Postgres 127.0.0.1:5432). Node 22 engine warning observed and known.

## Blast radius gate (pass-1 dispatch decision)

**Classification: FULL — all three review lanes run.** Reasoning recorded:

- The diff ships executable config and manifests: `vitest.config.ts` (both Vitest projects gain the SWC plugin — executed on every test run), root `package.json` + `pnpm-lock.yaml` (new devDependencies), plus new/modified executable test code (`harness.decorator-metadata.spec.ts` new, a3 spec modified). Not presentation-only, not non-executable, not comment/formatting-only — every LOW condition fails.
- Dependency-manifest and test-runner changes are exactly the class the security and compliance lanes exist for (supply chain + lockfile-ownership rules).

## Scope fence (allowed set) — verified held

Diff files (exactly 6, `git diff --name-status origin/dev...HEAD`; `--summary` shows no renames, no mode changes, 1 create + 5 modify):

| File | Change |
|---|---|
| `.pipeline/plan/tickets/TKT-foundation-006.md` | +12 lines, **pure addition** at EOF (post-acceptance addendum; no prior content altered; ticket `Status: done` unchanged) |
| `apps/api/test/unit/harness.decorator-metadata.spec.ts` | new (89 lines) — the harness pin |
| `apps/api/test/unit/tc-foundation-004-a3-validation-internal.spec.ts` | comment rewritten + `Reflect.defineMetadata` hand-injection block deleted; nothing else |
| `package.json` | +2 root devDependencies (`@swc/core ^1.16.2`, `unplugin-swc ^2.0.0`) |
| `pnpm-lock.yaml` | the dependency additions (+ peer-suffix re-annotation, see F-1 nit) |
| `vitest.config.ts` | +13 (import, explanatory comment, `plugins: [swc.vite()]` on both projects) |

**Zero changes** to `.github/workflows/ci.yml`, `apps/api/src/**`, `apps/web/**`, `packages/**`, `apps/api/prisma/**`, `pnpm-workspace.yaml`, any other ticket file, architecture docs, `.pipeline/acceptance-report.md`. Exactly the 6 allowed files; no scope creep — every hunk is in direct service of the F-1 fix.

## Reviewer verdicts (pass 1)

| Lane | Verdict | Blocking findings |
|------|---------|-------------------|
| compliance | **CLEAN** (compliant) | 0 violations |
| code | **CLEAN** (approve) | 0 blockers, 0 should-fix (1 nit) |
| security | **CLEAN** (approve) | 0 critical/high (2 info observations) |

## Baseline gates (review-lead run, from scratch in the isolated worktree)

- `pnpm install --frozen-lockfile` — exit 0 (2.7 s; resolves `@swc/core 1.16.2`, `unplugin-swc 2.0.0`; prints the ticket's documented `Ignored build scripts: @swc/core@1.16.2` warning and nothing else unexpected).
- `pnpm --filter api exec prisma generate` then `pnpm typecheck` — exit 0. (Fresh-worktree note: typecheck requires the generated Prisma client first — **pre-existing since f-004**, documented in TKT-foundation-006 round 1's baseline gates; CI's frozen step order provides it at `ci.yml:76`. Not introduced by this PR.)
- `pnpm lint` — exit 0.
- `DATABASE_URL=postgresql://settleup:settleup@localhost:5432/settleup_test pnpm test` — **run 1: `Test Files 16 passed (16)`, `Tests 74 passed (74)`, exit 0**; **run 2 (consecutive): `Test Files 16 passed (16)`, `Tests 74 passed (74)`, exit 0** — truncate isolation holds; baseline 72 + 2 pin, matching the ticket's claim.
- `env -u DATABASE_URL pnpm test` — exit 1; unit `Tests 72 passed` (15 files, incl. the new pin — it needs no DB); integration canary fails with exactly `The integration test project requires DATABASE_URL.`
- `pnpm build` — exit 0 (web bundle 266.45 kB raw / 84.30 kB gzip; api via `nest build` — the production tsc path, unchanged).
- `pnpm --filter web test` — 5 files / **47 tests** passed, exit 0.
- CI on head `16db510`: run [36288231487](https://github.com/sarperim/settleup/actions/runs/36288231487) green with zero workflow-file change (coder claim; final-head CI re-checked below after the artifact commit).

## Mutation proof (mandatory) — the pin actually pins the SWC transform

Reviewer mutation: both `plugins: [swc.vite()]` lines commented out in `vitest.config.ts` (unit + integration projects), then the pin spec run alone:

```text
 RUN  v4.1.11 /tmp/opencode/review-f1

 ❯ |unit| apps/api/test/unit/harness.decorator-metadata.spec.ts (2 tests | 1 failed) 109ms
     × rejects an invalid DTO with 400 VALIDATION_FAILED in the §4 envelope 32ms

⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯

 FAIL  |unit| apps/api/test/unit/harness.decorator-metadata.spec.ts > Vitest harness emits decorator metadata (F-1) > rejects an invalid DTO with 400 VALIDATION_FAILED in the §4 envelope
AssertionError: expected 201 to be 400 // Object.is equality

- Expected
+ Received

- 400
+ 201

 ❯ apps/api/test/unit/harness.decorator-metadata.spec.ts:73:29
     71|       .send({ age: 'not-a-number' });
     72|
     73|     expect(response.status).toBe(400);
       |                             ^
     74|     expect(response.body.error.code).toBe('VALIDATION_FAILED');
     75|     expect(Object.keys(response.body)).toEqual(['error']);

 ⎯⎯⎯⎯⎯⎯⎯⎯⎯⭎⎯⎭⎯⎯[1/1] ⎯⎯⎯⎯⎯⎯

 Test Files  1 failed (1)
      Tests  1 failed | 1 passed (2)
   Start at  05:30:45
   Duration  776ms (transform 133ms, setup 0ms, import 549ms, tests 109ms, environment 4ms)
```

(decorative separator glyphs elided; assertion text verbatim). Exit 1. This is the **exact** failure mode the pin's header comment prescribes (500/201 instead of 400 → the transform was removed/misconfigured; do NOT hand-inject, do NOT debug the pipe) and matches the ticket's Phase-1 RED evidence (`expected 201 to be 400`). The valid-DTO half still passed (201) — the mutation isolates the metadata gap precisely, proving the 400 depends on compiler-emitted `design:paramtypes` and nothing else.

Restore + re-verify: `git checkout -- vitest.config.ts` (tree byte-identical, `git diff --exit-code` clean), then `env -u DATABASE_URL pnpm exec vitest run harness.decorator-metadata tc-foundation-004-a3` → **2 files / 5 tests passed, exit 0** — pin 2/2 **and** a3 3/3 with **no hand-injection** (the harness now supplies the metadata natively).

## Compliance lane

1. **Allowed-file set:** exactly the 6 files above; no renames/mode changes (name-status + summary). **Held.**
2. **Frozen/protected paths:** zero diff in `.github/workflows/ci.yml`, `apps/api/src/**`, `apps/web/**`, `packages/**`, `apps/api/prisma/**`, `pnpm-workspace.yaml`, other ticket files, architecture docs, `.pipeline/acceptance-report.md`. **Held.**
3. **Addendum faithfulness (every citation re-checked at source):**
   - FLAG-3 text quoted in the addendum is **verbatim** from `TKT-foundation-004.md` (the flagged-during-implementation block); the warning, the esbuild/tsc contrast, the "silently skip validation" consequence, and the SWC suggestion all match.
   - Routing row exists at `TKT-foundation-004-round-1.md:82`: "FLAG-3 … | test-planner (TKT-foundation-006) | Verified genuine …". The "dropped in transit" claim matches the acceptance report's F-1 (grep across `.pipeline/` at acceptance time found FLAG-3 only in the f-004 ticket).
   - **User grant:** acceptance-report §7 F-1 (High — resolve before TKT-accounts-001, routed to planner/test-planner + coder follow-up, user decides scheduling) + the dispatch to this review states the fix and the lockfile waiver were user-directed 2026-09-27. Corroborated by the dispatcher's brief.
   - **Fix description:** matches the diff exactly (both deps at root, plugin on both projects, the root-plugins-don't-propagate rationale, tsconfig-include wrinkle).
   - **Red/green evidence:** independently reproduced this round (mutation proof above reproduces the RED failure mode verbatim: `expected 201 to be 400`; GREEN numbers 16/74 twice, pin 2/2, a3 3/3 no-hand-injection all re-run by the reviewer).
   - **Lockfile waiver with precedent:** recorded, citing f-007 **USER-DECISION-2** (verified at `TKT-foundation-007.md:10` — the vitest security bump that waived TKT-foundation-001's root-baseline lockfile ownership). Same waiver class, same authority (user), recorded before merge.
4. **Ticket Status:** still `done`; addendum is pure addition. **Held.**
5. **Scope discipline:** post-acceptance fix, not a re-opened ticket — no acceptance-criteria edits, no new scope beyond the F-1 dispatch; board and other artifacts untouched. **Held.**

## Code lane

1. **SWC wiring:** `plugins: [swc.vite()]` present on **both** inline projects (root-level plugins indeed do not propagate into `test.projects` — the per-project placement is the correct shape, and the official NestJS docs recipe wires it per config file the same way). The explanatory comment is accurate (verified against the mutation proof's behavior).
2. **Shared-spec compatibility:** `packages/shared` specs contain **zero decorators** (the only `@` hits in shared specs are `alice@test.local` string literals) and passed in both full runs under the SWC transform (16/74 × 2). Web suite unaffected (separate runner, 47/47).
3. **a3 edit surgical:** diff = comment rewrite + deletion of the `Reflect.defineMetadata('design:paramtypes', …)` block only; `import 'reflect-metadata'` retained (line 8 — still required at runtime for the decorators' reflect machinery). a3 passes 3/3 without hand-injection.
4. **Pin-spec quality:** no `Reflect.defineMetadata` anywhere in the repo's code (repo-wide grep; the only textual hit is the pin's own comment describing the removed workaround). It exercises the **real global pipe** via the production app factory — `configurePlatform` (`apps/api/src/app.factory.ts:70` → `app.useGlobalPipes(createValidationPipe())`), the identical mechanism a3 uses. Envelope assertions match 03-api-design.md §4 (line 95: `400 VALIDATION_FAILED — DTO validation (details lists offending fields)`) and mirror the review-accepted a3 assertions (`error.code`, top-level keys `['error']`, `details.fields`). Failure-mode comment is empirically accurate (mutation proof). Scratch module, no DB, no production routes — strategy §2 clean.
5. **Lockfile:** root importer adds exactly the two devDependencies with specifiers matching `package.json` (`^1.16.2`→`1.16.2`, `^2.0.0`→`2.0.0`); no other importer gains dependencies; the `@nestjs/cli` entry keeps version `11.0.24` with only a peer-resolution suffix added (see F-1 nit). New package entries all trace to the SWC tree: `@swc/core` + its 12 per-platform optional native deps, `@swc/types`, `@swc/counter`, `@swc/helpers`, `unplugin`, `unplugin-swc`, `@rollup/pluginutils@5.4.0`, `webpack-virtual-modules@0.6.2` (unplugin's optional peer; webpack itself pre-existed via `@nestjs/cli`).

## Security lane

1. **Supply chain:** `unplugin-swc@2.0.0` and `@swc/core@1.16.2` are **both the current `latest`** on the npm registry (verified via registry `latest` endpoints), published through npm **trusted publishers (GitHub Actions OIDC)** with **SLSA provenance attestations** and registry signatures. Maintainers: unplugin org (EGOIST/hannoeru — core Vite/Vite-plugin ecosystem maintainers) and the swc-project (kdy1, SWC's author). Licenses MIT / Apache-2.0. Versions are current, not pinned to odd forks; integrity hashes present in the lockfile; **zero URLs/tarball hosts added to the lockfile** (default registry only).
2. **Documented recipe:** the official NestJS documentation (`docs.nestjs.com`, source `nestjs/docs.nestjs.com` `content/recipes/swc.md`) prescribes exactly `npm i --save-dev vitest unplugin-swc @swc/core` + `swc.vite()` in `vitest.config.ts` for the `emitDecoratorMetadata` gap — this PR is that recipe.
3. **Dev-only, no runtime impact:** both packages are root `devDependencies`; no importer gains a runtime dependency; production builds go through `nest build` (tsc) — `vitest.config.ts` is never consulted.
4. **No new scripts/exec surface:** the new spec imports only pre-existing test support (`applyTestEnv`, `memoryLogDestination`, `configurePlatform`, `buildLogger` — all unchanged by this PR; `test-env.ts` uses only `node:net` for a free port, pre-existing). No `child_process`, no network beyond in-process supertest against the scratch module.
5. **No secrets:** no tokens/keys in the diff; the only credential-shaped string (`postgresql://settleup:settleup@127.0.0.1:5432/settleup_test`) lives in a **pre-existing, unchanged** helper as the documented local dev credential.
6. **`pnpm-workspace.yaml` unchanged:** `@swc/core`'s postinstall is **not** allowlisted — pnpm's default-deny blocks it (the install warning), which is the safer posture, and the transform works regardless because `@swc/core` ships per-platform optional native deps (empirically proven: every green run above executed the transform with the postinstall blocked). The ticket's wrinkle documents this accurately.

## Consolidated findings (all non-blocking — nothing enters a fix loop)

| ID | Severity | Source | Location | Status | Summary |
|----|----------|--------|----------|--------|---------|
| F-1 | nit | code | `pnpm-lock.yaml` (`@nestjs/cli` importer entry) | open (no action required) | Adding root `@swc/core` caused pnpm to re-resolve `@nestjs/cli`'s peer suffix (`11.0.24` → `11.0.24(@swc/core@1.16.2)(@types/node@24.13.6)(esbuild@0.25.12)`) — same version, annotation-only churn. Expected pnpm behavior; lockfile still `--frozen-lockfile`-consistent. |
| F-2 | info | security | `pnpm-workspace.yaml` / `@swc/core` postinstall | open (no action required) | `@swc/core`'s postinstall remains blocked by the default-deny allowlist. Verified benign (optional native deps load without it; all gates green). If a future `@swc/core` release ever makes the postinstall load-bearing, the failure will surface as the pin spec redding with the documented 500/201 signature — exactly the tripwire this PR installs. |
| F-3 | info | code | `pnpm-lock.yaml` new transitive entries | open (no action required) | New lockfile entries beyond the two direct deps: `@swc/types`, `@swc/counter`, `@swc/helpers`, 12 `@swc/core-*` platform binaries, `unplugin@3.4.0`, `@rollup/pluginutils@5.4.0`, `webpack-virtual-modules@0.6.2` (unplugin optional peer; webpack itself pre-existed via `@nestjs/cli`). All dev-only, integrity-pinned, default registry. |

Environment note (not a finding): fresh-worktree `pnpm typecheck` requires `pnpm --filter api exec prisma generate` first — pre-existing since f-004, already documented in TKT-foundation-006 round 1's baseline gates; CI's frozen step order (`ci.yml:76`) provides it. Reproduced this round before recording exit 0.

## Verdict

**Zero open blocking findings across all three lanes → MERGEABLE. Loop ends early on a clean pass 1; no fixer dispatch.** Per the dispatch brief, the review lead does **not** merge — the acceptance agent verifies and merges PR #9. Ticket `TKT-foundation-006`'s status remains `done`; this artifact is committed to the PR branch (the gitignored `reviews/` dir force-added per the f-004/f-005/f-006 pattern) so the review history lands in `dev` with the merge — no separate copy into a main checkout is needed, unlike the prior uncommitted-draft incident recorded in f-006 round 1.
