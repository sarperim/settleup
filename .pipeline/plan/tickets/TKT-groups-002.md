# TKT-groups-002: Join-by-code request flow

- Status: todo
- Size: M
- Scope: **Extend** `apps/api/src/groups/**` and add specs:
  - `GET /api/join-info?code=...` — resolves a valid code to exactly `{ groupId, groupName }` (nothing else); unknown, wrong-length, or wrong-alphabet codes → `404 CODE_NOT_FOUND`, indistinguishable (FR-GRP-004).
  - `POST /api/join-requests { code }` — resolves the code to the group, then requester-relation checks: pending duplicate → `409 PENDING_REQUEST_EXISTS` (FR-GRP-012), already member (creator or approved) → `409 ALREADY_MEMBER` (FR-GRP-013), otherwise `201 { joinRequest }` with `status = "PENDING"` (FR-GRP-003). Code resolution precedes relation checks; missing `code` field → `400 VALIDATION_FAILED` (DTO precedence).
  - **Must NOT touch**: `apps/web/**`, `packages/shared/src/**`, `apps/api/prisma/**`, `apps/api/src/auth/**`, root `package.json` / `pnpm-lock.yaml`.
- Traces to: FR-GRP-003, FR-GRP-004, FR-GRP-012, FR-GRP-013 · UC-GRP-002 (main, A1, A2, E1) · BR-GRP-003
- Acceptance: TC-GRP-007, TC-GRP-008, TC-GRP-009, TC-GRP-010, TC-GRP-011, TC-GRP-012 green
- Architecture refs: 03-api-design.md §3 (join-info + join-requests rows, re-request semantics note), §4 (error precedence); 02-data-model.md §4 (JoinRequest), §5.3; 01-system-architecture.md §6 (FR-GRP rows); testing/groups-membership.md §2 (TC-GRP-007…012)
- Dependencies: TKT-groups-001
- Parallel group: P-4 (with TKT-groups-004 — verified disjoint: this ticket writes `apps/api/src/groups/**` only; TKT-groups-004 writes `apps/web/**` only; neither touches the lockfile)
