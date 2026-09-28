# TKT-groups-005: Groups contract & scale — CSRF, multi-group, full-scale fixture, retention

- Status: in-review (PR #20)
- Size: S
- Scope: **Create** specs under `apps/api/test/integration/**` — the cross-route and scale assertions that need all groups routes to exist:
  - TC-GRP-022 — CSRF header required on the 4 groups-domain state-changing routes (`POST /api/groups`, `POST /api/join-requests`, approve, reject), no side effects.
  - TC-GRP-023 — a user holds memberships in multiple groups simultaneously.
  - TC-GRP-024 — full-scale fixture: 8 users, 5 groups, one 8-member group (NFR-GRP-004 + the NFR-ACC-005 cross-domain promise).
  - TC-GRP-025 — groups, memberships, and join requests persist through the exercised lifecycle (retention; direct table reads).
  - Test-only ticket: routes exist (TKT-groups-001…003); minimal defect fixes within `apps/api/src/groups/**` flow through the PR review — flagged, not scope creep.
  - **Must NOT touch**: `apps/web/**`, `packages/**`, `apps/api/prisma/**`, root `package.json` / `pnpm-lock.yaml`.
- Traces to: FR-GRP-009, NFR-GRP-002, NFR-GRP-004, NFR-ACC-005 (cross-domain promise) · BR-GRP-006, BR-GRP-007, BR-GRP-008 · API §1 (CSRF)
- Acceptance: TC-GRP-022, TC-GRP-023, TC-GRP-024, TC-GRP-025 green
- Architecture refs: 03-api-design.md §1 (CSRF), §3; 02-data-model.md §1 (principle 4), §5; 01-system-architecture.md §7 (NFR-GRP-004 row); testing/groups-membership.md §2 (TC-GRP-022…025)
- Dependencies: TKT-groups-001, TKT-groups-002, TKT-groups-003
- Parallel group: P-5 (with TKT-groups-006 — verified disjoint: this ticket writes `apps/api/test/**` (+ `apps/api/src/groups/**` fixes only if defects surface); TKT-groups-006 writes `apps/web/**` only)

**Deferred TC (flagged for Gate 3 — integration phase):** TC-GRP-021 (SC-006 authorization matrix — all 12 group-scoped routes × 2 non-member callers with existence-hiding body parity) enumerates the expense and settlement routes of C4/C5; it can only pass when the full route table exists. Not re-carried here — it lands in the integration phase, completing FR-GRP-008's exhaustive matrix and SC-006. In-domain coverage of the mechanism: the `GroupMemberGuard` (TKT-groups-001) plus TC-GRP-018's non-member 404 cases on the approve/reject routes.
