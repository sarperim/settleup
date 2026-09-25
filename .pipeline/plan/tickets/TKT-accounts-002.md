# TKT-accounts-002: Login, throttle & logout

- Status: todo
- Size: M
- Scope: **Extend** `apps/api/src/auth/**` and add specs under `apps/api/test/integration/**`:
  - `POST /api/auth/login` — submitted email lowercased before lookup, Argon2id verification, session + cookie, `200 { user }`; failure → `401 INVALID_CREDENTIALS` with the generic message, no `Set-Cookie`, and **identical** responses for wrong-password vs nonexistent-email (no enumeration).
  - Login throttle per arch §8.2, exactly: in-memory counter keyed by (lowercased submitted email — whether or not the account exists — paired with client IP via `trust proxy`); only credential-verification failures count; fixed 15-minute window anchored at the first counted failure; the 11th+ attempt returns `429 TOO_MANY_ATTEMPTS` (standard envelope, no `details`, no `Retry-After`) **before** credential verification — correct credentials blocked too; counter cleared on successful login or window expiry; `POST /api/auth/login` only; check order DTO validation → throttle → credential verification. **Testability hook (required by the accounts plan conventions): the harness can reset the in-memory counters between tests.**
  - `POST /api/auth/logout` — deletes the session row, `204`; revoked token grants nothing anywhere (FR-ACC-005).
  - **Must NOT touch**: `apps/web/**`, `packages/shared/src/**`, `apps/api/prisma/**`, root `package.json` / `pnpm-lock.yaml`.
- Traces to: FR-ACC-003, FR-ACC-004, FR-ACC-005, FR-ACC-009 (mechanism) · UC-ACC-002 (main, E1), UC-ACC-003 (main), UC-ACC-006 · ASM-004 · NFR-ACC-001 (throttle translation)
- Acceptance: TC-ACC-005, TC-ACC-006, TC-ACC-007, TC-ACC-008, TC-ACC-009, TC-ACC-016, TC-ACC-017, TC-ACC-030, TC-ACC-031, TC-ACC-032, TC-ACC-033 green
- Architecture refs: 01-system-architecture.md §8.1 (session lifecycle), §8.2 (login-throttle deterministic semantics), §7 (NFR-ACC-001 row); 03-api-design.md §1 (email normalization), §2 (login/logout rows), §4 (`TOO_MANY_ATTEMPTS` row + throttle note); 02-data-model.md §4 (Session); testing/accounts-access.md §2 (TC-ACC-005…009, 016, 017, 030–033) + conventions (counter reset hook)
- Dependencies: TKT-accounts-001
- Parallel group: none
