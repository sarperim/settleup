# TKT-foundation-004 — Review Round 2 (orchestrated loop, pass 2)

- PR: https://github.com/sarperim/settleup/pull/6 (`tkt-foundation-004` → `dev`), head ec24df4
- Ticket: `.pipeline/plan/tickets/TKT-foundation-004.md`
- Reviewers: compliance-reviewer, code-reviewer, security-reviewer (all three, parallel)
- Verification checkout: `/tmp/opencode/settleup-pr6-rl` (isolated worktree, branch `rl/tkt-foundation-004` @ ec24df4)
- Baseline re-verified independently by each reviewer: `pnpm lint` ✅ · `pnpm typecheck` ✅ · `pnpm test` ✅ (14 files / 70 tests, multiple runs, no flakes) · `pnpm build` ✅ · production-boot probes against the real foundation-005 `apps/web/dist`

## What happened between round 1 and round 2

1. **Rebase onto latest dev** (user request, after PR #5 / TKT-foundation-005 merged as 1b9b8a7). Clean rebase — zero file overlap with dev-side changes (foundation-005 respected the lockfile audit rule). Commit-hash mapping (old → new): a3a3322→99cbcc9, a3e5c82→708a864, 92b8db8→3554a79, c32b132→2715cda (F-1), a0a9c26→4255fc0 (F-2), 07f4bed→65727e5 (F-3), c597b92→ceeb643 (F-4), ce5d7ad→3e2b4ba (F-5), bebf34b→f75e2a6 (F-7), d35e9ec→8b461b4. Round-1 artifact's hashes refer to pre-rebase history. Suite green on the rebased state before pushing; force-pushed with lease.
2. **F-6 CLOSED as unrecoverable/no-trace.** Prior agent round's finding F-6 has no fix commit and no repo trace; the user confirmed the round ran fully auto with no surviving record of what F-6 was. Nothing to fix; disposition recorded in the PR branch's ticket doc (ec24df4). This resolves round-1 F-C-1.
3. **Fixer dispatch #1** (user-directed): 11 commits, 8b461b4..ec24df4 — ec1630a (F-S-1), 4892767 (F-K-1/F-S-4), cc023a8 (F-K-2), 46d48b9+ae808cf (F-C-5), c521f09 (F-K-5), 86dbb69 (F-S-5), 26198c6 (F-K-3 partial), ce93f13 (F-K-4), 0a85b29 (F-S-6), ec24df4 (docs). F-K-6 and F-C-4 skipped with assessed-sound reasons. Scope of the fix range: only `apps/api/src/**` (5 files), `apps/api/test/**` (6), ticket doc — no deps/lockfile/web/packages/prisma/CI.

## Round-1 fix verification (pass 2 reviewers — fixer claims independently verified, live where applicable)

| Round-1 finding | Status | Evidence |
|---|---|---|
| F-S-1 error-log query-string leak (medium) | **verified-fixed** (all 3 reviewers, live production probes) | Filter logs `request.path`; zero occurrences of probe secrets across the entire fault-app and real-boot logs (incl. an 8 KB query-string probe); a5 pin covers both request and error lines and fails pre-fix (empirically confirmed on a scratch pre-fix worktree). |
| F-K-1 / F-S-4 413 → 500 misclassification | **verified-fixed** | `isPayloadTooLargeError` branch → `400 VALIDATION_FAILED`, `internal: false`; detection cannot be spoofed by client input and does not hijack the HttpException path; new spec + live probe; no `unhandled_exception` classification. |
| F-K-2 no shutdown hooks | **verified-fixed** | SIGTERM → `PrismaService.onModuleDestroy()` → `$disconnect()` reproduced on the production build (instrumented); exit 143 confirmed as Nest 11.2.6's signal re-raise after cleanup (internals checked). |
| F-C-3 query-strip regression pin | **verified-fixed** | a5 pins both log lines of a faulted request with query secrets. |
| F-C-5 weak `?? NOT_FOUND` assertion | **verified-fixed** | Exact 404 envelopes for get/options/put; HEAD correctly pinned via status + content-type only (bodyless by HTTP semantics). |
| F-K-5 unpinned mapStatus arms | **resolved incomplete** → F-C2-1 | 401/429 pinned with exact envelopes; the 400 arm (malformed JSON path) remains unpinned. |
| F-S-5 case-sensitive /api fallback check | **verified-fixed** | Lowercased check; `/ApI`, `/API`, `/aPi/deep/link` all JSON 404; router-alignment verified (routed paths still route). |
| F-K-3 loose numeric env parsing | **verified-fixed (partial, as declared)** | `/^\d+$/` + overflow guard; hex/sci-notation/overflow rejected with 4 new a1 pins; ARGON2 upper bound routed to architect — sound (operator input, policy decision). |
| F-K-4 double env validation | **resolved incomplete** → F-K2-1 | Factory's own re-validation removed (3 loads → 2), but the `APP_CONFIG` provider still runs `loadEnv` per boot; "single loadEnv" claims in comments/ticket don't match code. |
| F-S-6 no pino redaction | **verified-fixed at claimed scope** (residual → F-S2-1) | 7 keys redacted top-level + one object level + err-serializer props; non-secret pass-through pinned. |
| F-K-6 / F-C-4 skips | **assessed sound** | The spec duplication is the documented intentional drift-pin; X-Request-Id is recorded gold-plating, removal would be unrequested behavior change. |
| F-S-2 / F-C-2 / F-S-3 / FLAG-1/2/3 | **routing confirmed untouched** | Fix range empty over all routed files; no attempted in-PR fixes. |

## Rebase integration verification (combined system: platform + foundation-005 SPA)

- PR's own diff vs new base is exactly its own files + DEVIATION-1 devDeps — must-not-touch holds against the foundation-005 base.
- **CSRF contract aligned 1:1**: web client (`apps/web/src/api/client.ts`) sends `X-Requested-With: XMLHttpRequest` on exactly POST/PATCH/DELETE, same-origin `/api` — matches `STATE_CHANGING_METHODS` precisely; login/register from the real SPA will not 403.
- **helmet CSP compatible with the real SPA**: no inline scripts/styles in the built dist; bundle grep clean (no eval/Function, no cross-origin fetches, no WebSockets); runtime style injection covered by helmet's style-src.
- **Static serving on the real dist**: `/` and deep links (`/login`, `/groups/abc/expenses`) → 200 index.html `no-cache`; hashed asset `immutable`; dotfiles and all traversal vectors serve nothing (byte-identical index.html or JSON 404 — no disclosure).
- Envelope exactness, helmet-on-early-rejections, and fail-fast re-verified on the combined boot.

## Consolidated pass-2 findings

**Open blocking findings: 0 → MERGEABLE (clean pass, loop ends).**

### Open, non-blocking

| ID | Severity | Source | Location | Finding | Status |
|---|---|---|---|---|---|
| F-C2-1 | minor | compliance | `all-exceptions.filter.ts` mapStatus 400 arm | F-K-5 residual: the 400 arm of `mapStatus` remains unpinned — deleting `case HttpStatus.BAD_REQUEST` folds malformed JSON to 500 INTERNAL with zero failing tests (a3's 400 goes through the validation pipe's AppError, not mapStatus). One malformed-JSON probe would close it. | open (non-blocking) |
| F-K2-1 | minor | code | `config.module.ts:18`, `app.factory.ts:33-38`, comments + ticket | F-K-4 residual: `APP_CONFIG` provider still re-validates env each boot (2 loads, was 3); the "single `loadEnv()` call" comments in bootstrap.ts/app.factory.ts and the ticket disposition don't match the code. Either thread the config into the provider or correct the claims. | open (non-blocking) |
| F-S2-1 | low | security | `common/logging/logger.ts:15-29` | Redaction misses arrays (`members: [{email}]` — the most natural domain log shape), depth ≥ 2, key-case variants, compound keys (`passwordHash`, `refreshToken`). Residual defense-in-depth only — nothing logs secrets today. Extend paths (`[*].key`) and pin domain logging conventions in C2–C5 NFRs before domain modules hold the logger. | open (non-blocking) |
| F-K2-2 | nit | code | `all-exceptions.filter.ts:103,146-186` | 413 asymmetry: body-parser 413 → 400 VALIDATION_FAILED, but Nest's idiomatic `PayloadTooLargeException` (HttpException 413) still folds to 500 INTERNAL. Add a `PAYLOAD_TOO_LARGE` mapStatus arm or document the asymmetry as deliberate. | open |
| F-C2-2 / F-K2-3 | nit | compliance + code | ticket doc line 48 | "every pin was verified to fail against the pre-fix code" overstates — F-C-5/F-K-5 pins pin already-correct behavior and pass pre-fix by design (that's what makes them regression pins). Wording fix only; the five behavior-fix pins WERE each verified failing pre-fix (independently confirmed). | open |
| F-S2-2 | nit | security | `config/env.ts:143-149` | Overflow guard only rejects ~400-digit strings; 20-digit ARGON2 values boot (1e20 passes `Number.isInteger`). Already routed to architect with the upper-bound decision; recorded because "overflow guard works" was imprecise. | open (routed) |
| F-S2-3 | nit | security | `app.factory.ts:97-115` | Missing hashed asset (`/assets/nope.js`) serves index.html 200 text/html instead of 404 — functional wrinkle after stale-hash redeploys; no attack path (nosniff; index.html public). Optional: exclude `/assets/` from fallback. | open |
| F-K2-4 | nit | code | history | `46d48b9` alone fails the suite (bodyless-HEAD subtlety caught by `ae808cf` on top) — bisect wart, documented, acceptable per no-amend discipline. | recorded |

### Upstream routing (unchanged from round 1, plus additions)

| Item | Route |
|---|---|
| FLAG-1 build ordering · FLAG-2 details shape · FLAG-3 decorator metadata · F-S-2 CSRF method policy · F-C-2 exit-code automation · F-S-3 trust-proxy deployment invariant | as round 1 (architect / planner / test-planner per round-1 artifact) |
| ARGON2_* upper bounds (new, from fixer F-K-3 disposition + F-S2-2) | architect |
| F-S2-1 residual redaction boundary | record in C2–C5 logging NFRs (architect / domain planning) + optional path extension |

## Verdict

**MERGEABLE — clean pass 2, loop ends.** Zero open blocking findings: no compliance violation, no code-review blocker, no critical/high security finding. Reviewer verdicts: compliance MERGEABLE, code MERGEABLE, security MERGEABLE. All round-1 mandatory fixes independently verified fixed (live production probes, pre-fix failure empirically confirmed for every behavior-fix pin); fixer introduced no new violations; the rebased combined system (platform + foundation-005 SPA) boots, serves, and enforces helmet/CSRF correctly with a 1:1 CSRF contract match. Merge authority: user.
