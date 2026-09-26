# TKT-foundation-004 — Review Round 1 (orchestrated loop, pass 1)

- PR: https://github.com/sarperim/settleup/pull/6 (`tkt-foundation-004` → `dev`), head d35e9ec
- Ticket: `.pipeline/plan/tickets/TKT-foundation-004.md` (API platform — bootstrap, error contract, CSRF, logging, static SPA)
- Reviewers: compliance-reviewer, code-reviewer, security-reviewer (all three, parallel)
- Verification checkout: `/tmp/opencode/settleup-pr6-rl` (isolated worktree, branch `rl/tkt-foundation-004` @ d35e9ec)
- Baseline in checkout: `pnpm lint` ✅ · `pnpm typecheck` ✅ · `pnpm test` ✅ (13 files / 60 tests) · `pnpm build` ✅ (each reviewer re-ran independently, plus live production-boot probes)

**Context:** before this loop, an agent-driven review round ran directly against the PR with no human in the loop and no round artifact; its findings are referenced only as "(review round 1, F-N)" in commit messages c32b132…d35e9ec. This pass verified those prior fixes as well as the full diff. Prior-round findings are cited below as "prior F-N"; this round's findings use reviewer-prefixed IDs (F-C compliance, F-K code, F-S security).

## Blast radius gate (conducted by the review lead, before dispatch)

**Classification: FULL — not LOW.** Reasoning: the diff touches executable logic across `apps/api/src/**` (Nest bootstrap, global exception filter, CSRF middleware, request logging, env validation, validation pipe, static SPA serving, PrismaService), modifies dependency manifests (`apps/api/package.json`, `pnpm-lock.yaml`), and adds 10 test spec files; the ticket pins 5 explicit acceptance criteria with TC specs. LOW requires presentation-only/non-executable files and no pinned automated TCs — neither holds. Gate outcome: pass 1 dispatched all three reviewers in parallel (no fast pass).

## Consolidated findings

Blocking = compliance violation / code-review blocker / critical-high security. **Open blocking findings: 0 → MERGEABLE.**

### Open, non-blocking

