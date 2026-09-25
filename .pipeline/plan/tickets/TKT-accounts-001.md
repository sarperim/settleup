# TKT-accounts-001: Registration & session establishment (C2 core)

- Status: todo
- Size: M
- Scope: **Create** `apps/api/src/auth/**` (the C2 Auth module) and its specs under `apps/api/test/**`:
  - `POST /api/auth/register` — field validation (email, password 8–128 per D-ARCH-003, displayName 1–50), email lowercased at write, duplicate → `409 EMAIL_TAKEN` with `details.field = "email"`, Argon2id hash (m=19456, t=2, p=1), User + Session created, session cookie set, `201 { user }` (FR-ACC-001/002/010).
  - `GET /api/auth/me` — `200 { user }` / `401 UNAUTHENTICATED` (FR-ACC-009 read side).
  - Global `AuthGuard` (APP_GUARD) exempting only register/login, plus the acting-user request context that all later guards consume (arch §8.1 layer 1).
  - Session service: 256-bit token issuance, SHA-256 token-hash storage, sliding 30-day expiry, revocation (arch §4 session rows).
  - `UsersService` — the exported read API (`id` → `{ id, displayName }`) that C3/C4/C5 consume for group-scoped read models (arch §3 rule 1; the FR-ACC-008 mechanism).
  - Argon2id hashing utility (params from env with §7 defaults) — unit-testable (TC-ACC-019).
  - Register DTO with validation wiring producing `400 VALIDATION_FAILED` + `details` (03 §4), incl. the DTO-precedes-service precedence (TC-ACC-034).
  - Strategy §5 factory `registerUser(email, password, displayName)` → `{ id, email, cookie }` (lands here — it owns the route).
  - **Must NOT touch**: `apps/web/**`, `packages/shared/src/**` (DTO types frozen in TKT-foundation-003), `apps/api/prisma/**`, other modules (none exist yet), root `package.json` / `pnpm-lock.yaml`.
- Traces to: FR-ACC-001, FR-ACC-002, FR-ACC-009 (mechanism), FR-ACC-010 · UC-ACC-001 (main, A1, E1), UC-ACC-006 (API aspect)
- Acceptance: TC-ACC-001, TC-ACC-002, TC-ACC-003, TC-ACC-004, TC-ACC-019, TC-ACC-020, TC-ACC-034 green
- Architecture refs: 01-system-architecture.md §2 (C2), §4 (Argon2id, session, auth-cookie rows), §6 (FR-ACC rows), §8.1; 02-data-model.md §4 (User/Session); 03-api-design.md §1, §2 (register/me rows), §4; testing/accounts-access.md §2 (TC-ACC-001…004, 019, 020, 034) + conventions block; testing/00-test-strategy.md §5 (factories)
- Dependencies: TKT-foundation-001, TKT-foundation-002, TKT-foundation-003, TKT-foundation-004, TKT-foundation-005, TKT-foundation-006, TKT-foundation-007 (foundation complete)
- Parallel group: none — first domain ticket; everything else in Accounts & Access builds on the session infrastructure
