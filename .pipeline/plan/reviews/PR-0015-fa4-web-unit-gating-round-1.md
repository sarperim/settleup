# Review Round 1 — PR #15 (post-acceptance runner fix, acceptance finding F-A4)

PR: https://github.com/sarperim/settleup/pull/15
Branch: `fix/fa4-web-unit-gating` → `dev` · Head at review: `006a7f1` · Base: `d8d6165` (= `origin/dev` tip; merge-base verified — the three-dot diff equals the two-dot diff) · Single commit.
Review date: 2026-09-27
Isolated checkout: `/tmp/opencode/settleup/review-fa4` (branch `review/fa4-web-unit-gating` at the PR head). Tree clean at review start, after every mutation, and at artifact commit. The coder's worktree (`/tmp/opencode/settleup/fix-fa4`) and the main checkout were never touched.

Scope context: user-directed post-acceptance fix closing acceptance finding **F-A4** (`.pipeline/acceptance-report.md` §I.7; carried from foundation F-4, 4th consecutive phase): the 5 web mechanism spec files (`apps/web/src/{api/client.spec.ts, api/errors.spec.ts, App.spec.tsx, money.spec.ts, routes.spec.ts}`; 44 tests) sat outside the root runner and therefore outside frozen CI step 3 (`pnpm test`) — they ran only via the manual `pnpm --filter web test`. The fix adds a third `web-unit` Vitest project to root `vitest.config.ts` so the existing CI step gates them; no workflow change, no new dependency. Recorded as a strictly-additive addendum in `TKT-foundation-006.md` (the runner-contract owner), following the PR #9 / F-1 user-directed-fix precedent.

Environment note: this round's three review lanes (compliance / code / security) were executed in-session by the review lead against the same per-lane checklists as prior rounds — no separate reviewer sessions were dispatchable from this session (precedent: PR #9 round 1, TKT-foundation-006 round 1). Lane findings are reported per-lane below. Every claim in the PR body and the ticket addendum was re-verified from scratch, never trusted. Review-lead DBs: `settleup_fa4_rev_test` (unit+integration) and `settleup_fa4_rev_e2e` (e2e, fresh — dropped first); local PostgreSQL 17.11 at 127.0.0.1:5432. Local runs on Node 22.22.0 / pnpm 10.34.5 (repo pins `engines >=24`; CI runs Node 24 — and this round the CI step log was read directly to confirm 48/169 on Node 24, so local/CI parity is proven, not assumed). Both DBs dropped after the round.

## Blast radius gate (pass-1 dispatch decision)

**Classification: FULL — all three review lanes run.** Reasoning recorded:

- The diff ships executable test-runner **config**: `vitest.config.ts` gains a third project that redefines what the frozen CI step `pnpm test` executes **on every future PR**. The LOW gate's first two conditions (presentation-only/non-executable files; no config/build files touched) both fail on `vitest.config.ts` alone.
- Even though no production code is touched, a runner-contract change is exactly the class the compliance lane (frozen-CI / runner-contract / recording rules) and the security lane (what code CI now executes, module-resolution changes) exist for. "Ambiguous = full"; this is not even ambiguous.

## Scope fence (allowed set) — verified held

Diff files (exactly 2, `git diff --name-status origin/dev...HEAD`; `--summary` empty — no creates, renames, or mode changes; both files modifications; single commit `006a7f1`):

| File | Change |
|---|---|
| `vitest.config.ts` | +32/−2 — `node:url` import, `sharedSrc` const, extended comment block, third `web-unit` project (include/node env/project-scoped `resolve.alias`) |
| `.pipeline/plan/tickets/TKT-foundation-006.md` | +19/−0 — **pure addition** at EOF (post-acceptance F-A4 addendum; no prior content altered; ticket `Status: done` unchanged) |

**Zero changes** to `.github/workflows/ci.yml` and `pnpm-lock.yaml` — `git diff --exit-code origin/dev...HEAD` on both: **byte-identical**. The 5 web spec files: `git diff --exit-code` on all five — **content unchanged** (no weakened/skipped/deleted assertions; no `.skip`/`.only`/`.todo` anywhere in `apps/web/src`). No changes under `apps/api/**`, `packages/**`, `apps/web/**` (whole-tree check, not just the specs). Exactly the 2 allowed files; no scope creep — every hunk is in direct service of the F-A4 fix.