| ID | Severity | Source | Location | Finding | Status |
|---|---|---|---|---|---|
| F-S-1 | medium | security | `apps/api/src/common/errors/all-exceptions.filter.ts:65` | Global exception filter logs `request.originalUrl` on the 500/unhandled path — query strings incl. secrets (join codes, tokens) persist to logs on any fault. Live-probed: 500 on `GET /api/probe/boom?token=…&code=…` → error log carries full query. Same secret class prior F-3 was raised for; prior F-3 fixed only the request-log middleware. One-line fix (`request.path`). | open (non-blocking; reviewer recommends landing before domain tickets build on the filter) |
| F-K-1 / F-S-4 | minor / nit | code + security | `all-exceptions.filter.ts` (mapStatus) | Body-parser `PayloadTooLargeError` (>100 kb body) is not an `HttpException` → folds to 500 INTERNAL with `unhandled_exception` error log: a client-input fault classified as a server fault (noisy alerting). §4 has no 413 code; the fold should be deliberate (map to 400 VALIDATION_FAILED or document). No leak — envelope stays generic. | open |
| F-K-2 | minor | code | `apps/api/src/bootstrap.ts:16-21`, `main.ts` | No `app.enableShutdownHooks()`: SIGTERM skips `PrismaService.onModuleDestroy()` → no `$disconnect()`. One-line fix in the platform. | open |
| F-S-2 | low | security | `apps/api/src/common/http/csrf.middleware.ts:14` | CSRF method allowlist (POST/PATCH/DELETE) matches the frozen spec (03 §1) but non-allowlisted state-changing methods (e.g. PUT) ship without CSRF once domain tickets add them. No live hole today (no PUT routes; browsers preflight PUT; forms can't emit it). | open — routed to architect (policy decision, deny-by-default preferred) |
| F-C-1 | minor (process) | compliance | round-1 record | Prior round's finding **F-6 has no fix commit and no trace anywhere in the repo** — its content and disposition (fixed elsewhere? withdrawn? doc-only?) are unverifiable. If F-6 was an unresolved code finding against this PR, the loop must re-open it. | open — **user question: confirm F-6's disposition** |

### Nits (never block)

| ID | Source | Location | Finding |
|---|---|---|---|
| F-K-3 | code | `config/env.ts:135-185` | `readPort`/`readPositiveInt` use `Number()` — accepts hex, scientific notation, `1e100`; ARGON2_* unbounded. Strict `/^\d+$/` + upper bound suggested. |
| F-K-4 | code | `bootstrap.ts` / `app.factory.ts` | Env validated twice per boot (once in `bootstrap()`, once in `createHttpApp()`); the port used for listen comes from the first. Harmless, redundant. |
| F-K-5 | code | `test/unit/unmapped-exception-status.spec.ts` | Mapped `mapStatus` branches 400/401/429 unpinned by the suite (404 + default branch are pinned). Runtime-verified green. |
| F-K-6 | code | `test/unit/csrf-method-set.spec.ts:30-44` | Duplicates a2's post/patch/delete assertions verbatim; defensible as a pin spec, could be merged. |
| F-C-2 | compliance | `main.ts` + CI order | Acceptance-1's "exits non-zero" leg not automated (tests run before build in CI — FLAG-1 family). Manually verified by reviewer: exit 1, clear fatal log. Routed to test-planner (TKT-foundation-006). |
| F-C-3 | compliance | `tc-foundation-004-a5` | No automated regression pin for query-string stripping (prior F-3). One-line a5 addition; should land together with the F-S-1 fix. |
| F-C-4 | compliance | `request-logging.middleware.ts:30` | `X-Request-Id` response header is unpinned gold-plating (benign, client-side correlation). Recorded for the record. |
| F-C-5 | compliance | `csrf-method-set.spec.ts:47` | `expect(response.body.error?.code ?? 'NOT_FOUND')` weak — a regressed string-shaped 404 body would still pass (envelope exactness is pinned elsewhere by a2). |
| F-S-3 | security | `app.factory.ts:57` | `trust proxy: 1` means direct-to-origin requests can spoof `req.ip` via XFF. Correct behind Caddy (arch §8.2); nothing keys off `req.ip` yet — C2's login throttle will. Deployment invariant (API reachable only via Caddy) should be recorded. |
| F-S-5 | security | `app.factory.ts:92` | SPA-fallback `/api` detection is case-sensitive (`/API/unknown` + `Accept: text/html` → index.html). Masks, never exposes. Lowercase the check. |
| F-S-6 | security | `common/logging/logger.ts:14-18` | No pino `redaction` config — cheap defense-in-depth for when domain modules (C2–C5) hold this logger (arch §8.4). |

### Verified clean (all three reviewers, incl. live probes)

- Error envelope exactly `{error:{code,message,details?}}` on every probed path — unknown routes, CSRF 403, malformed JSON (400 VALIDATION_FAILED), Prisma-shaped errors, non-Error throwables, oversized bodies, unmapped HttpException statuses (→ 500 INTERNAL with `unmappedStatus` logged server-side only). No stacks/internals/framework shapes in any response.
- CSRF: before routing and body-parsing, header name case-insensitive, value strictly matched, duplicates rejected, applies to all paths incl. register/login; rejected requests carry helmet headers + the §4 envelope.
- Static serving: dotfiles and every traversal vector never served; hashed assets `immutable`, index.html `no-cache`; missing webRoot → clean 404 envelope; `/api` not hijacked (modulo F-S-5 case nit).
- Env fail-fast verified end-to-end (exit 1, clear message naming missing vars, no secrets); defaults exactly LOG_LEVEL/ARGON2_*/COOKIE_SECURE (secure direction).
- Scope clean (no `apps/web/**`, `packages/**`, `apps/api/prisma/**`, no domain modules, no CI edits). DEVIATION-1 exact: only devDeps `@types/cookie-parser`, `@types/supertest` (+ transitive `@types/*`); validation need met with baseline `class-validator`/`class-transformer` — no new runtime deps.
- Pre-existing 26 tests untouched/undiminished; no `.only`/skips; suite green 3× (no flakiness).

## Prior agent-round fix verification (never previously reviewed)

| Prior fix | Commit | Status | Evidence |
|---|---|---|---|
| F-1 error-code mirror drift-pin | c32b132 | **verified-fixed** (3/3 reviewers) | Set-equality both directions vs shared's real `ERROR_CODES` via relative source import; runs in CI (root vitest include); ran green. |
| F-2 unmapped statuses → 500 INTERNAL | a0a9c26 | **verified-fixed** (3/3) | Default `mapStatus` branch + `unmappedStatus` log; live probes 403/409/422/413 → exact 500 INTERNAL envelope; spec pins the 403 case. |
| F-3 strip query from logged path | 07f4bed | **verified-fixed on request-log path; INCOMPLETE on error-log path** (security) | Middleware logs `req.path` (live-probed, secret absent); but `all-exceptions.filter.ts:65` still logs `originalUrl` → F-S-1. |
| F-4 pin CSRF method set | c597b92 | **verified-fixed as a behavioral pin** (code + security) | Pins the production set through the real app (not a copy); adding/removing a method fails it either direction. Weak `??` assertion noted (F-C-5). |
| F-5 helmet before CSRF early-rejections | ce5d7ad | **verified-fixed** (3/3) | `app.use(helmet())` registers immediately on the express instance (Nest 11 internals verified); live 403 carries CSP/HSTS/COOP/CORP/nosniff/XFO + envelope. |
| F-6 — | none | **not on branch — no trace** | No commit, no mention in repo. Disposition unconfirmed → F-C-1 (user question). |
| F-7 readBoolean parameterize / drop redundant intersection | bebf34b | **verified-fixed** (3/3) | Single call site, byte-identical messages; type-only simplification; lint/typecheck/suite green. |

## TC coverage (ticket acceptance criteria — the inline criteria are the TCs; no `.pipeline/testing/*` entries exist for this ticket)

| # | Criterion | Spec(s) | Assessment |
|---|---|---|---|
| 1 | Boot on PORT; missing env → non-zero exit + clear message | `tc-foundation-004-a1-boot-env.spec.ts` (8 tests) | Real (exit-code leg manually verified by reviewer; automation blocked by CI order → F-C-2) |
| 2 | CSRF 403 envelope; with header unknown path → 404 envelope | `tc-foundation-004-a2-csrf-error-envelope.spec.ts` | Real |
| 3 | Every error response exactly §4 envelope | a2 + a3 + `unmapped-exception-status.spec.ts` | Real |
| 4 | After build: `/` index.html; deep-link fallback; hashed-asset cache headers | `tc-foundation-004-a4-static-spa.spec.ts` + reviewer's real-dist production boot | Real (real-dist leg manual — CI builds after tests, FLAG-1 family) |
| 5 | One pino JSON line per request; distinct request ids | `tc-foundation-004-a5-request-logging.spec.ts` + production boot | Real |

## Upstream routing (out of the fix loop — reported to user)

| Item | Route | Note |
|---|---|---|
| FLAG-1 build ordering (shared exposes only dist/; CI tests before build → api can't import shared) | architect + planner | Verified genuine; mirror + drift-pin is a sound interim guard; real fix touches root CI/vitest config + `packages/shared/**` — outside this ticket's allowed set. |
| FLAG-2 `VALIDATION_FAILED.details` shape unpinned by 03 §4 | architect | Implemented as `{ fields: string[] }`; domain test plans phrase it loosely — must be ruled on before domain tickets land. |
| FLAG-3 Vitest/esbuild lacks `emitDecoratorMetadata` | test-planner (TKT-foundation-006) | Verified genuine (`apps/api/tsconfig.json` emits it; only tsc/production does). Domain DTO-validation tests will silently skip validation without a transform. |
| F-S-2 CSRF method policy (allowlist vs deny-by-default) | architect | Frozen spec says POST/PATCH/DELETE; prefer deny-by-default ruling before domain tickets add methods. |
| F-C-2 exit-code test automation | test-planner (TKT-foundation-006) | Same CI-ordering family as FLAG-1. |
| F-S-3 trust-proxy deployment invariant | architect / deployment docs | API must be reachable only via Caddy once anything keys off `req.ip` (C2 throttle). |

## Verdict

**MERGEABLE — clean pass, loop ends early (round 1).** Zero open blocking findings: no compliance violation, no code-review blocker, no critical/high security finding. Reviewer verdicts: compliance MERGEABLE, code MERGEABLE, security MERGEABLE. Open non-blocking items: F-S-1 (medium, strongly recommended before domain tickets build on the filter — pairs with F-C-3 pin), F-K-1/F-S-4, F-K-2, F-S-2 (routed), F-C-1 (user question on prior F-6's disposition). Merge authority: user.
