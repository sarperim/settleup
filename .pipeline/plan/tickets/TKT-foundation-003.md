# TKT-foundation-003: Shared package — kuruş money helpers, DTO types, constants

- Status: todo
- Size: M
- Scope: **Create** `packages/shared/src/**` and `packages/shared/test/unit/**` (suite layout per 00-test-strategy.md §8):
  - Branded `Kurus` type + `parseKurus` / `formatKurus` implementing the 02-data-model.md §8 contract exactly (accepted: `"123"`, `"123.4"`, `"123.45"`; rejected: negative, >2 decimals, comma separator, non-numeric, empty, above the 2,147,483,647-kuruş storage bound; zero valid).
  - Constants: field limits (displayName 1–50, password 8–128, group name 1–100, description 1–200 — 03-api-design.md §1) and the kuruş storage bound (02 §8).
  - DTO TypeScript types for the **complete** API surface of 03-api-design.md §2/§3/§3b/§3c (all request and response shapes), plus the error envelope and error-code union from 03 §4. These are the frozen contracts every later backend/frontend parallel pair builds against.
  - Unit specs implementing TC-EXP-001, TC-EXP-002, TC-EXP-003 exactly as written in the expense-tracking test plan (Vitest, no DB, no HTTP).
  - **Must NOT touch**: `apps/**`; root `package.json` / `pnpm-lock.yaml` (not lockfile-eligible in P-1 — the TKT-foundation-001 baseline suffices).
- Traces to: ASM-002, BR-EXP-010 (money boundary); arch 01 §2 C6 (shared package)
- Acceptance: **TC-EXP-001, TC-EXP-002, TC-EXP-003 green** (runnable via `vitest run` from the root baseline; wired into `pnpm test` by TKT-foundation-007). Explicit criteria additionally:
  1. The package typechecks and exports every DTO type for the shapes documented in 03 §2/§3/§3b/§3c.
  2. The error-code union covers exactly the codes of the 03 §4 table plus `LIST_TOO_LARGE` (§3b) — no more, no less.
  3. No runtime dependencies — pure code, importable by api and web (arch §2 C6).
- Architecture refs: 01-system-architecture.md §2 (C6), §4 (money-handling discipline); 02-data-model.md §8; 03-api-design.md §1, §2, §3, §3b, §3c, §4; testing/00-test-strategy.md §8; testing/expense-tracking.md §2 (TC-EXP-001…003)
- Dependencies: TKT-foundation-001
- Parallel group: P-1 (with TKT-foundation-002 — verified disjoint: this ticket writes `packages/shared/**` only)

**Note on the TC IDs:** TC-EXP-001/002/003 are the shared-money unit cases the test strategy places in `packages/shared/test/unit` (expense-tracking.md §2). They are carried here — in foundation, where the helpers are built — and are **not** re-carried by the Expense Tracking domain tickets; the corresponding coverage-matrix rows close when this ticket is done.
