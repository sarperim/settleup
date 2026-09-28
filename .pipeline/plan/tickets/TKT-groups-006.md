# TKT-groups-006: Join flow UI — join by code, approve/reject, member list & timing (e2e)

- Status: done (merged via PR #21 → dev, 2026-09-28, P-5 parallel group with TKT-groups-005; review loop closed clean at pass 1, zero blocking findings; took PR #17 follow-ups K-2/S-1 + R-1; round artifact `reviews/TKT-groups-006-round-1.md`, open non-blocking follow-ups C-1…C-6 + OBS-1 + test-planner routings recorded there)
- Size: L
- Scope: **Create** the join-flow pages in `apps/web/src/**` and the e2e specs:
  - Join-by-code page (`/join/:code`): resolves via `GET /api/join-info` (group name shown before confirming), confirm places the request; re-request after rejection supported.
  - Join-request handling view (creator, inside the group view): pending list with display names, approve / reject actions.
  - E2e specs (self-contained identities per the e2e conventions): TC-GRP-027 (join by code), TC-GRP-028 (approve — FR-ACC-008 UI promise), TC-GRP-029 (reject + re-request), TC-GRP-030 (member list renders display names, never emails — FR-ACC-008 UI promise), TC-GRP-031 (page-load budget on overview, group view, and the creator's join-handling view — strategy §3 T4, ≤ 2.0 s).
  - **Must NOT touch**: `apps/api/**`, `packages/shared/src/**`, root `package.json` / `pnpm-lock.yaml` (not lockfile-eligible in P-5).
- Traces to: FR-GRP-003, FR-GRP-005, FR-GRP-006, FR-GRP-007, FR-GRP-010, FR-GRP-011 (UI aspects) · UC-GRP-002 (main, all steps), UC-GRP-003 (main, all steps), UC-GRP-004 (main, all steps), UC-GRP-005 (main) · FR-ACC-008 (UI), NFR-GRP-003
- Acceptance: TC-GRP-027, TC-GRP-028, TC-GRP-029, TC-GRP-030, TC-GRP-031 green
- Architecture refs: 03-api-design.md §6 (SPA routes); 01-system-architecture.md §2 (C1), §7 (NFR-GRP-003 row); testing/groups-membership.md §2 (TC-GRP-027…031) + e2e conventions; testing/00-test-strategy.md §3 (T4)
- Dependencies: TKT-groups-003 (approve/reject routes), TKT-groups-004 (group view, members tab, layout), TKT-accounts-005 (auth pages)
- Parallel group: P-5 (with TKT-groups-005 — verified disjoint: this ticket writes `apps/web/**` only)
