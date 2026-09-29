# TKT-exp-003: Ledger reads — list, detail, defensive cap, LedgerReadService

- Status: in-review (PR #24 → dev)
- Evidence: TC-EXP-021, TC-EXP-022, TC-EXP-025 green. Local CI-parity on real PostgreSQL 17: `pnpm exec vitest run --project unit` 21 files / 91 tests passed; `DATABASE_URL=…/settleup_tkt_exp_003 pnpm test` (unit + integration + web-unit) **88 files / 257 tests passed** (+3 files / +3 tests over the `2216544` baseline 85/254); `pnpm lint`, `pnpm typecheck`, `pnpm build` all passed. Red-before-green confirmed: the two list-based specs first ran `404` ×2 (list route absent) before the route existed; TC-EXP-022 passed against the TKT-exp-002 minimal detail route and now pins the full shape it must keep. Implemented: `GET …/expenses` (full, newest-first with `createdAt`/`id` tiebreak, group-scoped) with the `>500 → 500 LIST_TOO_LARGE` cap; the exported `LedgerReadService` (group-scoped expense/share reads for C5) now backs both `list` and `getDetail`, with one batched shares query + one users query per list. Flagged: TC-EXP-022's `editedAt`-bearing EXACT expense is seeded directly via Prisma as a **read-path fixture** (strategy §5 permits it) because the edit route is TKT-exp-004's scope; the unedited expense is API-created. The cap spec additionally asserts exactly 500 rows still returns `200` (additive boundary coverage; no plan test weakened). No changes to `apps/web/**`, `apps/api/src/groups/**`, `apps/api/src/auth/**`, `apps/api/prisma/**`, root `package.json` / `pnpm-lock.yaml`; no new dependencies.
- Size: S
- Scope: **Extend** `apps/api/src/ledger/**` and add integration specs:
  - `GET /api/groups/:groupId/expenses` — full list (no pagination), newest first, group-scoped only; defensive cap: > 500 rows → `500 LIST_TOO_LARGE`.
  - `GET /api/groups/:groupId/expenses/:expenseId` — detail incl. shares and timestamps; user references as `{ id, displayName }` only.
  - `LedgerReadService` — the exported read API C5 consumes for balance computation (group-scoped expense/share reads — arch §3 rule 1, 02 §6 ownership matrix).
  - Specs: TC-EXP-021 (ledger list, newest first, group scoping), TC-EXP-022 (detail shape), TC-EXP-025 (defensive cap at 501 — seeded via direct Prisma per the scale-fixture permission, fixture validity asserted).
  - **Must NOT touch**: `apps/web/**`, `apps/api/src/groups/**`, `apps/api/src/auth/**`, `apps/api/prisma/**`, root `package.json` / `pnpm-lock.yaml`.
- Traces to: FR-EXP-011 · UC-EXP-004 (main) · BR-EXP-009 (mechanism — guard applied) · NFR-EXP-004 (list shape + cap)
- Acceptance: TC-EXP-021, TC-EXP-022, TC-EXP-025 green
- Architecture refs: 03-api-design.md §3b (list/detail rows, cap note); 01-system-architecture.md §2 (C4), §6, §7 (NFR-EXP-004 row), §9 flag 4; 02-data-model.md §4 (`@@index([groupId, createdAt])`), §6; testing/expense-tracking.md §2 (TC-EXP-021, 022, 025); testing/00-test-strategy.md §5 (seeding permission)
- Dependencies: TKT-exp-002
- Parallel group: none
