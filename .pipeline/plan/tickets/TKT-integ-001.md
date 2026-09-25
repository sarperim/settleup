# TKT-integ-001: SC-006 authorization matrix — anonymous & non-member across the full route table

- Status: todo
- Size: M
- Scope: **Create** specs under `apps/api/test/integration/**` (test-only ticket; minimal defect fixes flow through the PR review — flagged, not scope creep). Both TCs were deferred at their domain gates because they enumerate the route tables of **all four domains** — executable now that every route exists:
  - TC-ACC-015 — the exhaustive anonymous matrix: all **21** protected endpoints (the complete API surface minus register/login), called with no session cookie and syntactically valid bodies/paths → `401 UNAUTHENTICATED`, error-envelope shape. Closes FR-ACC-009's exhaustive matrix.
  - TC-GRP-021 — the SC-006 non-member matrix: all **12** group-scoped routes × {registered non-member, member of another group}, on a real group carrying real data (members + one expense) and on a nonexistent group → `404 NOT_FOUND` for read **and** modify attempts, with status/`error.code`/`error.message` **identical** between the real-group and nonexistent-group responses (existence hiding); no side effects afterwards (members/expenses unchanged, `sumKurus === 0`). Closes FR-GRP-008 and SC-006.
  - **Must NOT touch**: `apps/api/src/**` except minimal defect fixes surfaced by the matrices, `apps/web/**`, `packages/**`, root `package.json` / `pnpm-lock.yaml`.
- Traces to: FR-ACC-009 (exhaustive matrix), FR-GRP-008, NFR-GRP-001 · UC-ACC-006 (main, exhaustive), UC-GRP-006 (main) · SC-006, OBJ-005
- Acceptance: TC-ACC-015, TC-GRP-021 green
- Architecture refs: 03-api-design.md §1 (existence hiding, auth conventions), §2/§3/§3b/§3c (the full route table); 01-system-architecture.md §8.1 (guard layers); testing/accounts-access.md §2 (TC-ACC-015), testing/groups-membership.md §2 (TC-GRP-021) — both deferred to this phase at their domain gates
- Dependencies: TKT-accounts-003, TKT-groups-003, TKT-exp-004, TKT-bal-004 (every route-owning ticket)
- Parallel group: P-8 (with TKT-bal-005, TKT-bal-006, TKT-integ-002 — verified disjoint: each ticket owns distinct spec files under `apps/api/test/integration/**` or `apps/web/**`; no lockfile writers)
