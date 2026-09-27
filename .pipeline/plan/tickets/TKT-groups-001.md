# TKT-groups-001: Groups module core — creation, join-code generator, read models, guards

- Status: in-progress
- Size: M
- Scope: **Create** `apps/api/src/groups/**` (the C3 Groups module) and its specs:
  - Join-code generator: 8-char Crockford base32 (`0123456789ABCDEFGHJKMNPQRSTVWXYZ`) from an **injectable CSPRNG source** (arch §3 rule 3 — pure, unit-testable with a seeded PRNG).
  - `POST /api/groups` — name validation (1–100), group + creator-membership rows in one transaction (BR-GRP-005), join code generated (FR-GRP-001/002).
  - `GET /api/groups` — the caller's memberships overview (FR-GRP-009 read side).
  - `GET /api/groups/:groupId` — group detail; `joinCode` included **iff** the caller is the creator; non-members → `404 NOT_FOUND` (existence hiding).
  - `GET /api/groups/:groupId/members` — member list, display names only via `UsersService` (FR-GRP-010, FR-ACC-008 mechanism).
  - `GroupMemberGuard` + `GroupCreatorGuard` — the cross-module guards C4/C5 will also apply to their group-scoped routes (arch §8.1 layer 2/3).
  - `MembershipService` — exported read API (`isMember`, groupId/userId resolution) for C4/C5 (arch §3 rule 1, 02 §6 ownership matrix).
  - Strategy §5 factory `createGroup(creatorCookie, name)` → group incl. `joinCode` (lands here — it owns the route).
  - **Must NOT touch**: `apps/web/**`, `packages/shared/src/**`, `apps/api/prisma/**`, `apps/api/src/auth/**`, root `package.json` / `pnpm-lock.yaml`.
- Traces to: FR-GRP-001, FR-GRP-002, FR-GRP-008 (mechanism — GroupMemberGuard), FR-GRP-009, FR-GRP-010 · UC-GRP-001 (main, E1), UC-GRP-005 (main) · NFR-GRP-005
- Acceptance: TC-GRP-001, TC-GRP-002, TC-GRP-003, TC-GRP-004, TC-GRP-005, TC-GRP-006, TC-GRP-016 green
- Architecture refs: 01-system-architecture.md §2 (C3), §3 (rules 1–3), §4 (join-code row), §6 (FR-GRP rows), §8.1; 02-data-model.md §4 (Group/Membership), §5.1; 03-api-design.md §1 (existence hiding), §3 (groups endpoints); testing/groups-membership.md §2 (TC-GRP-001…006, 016) + conventions
- Dependencies: TKT-foundation-001…007, TKT-accounts-001 (AuthGuard + acting-user context, UsersService, registerUser factory)
- Parallel group: none — the module core everything else in this domain extends