## Reviewer verdicts (pass 1)

| Lane | Verdict | Blocking findings |
|------|---------|-------------------|
| compliance | **CLEAN** (compliant) | 0 violations |
| code | **CLEAN** (approve) | 0 blockers, 0 should-fix (0 nits) |
| security | **CLEAN** (approve) | 0 critical/high (0 info observations beyond notes below) |

## Baseline gates (review-lead run, from scratch in the isolated worktree)

- `pnpm install --frozen-lockfile` — exit 0 (2.2 s; only the documented benign `Ignored build scripts: @swc/core@1.16.2` warning).
- `pnpm --filter api exec prisma generate` — exit 0. `pnpm lint` — exit 0 (3 projects). `pnpm typecheck` — exit 0 (3 projects). `pnpm build` — exit 0; SPA bundle **86.81 kB gzip** (matches the PR claim; api via `nest build`, the production tsc path, unchanged).
- Fresh throwaway DB `settleup_fa4_rev_test` (dropped/created via psql, `prisma migrate deploy` clean), then `DATABASE_URL=… pnpm test` — **run 1: `Test Files 48 passed (48)`, `Tests 169 passed (169)`, exit 0; run 2 (consecutive): identical, exit 0** — truncate isolation holds. Arithmetic reconciles: 43 files/125 tests baseline + 5 web files/44 tests = 48/169, matching the PR claim exactly.
- `pnpm --filter web test` — **5 files / 44 tests passed**, exit 0 (per-package runner unchanged; both runners coexist).
- **DB-unset guard:** `env -u DATABASE_URL pnpm test` — **exit 1**; `Test Files 27 failed | 21 passed (48)` / `Tests 118 passed (118)`; every integration file fails at the setup guard with the exact pre-existing message `Error: The integration test project requires DATABASE_URL.` (verbatim from `setup-env.ts:24`); the 21 passing files = 16 unit + **5 web-unit** (118 = 74 unit + 44 web — the web specs need no DB). Guard semantics preserved bit-for-bit by the third project.
- **E2E (fresh `settleup_fa4_rev_e2e`, dropped first):** `E2E_DATABASE_URL=… PSQL=<pg17.11>/psql pnpm test:e2e` — exit 0; e2e-db create + migrate → system **1 passed (1)** → Playwright **6 passed (6)**.
- **CI on head `006a7f1`:** run [36302837051](https://github.com/sarperim/settleup/actions/runs/36302837051) — completed, **success**, zero workflow-file change. Step log read directly: Node **v24.21.0**, "Unit & integration tests" step reports **`Test Files 48 passed (48)` / `Tests 169 passed (169)`** — the web specs now execute in frozen CI on Node 24. E2E step green (1/1 + Playwright).

## Mutation proofs (mandatory, both directions, independently reproduced)

**Post-fix (the gate now gates).** Reviewer mutation: `apps/web/src/money.spec.ts:28` `.toBe('123.45')` → `.toBe('999.99')` (identical to the coder's mutation). Root `pnpm test` with `DATABASE_URL` set:

```text
 ❯ |web-unit| apps/web/src/money.spec.ts (2 tests | 1 failed) 11ms
     × formats integer kuruş as 2-decimal TRY text 7ms
 FAIL  |web-unit| apps/web/src/money.spec.ts > money helper wiring > formats integer kuruş as 2-decimal TRY text
 Test Files  1 failed | 47 passed (48)
      Tests  1 failed | 168 passed (169)
```

**Exit 1** (captured on a re-run outside the log-filter pipe). The failing file is named under the `|web-unit|` project tag — exactly the coder's claimed failure shape and numbers.

**Pre-fix (the gap was real).** Same mutation retained; `vitest.config.ts` swapped to `origin/dev`'s version (`git show origin/dev:vitest.config.ts`). Root `pnpm test`: **`Test Files 43 passed (43)` / `Tests 125 passed (125)`, exit 0** — the broken web spec was invisible to the root runner. This independently confirms F-A4's premise (a mutated web spec passed the gate on `dev`).

**Restore + re-verify:** `git checkout -- apps/web/src/money.spec.ts vitest.config.ts`; `git diff --exit-code` + `git status --short` → tree clean at the PR head; full suite re-run → **48/169 passed, exit 0**.

## Compliance lane

1. **Allowed-file set:** exactly the 2 files above; no renames/mode changes; single commit. **Held.**
2. **Frozen/protected paths:** `.github/workflows/ci.yml` and `pnpm-lock.yaml` byte-identical (`git diff --exit-code`); zero diff under `apps/api/**`, `packages/**`, `apps/web/**`, `pnpm-workspace.yaml`, root `package.json`, other ticket files, architecture docs, `.pipeline/acceptance-report.md`. **Held** — the fix gates the SPA through the *existing* frozen CI step without touching the workflow, which is the entire point of the project approach.
3. **Addendum faithfulness (every citation re-checked at source):**
   - The F-A4 description in the addendum matches the acceptance report §I.7 row verbatim in substance: web mechanism suite (44 tests incl. acc-005's reworked `App.spec.tsx`), outside root `pnpm test` and CI, ran only via `pnpm --filter web test`, severity Medium, carried from foundation F-4 (4th consecutive phase, scope grew when acc-005 made `App.spec.tsx` the SPA's only route-wiring coverage). The 5 file paths and 44-test count match the tree (exactly 5 spec files match the include pattern; 44 tests counted in every run).
   - **User grant:** the dispatcher's brief confirms the fix was user-directed 2026-09-27 (F-A4 dispatched to TKT-foundation-006, the runner-contract owner; PR #9/F-1 precedent). The addendum records the same grant. Corroborated.
   - **Fix description:** matches the diff exactly (third project, include pattern, node env, project-scoped alias to `packages/shared/src/index.ts`, comment block extension, no new dependency, no `@vitejs/plugin-react`).
   - **Red/green evidence:** independently reproduced both directions this round (mutation proofs above — pre-fix green/exit 0, post-fix red/exit 1 with the file named, restored green 48/169).
   - **No-deviation claim:** holds — no lockfile, no workflow, no manifests touched; nothing to waive.
4. **Ticket Status:** still `done`; addendum is pure addition at EOF (+19/−0). Board untouched. **Held.**
5. **Scope discipline:** post-acceptance user-directed fix, not a re-opened ticket; no acceptance-criteria edits; recording follows the PR #9 precedent for user-directed runner-contract fixes. **Held.**

## Code lane

1. **Project config correctness:** `web-unit` — `include: ['apps/web/src/**/*.spec.{ts,tsx}']` matches exactly the 5 spec files that `apps/web/vite.config.ts`'s own `include: ['src/**/*.spec.{ts,tsx}']` matches (verified by find — no stray extra spec files, no `.test.*` files). `environment: 'node'` mirrors apps/web's own test environment; the specs are genuinely DOM-free (`App.spec.tsx` uses `renderToStaticMarkup` from `react-dom/server`; `client.spec.ts` uses injected `fetch`). No overlap with the `unit`/`integration` include patterns.
2. **The `shared` alias — mirror proven at the path level:** the root config's `new URL('./packages/shared/src/index.ts', import.meta.url)` (relative to the repo-root config file) and apps/web's `new URL('../../packages/shared/src/index.ts', import.meta.url)` (relative to `apps/web/`) resolve to the **identical absolute path** (`<root>/packages/shared/src/index.ts` — verified by executing both resolutions in Node). Same alias key (`shared`), same target, same semantics.
3. **Alias scoping — doubly scoped:** (a) the `resolve.alias` is declared **inside the third project object** — Vitest workspace projects each carry their own resolve config, so `unit`/`integration` never see it; (b) no other project's specs use the bare `shared` specifier at all (`apps/api`'s only shared-importing unit spec, `error-code-mirror.spec.ts`, imports by relative source path **on purpose**, per its own header comment; `packages/shared` specs import relatively). The alias cannot alter any other project's module resolution — semantically by config structure, empirically because there is no other consumer of the specifier.
4. **Why the alias exists — verified necessary, not stylistic:** `packages/shared`'s `main` is `dist/index.js` (unbuilt in a fresh checkout), and frozen CI runs `pnpm test` **before** `pnpm build` (`ci.yml` step order: install → generate → lint → typecheck → migrate → **test** → build → e2e). Without the alias the web specs would fail in CI on unresolved `shared`. Resolving from source is exactly how `apps/web` itself resolves `shared` in dev, its own test runner, **and** `vite build` (same alias in its config) — so the root runner now behaves identically to the package's own runner. No dist/source divergence risk: it is the same resolution the SPA build uses. Production builds never consult `vitest.config.ts`.
5. **JSX without `@vitejs/plugin-react` — verified:** `apps/web/tsconfig.json` has `"jsx": "react-jsx"`; esbuild's transform picks it up for `App.spec.tsx`. Proven empirically: all 44 web tests green in the root runner locally (Node 22) **and** in CI (Node 24) with zero react plugin and zero new dependency (lockfile byte-identical). Correctly avoided: the plugin is not a root devDep and would have forced a lockfile change — exactly what the PR was scoped not to do.
6. **No SWC on web-unit:** the project deliberately omits `unplugin-swc` — web specs have no decorators; esbuild default transform suffices (proven green). The SWC projects are untouched.
7. **Runner coexistence:** root `pnpm test` (web-unit project) and `pnpm --filter web test` (apps/web's own Vitest root) both green on the same tree — no double-count interaction, no config coupling.

## Security lane

1. **Supply chain: zero change.** `pnpm-lock.yaml` and root `package.json` byte-identical to `origin/dev` — no new packages, versions, URLs, integrity hashes, or scripts. Nothing to audit beyond identity, which is proven.
2. **Module resolution:** the new alias target is a **repo-internal source path** (`<root>/packages/shared/src/index.ts`) — no path traversal, no external/remote resolution, no `main`-field hijack of any other package. Scoped to one project (code lane §3).
3. **CI execution surface:** CI now executes 5 more test files — strictly **increases** gate strength (that is the fix's purpose, proven by the pre-fix mutation direction: a broken web spec previously passed CI silently). The 5 files' content is unchanged from `dev` and was reviewed when written (foundation-005 rounds 1–2; the acc-005 `App.spec.tsx` rework in its round 1). No new code enters CI; previously-existing-but-manual code does.
4. **No new scripts/exec surface:** the only new import in the config is `node:url` (standard library, for the path computation). No `child_process`, no network, no secrets in the diff. The e2e-db script (which shells out to `psql`/`pnpm`) is unchanged.
5. **Environment posture:** `node` environment for the web specs mirrors their own package runner; no jsdom/happy-dom introduced (that would have been a dependency change — correctly avoided).

## Consolidated findings (all non-blocking — nothing enters a fix loop)

| ID | Severity | Source | Location | Status | Summary |
|----|----------|--------|----------|--------|---------|
| R-1 | info | compliance | addendum's `.pipeline/acceptance-report.md §I.7` citation | open (no action required; self-resolving) | The cited accounts-phase acceptance report (incl. the §I.7 F-A4 row) exists today only as an **uncommitted working copy** in the main checkout — the committed report at this PR's head is still foundation-only (§7/§8). The citation is faithful to the actual finding text (verified against the working copy) but will not resolve from a fresh clone until the accounts acceptance report is committed by its owner. Precedent-consistent: PR #9's F-1 citation was reconciled the same way, via the post-merge docs commit `5aaa225`. No action in this PR. |
| R-2 | info | code | runner coexistence | open (no action required) | The 5 web specs now execute under two runners (root `pnpm test` `web-unit` project + `pnpm --filter web test`). Intentional and recorded in the addendum ("both coexist"; the per-package runner is still referenced by ticket records). Both verified green on the same tree this round. Harmless duplication; worth remembering when the per-package runner is eventually retired. |

Environment note (not a finding): local Node 22.22.0 vs CI Node 24 — the recorded precedent. This round the bridge is direct: the CI step log on the PR head shows 48/169 green on v24.21.0, matching the local 48/169.

## Verdict

**Zero open blocking findings across all three lanes → MERGEABLE. Loop ends early on a clean pass 1; no fixer dispatch.** Per the dispatch brief, the review lead does **not** merge — the merge decision belongs to the user. Ticket `TKT-foundation-006`'s status remains `done` (post-acceptance addendum only). This artifact is committed to the PR branch (gitignored `reviews/` dir force-added per the f-004/f-005/f-006/PR-#9 pattern) so the review history lands in `dev` with the merge; CI re-runs on the docs-only commit and was verified green on the final head.
