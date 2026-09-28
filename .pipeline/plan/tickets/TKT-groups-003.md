# TKT-groups-003: Deciding join requests — approve, reject, re-request

- Status: done (merged via PR #19 → dev, 2026-09-28; review loop closed clean at pass 2 after one fix round — pass-1 blocker K-1 decide() check-then-act race fixed in bfb7f16 and verified; round artifacts `reviews/TKT-groups-003-round-{1,2}.md`, open non-blocking follow-ups K-4 + C-2…C-6 + S-1…S-3 + planner routings C-4/C-5 recorded there)
- Size: M
- Scope: **Extend** `apps/api/src/groups/**` and add specs:
  - `GET /api/groups/:groupId/join-requests` — pending requests, **creator only** (member non-creator → `403 NOT_GROUP_CREATOR`; non-member → `404`).
  - `POST /api/join-requests/:requestId/approve` — establishes membership, closes the request (FR-GRP-006).
  - `POST /api/join-requests/:requestId/reject` — closes without membership; re-request later allowed (FR-GRP-007/011).
  - Approve/reject semantics per the amended 03 §3 note, exact check order: no matching row → `404`; caller not a member of the request's group → `404` (existence hiding; includes the requester themself); member non-creator → `403 NOT_GROUP_CREATOR`; request status ≠ PENDING → `404`. Authorization precedes request-state.
  - Re-request after rejection flips the existing `(groupId, userId)` row back to `PENDING` with `decidedAt` cleared (02-data-model.md §5.3).
  - Strategy §5 factory `joinAndApprove(creatorCookie, joinerCookie, code)` (lands here — it owns the approve route).
  - **Must NOT touch**: `apps/web/**`, `packages/shared/src/**`, `apps/api/prisma/**`, `apps/api/src/auth/**`, root `package.json` / `pnpm-lock.yaml`.
- Traces to: FR-GRP-005, FR-GRP-006, FR-GRP-007, FR-GRP-011, FR-GRP-013 (requester class) · UC-GRP-003 (main), UC-GRP-004 (main + postcondition) · BR-GRP-004, BR-GRP-010
- Acceptance: TC-GRP-013, TC-GRP-014, TC-GRP-015, TC-GRP-017, TC-GRP-018, TC-GRP-019, TC-GRP-020 green
- Architecture refs: 03-api-design.md §3 (join-requests list/approve/reject rows + "Approve/reject semantics" note, amended 2026-09-25), §4; 02-data-model.md §5.3 (state machine); 01-system-architecture.md §8.1 (layer 3); testing/groups-membership.md §2 (TC-GRP-013…015, 017–020) + §1 interpretations I-1/I-2 (confirmed)
- Dependencies: TKT-groups-002
- Parallel group: none
