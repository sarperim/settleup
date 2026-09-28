# TKT-groups-004: Groups UI — overview, create group, group view, members tab (e2e)

- Status: done (merged via PR #17 → dev, 2026-09-28, P-4 parallel group with TKT-groups-002; review loop closed clean at pass 1, zero blocking findings; round artifact `reviews/TKT-groups-004-round-1.md`, open non-blocking follow-ups K-1/K-2 + nits K-3/K-4 + S-1/S-2 + routings P-1/R-1/R-2 recorded there)
- Size: M
- Scope: **Create** the groups pages in `apps/web/src/**` (replacing TKT-foundation-005 placeholders) and the e2e spec:
  - Groups overview (`/`): the caller's groups, create-group entry point.
  - Create-group flow: name entry → `POST /api/groups` → navigate to the group view with the join code displayed to the creator.
  - Group view (`/groups/:groupId`): tab scaffold — **Members** tab functional (member list, display names, creator marker); Expenses / Balances / Settle-up tabs as placeholders until their domains land (03 §6).
  - E2e spec TC-GRP-026 (self-contained identity `gina@test.local` per the e2e conventions).
  - **Must NOT touch**: `apps/api/**`, `packages/shared/src/**`, root `package.json` / `pnpm-lock.yaml` (not lockfile-eligible in P-4).
- Traces to: FR-GRP-001, FR-GRP-002, FR-GRP-010, FR-GRP-009 (UI aspect) · UC-GRP-001 (main, all steps), UC-GRP-005 (UI context) · NFR-GRP-003 (page built within budget — timing asserted in TKT-groups-006)
- Acceptance: TC-GRP-026 green
- Architecture refs: 03-api-design.md §6 (SPA routes); 01-system-architecture.md §2 (C1); testing/groups-membership.md §2 (TC-GRP-026) + e2e conventions; testing/00-test-strategy.md §5 (e2e scenario data through the UI)
- Dependencies: TKT-groups-001 (backend routes), TKT-accounts-005 (auth pages — in-test UI registration)
- Parallel group: P-4 (with TKT-groups-002 — verified disjoint: this ticket writes `apps/web/**` only)
