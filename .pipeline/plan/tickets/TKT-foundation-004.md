# TKT-foundation-004: API platform — bootstrap, error contract, CSRF, logging, static SPA

- Status: in-review
- PR: https://github.com/sarperim/settleup/pull/6 (base: dev)
- Size: M
- Scope: **Create/modify** `apps/api/src/**` — the cross-cutting platform every domain module (C2–C5) sits on:
  - Nest bootstrap (`main.ts`): helmet, cookie-parser, Express `trust proxy` (the Caddy hop — arch §8.2), global `/api` prefix.
  - Global exception filter implementing the 03-api-design.md §4 error contract: every error response is exactly `{ "error": { "code", "message", "details"? } }` — including unmapped 404s — no stack traces or internals; 500s logged with request id.
  - CSRF middleware: every POST/PATCH/DELETE without `X-Requested-With: XMLHttpRequest` → `403 CSRF_HEADER_MISSING`, rejected before handlers (arch §8.2; applies to register/login too — 03 §1).
  - Config module: env validated at boot, fail fast with no defaults for required vars (`DATABASE_URL`, `PORT`); defaults for `LOG_LEVEL` (info), `ARGON2_*` (per arch §7), `COOKIE_SECURE` (arch §8.5).
  - pino logging: one JSON line per request (method, path, status, duration ms, request id; a userId slot for C2 to fill later); emails, session tokens, and passwords never logged (arch §8.4).
  - `PrismaService`: the single injectable Prisma client (from TKT-foundation-002) domain modules inject.
  - Request-validation wiring (global pipe or equivalent) producing `400 VALIDATION_FAILED` with `details` listing offending fields (03 §4) — the mechanism domain DTOs will hook into.
  - Static serving of `apps/web/dist` at `/` with SPA history fallback (deep links serve index.html) and cache headers for hashed assets (arch §7 NFR-ACC-003 row).
  - **Must NOT touch**: `apps/web/**`, `packages/**`, `apps/api/prisma/**`, and no domain modules (auth/groups/ledger/settlement belong to domain tickets).
- Traces to: Foundation (arch 01 §8 cross-cutting concerns underpin all 45 FRs)
- Acceptance (explicit criteria):
  1. Boot with valid env listens on `PORT`; boot with a required env var missing exits non-zero with a clear message (fail fast — arch §8.5).
  2. `POST /api/anything` without `X-Requested-With` → `403` with code `CSRF_HEADER_MISSING` in the §4 envelope; with the header, an unknown path reaches routing → `404` in the envelope.
  3. Every error response observed (unknown route, CSRF trigger, a validation-failing probe DTO in a scratch check) is exactly the §4 envelope — no extra top-level keys, no stack traces.
  4. After `pnpm build`: `GET /` serves the SPA's index.html; a deep link (e.g. `/groups/x`) serves index.html (history fallback); hashed assets carry cache headers.
  5. One pino JSON log line per request with method/path/status/duration/request id; request ids differ between requests.
- Architecture refs: 01-system-architecture.md §8.1–§8.5, §4 (helmet/pino/cookie rows), §7 (NFR-ACC-003 row); 03-api-design.md §1 (conventions incl. CSRF), §4 (error contract); 02-data-model.md §6 (ownership — one Prisma client path)
- Dependencies: TKT-foundation-001, TKT-foundation-002, TKT-foundation-003, TKT-foundation-007 (sequencing: CI live on main before this ticket's PR — user decision at Gate 1)
- Parallel group: P-2 (with TKT-foundation-005 — verified disjoint: this ticket writes `apps/api/**` only; TKT-foundation-005 writes `apps/web/**` only)

**Audit note:** lockfile-eligible ticket of P-2 — if a dependency outside the TKT-foundation-001 baseline is genuinely required (e.g. the validation library), only this ticket may add it; TKT-foundation-005 may not.

**Flagged during implementation (recorded for the review loop):**

- FLAG-1 (pipeline / build ordering — routed to architect + planner): `packages/shared` exposes only its compiled `dist/` (`main`/`types`), and neither `pnpm typecheck` nor `pnpm test` runs after `pnpm build` in CI (build is step 4). Importing `shared` from `apps/api/src` therefore fails with `TS2307`/module-not-found at the typecheck step and at Vitest runtime. To keep this PR green pre-build, the platform defines its own `API_ERROR_CODES`/`ApiErrorCode`/`ErrorDetails` in `src/common/errors/error-contract.ts`, mirroring `packages/shared/src/errors.ts` exactly. The runtime values are the contract and are asserted by tests; the duplication is a build-ordering workaround, not a redefinition. The right fix (build `shared` before typecheck/test, or point api/test resolution at `shared` sources) belongs to the pipeline, not this ticket. Interim guard (review round 1, F-1): `apps/api/test/unit/error-code-mirror.spec.ts` pins the mirror to shared's `ERROR_CODES` as sets via a relative source import (outside the api typecheck glob) — delete it when the root build-ordering fix lands.
- FLAG-2 (contract shape — routed to architect): 03-api-design.md §4 says `VALIDATION_FAILED.details` "lists offending fields" but does not pin the shape. This ticket implements `details: { fields: string[] }` (leaf DTO property paths). Domain test plans phrase it loosely ("details name `password`", groups "details name `code`"); the exact shape they assert against must be confirmed before those tickets land. Service-level errors keep the documented per-code detail (e.g. `EMAIL_TAKEN` → `details: { field: 'email' }`).
- FLAG-3 (test-harness gap — routed to TKT-foundation-006, the harness ticket): Vitest compiles with esbuild, which does **not** emit `design:paramtypes` (`emitDecoratorMetadata`). Production `nest build` (tsc) does. The scratch DTO-validation acceptance test (`tc-foundation-004-a3`) therefore injects the parameter metadata by hand to exercise the real global ValidationPipe. Unless TKT-foundation-006 enables decorator-metadata emission (e.g. an SWC-based transform), **every domain DTO-validation integration test will silently skip validation**. The platform wiring itself is correct (verified by the hand-injected-metadata test and by tsc-built production code).
- DEVIATION-1 (lockfile — permitted): added devDependencies `@types/cookie-parser@^1.4.10` and `@types/supertest@^7.2.1` to `apps/api/package.json` (`pnpm-lock.yaml` updated). `cookie-parser` is in the f-001 baseline but shipped no types; `supertest` is a root devDependency the platform acceptance specs import. No runtime dependency added.
- Dev-env note: local verification ran on Node v22.22.0 (repo pins `engines >=24`); CI runs Node 24. Same precedent as TKT-foundation-002.

**Verification (local, this branch):**

- `pnpm lint` ✅ · `pnpm typecheck` ✅ · `pnpm build` ✅ · `pnpm install --frozen-lockfile` ✅
- `pnpm test` ✅ — 51 passed / 10 files (25 tests are new platform specs under `apps/api/test/unit/`).
- Acceptance criteria → specs: (1) `tc-foundation-004-a1-boot-env.spec.ts` + `node dist/main.js` missing-env exit-1 boot check; (2) + (3) `tc-foundation-004-a2-csrf-error-envelope.spec.ts`; (3) `tc-foundation-004-a3-validation-internal.spec.ts`; (4) `tc-foundation-004-a4-static-spa.spec.ts` + real `apps/web/dist` boot check (`PORT=4273`); (5) `tc-foundation-004-a5-request-logging.spec.ts` + boot-check log lines.
- Note: `apps/api/test/**` is not covered by the api `lint`/`typecheck` scripts (they glob `src/**/*.ts`) — the same test-dir coverage gap TKT-foundation-003 recorded; TKT-foundation-006 owns harness-level gating.

