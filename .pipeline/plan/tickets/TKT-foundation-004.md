# TKT-foundation-004: API platform — bootstrap, error contract, CSRF, logging, static SPA

- Status: todo
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
