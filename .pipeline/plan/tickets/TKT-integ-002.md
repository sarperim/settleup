# TKT-integ-002: Email-absence across all group-scoped payloads (FR-ACC-008 completion)

- Status: done (merged via PR #36 → dev, 2026-09-30; review loop closed clean at pass 1, zero blocking findings — blast radius FULL, all three reviewer lenses approve; round artifact `reviews/TKT-integ-002-round-1.md`, open non-blocking nits CODE-1/CODE-2 recorded there)
- PR: https://github.com/sarperim/settleup/pull/36
- Size: S
- Scope: **Create** the spec under `apps/api/test/integration/**` (test-only; fixes via review). Deferred at the Accounts gate because it enumerates group-scoped read endpoints of all domains — executable now:
  - TC-ACC-018 — fixture built with the factories (alice creator; bob approved member; carol pending join request; one expense paid by alice splitting alice+bob); as alice call all seven group-scoped read endpoints (`GET /api/groups/:groupId`, `…/members`, `…/join-requests`, `…/expenses`, `…/expenses/:expenseId`, `…/balances`, `…/settlements`); assert in **every** response: (a) no member's email string appears anywhere in the body, (b) every user reference carries `displayName`, (c) the three members are distinguishable by display name. Closes FR-ACC-008's payload matrix (its UI-side promises, TC-GRP-028/030 and TC-EXP-031, are already green in their domain tickets).
  - **Must NOT touch**: `apps/api/src/**` except minimal defect fixes, `apps/web/**`, `packages/**`, root `package.json` / `pnpm-lock.yaml`.
- Traces to: FR-ACC-008 (payload matrix), BR-ACC-003 · UC-ACC-001/UC-GRP-005/UC-EXP-004/UC-BAL-001/002 (read aspects) · OBJ-005 (privacy)
- Acceptance: TC-ACC-018 green
- Architecture refs: 03-api-design.md §1 (identity exposure rule), §2/§3/§3b/§3c; 01-system-architecture.md §2 (C2 read API, FR-ACC-008 row); testing/accounts-access.md §2 (TC-ACC-018 — deferred to this phase at the Accounts gate)
- Dependencies: TKT-groups-003, TKT-exp-003, TKT-bal-003 (the read endpoints it enumerates)
- Parallel group: P-8 (with TKT-bal-005, TKT-bal-006, TKT-integ-001 — verified disjoint spec files)
