# TKT-exp-005: Expense UI — ledger list & add-expense form, the 30-second journey (e2e)

- Status: todo
- Size: L
- Scope: **Create** the expense pages in `apps/web/src/**` (replacing the group-view Expenses tab placeholder) and e2e specs:
  - Expenses tab in the group view: the group's expenses — description, amount (via `formatKurus`), payer and participants by display name, timestamps.
  - Add-expense form (`/groups/:groupId/expenses/new`) — the SC-003 critical UI: **single screen**; participants default to **all members** (preselected); payer defaults to the **acting user**; split-type toggle EQUAL/EXACT; per-participant amount inputs for EXACT; client-side validation via `parseKurus` with inline errors and **no round-trips until submit** (NFR-EXP-001 enablers).
  - E2e specs (self-contained identities + in-test UI setup incl. join-by-code, per the e2e conventions): TC-EXP-028 (the timed journey — median ≤ 30 s hard gate, ≤ 2 interactions to the form, defaults asserted, invalid amount blocks submit with no network call, submit→visible measured per T4), TC-EXP-031 (ledger renders display names, never emails — FR-ACC-008 UI promise).
  - **Must NOT touch**: `apps/api/**`, `packages/shared/src/**`, root `package.json` / `pnpm-lock.yaml` (not lockfile-eligible in P-6).
- Traces to: FR-EXP-001, FR-EXP-011 (UI aspects), FR-ACC-008 (UI — expense views) · UC-EXP-001 (main, UI), UC-EXP-004 (main, UI) · SC-003, NFR-EXP-001, NFR-EXP-002 (pages built within budget — timing asserted in TKT-exp-006)
- Acceptance: TC-EXP-028, TC-EXP-031 green
- Architecture refs: 03-api-design.md §6 (SPA routes); 01-system-architecture.md §2 (C1), §7 (NFR-EXP-001 row — the enabler list); testing/expense-tracking.md §2 (TC-EXP-028, 031) + e2e conventions; testing/00-test-strategy.md §3 (T4 timing policy), §8 (G-8 — the 30 s bound)
- Dependencies: TKT-exp-002 (create route), TKT-exp-003 (list route), TKT-groups-006 (join-flow UI for in-test setup), TKT-groups-004 (group view/tabs — transitive)
- Parallel group: P-6 (with TKT-exp-004 — verified disjoint: this ticket writes `apps/web/**` only)
