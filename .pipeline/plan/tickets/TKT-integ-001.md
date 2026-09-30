# TKT-integ-001: SC-006 authorization matrix — anonymous & non-member across the full route table

- Status: done (merged via PR #37 → dev, 2026-09-30; review loop closed clean at pass 1, zero blocking findings — blast radius FULL, all three reviewers approve: compliance compliant / code approve / security approve; round artifact `reviews/TKT-integ-001-round-1.md`, open non-blocking should-fix/nits C-1…C-5 + LOW security S-1…S-3 recorded there)
- PR: https://github.com/sarperim/settleup/pull/37
- Evidence: TC-ACC-015 + TC-GRP-021 green — `pnpm vitest run apps/api/test/integration/tc-acc-015-anonymous-matrix.spec.ts apps/api/test/integration/tc-grp-021-non-member-matrix.spec.ts` 2 files / 27 tests passed; `pnpm test` 122 files / 340 tests passed; mutation proof both matrices fail on a nulled auth/group guard (src reverted).
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
