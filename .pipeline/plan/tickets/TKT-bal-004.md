# TKT-bal-004: Settlement lifecycle — mark paid & undo (party-only)

- Status: in-progress
- Size: M
- Scope: **Extend** `apps/api/src/settlement/**` and add integration specs:
  - `POST /api/groups/:groupId/settlements { payerId, recipientId, amountKurus }` — **party check first**: caller must be the payment's payer or recipient, else `403 NOT_PAYMENT_PARTY` (an unauthorized caller triggers no plan work — amended precedence); then the mark-paid consistency rule (API §3.4): re-compute balances and the plan **inside the request's DB transaction** and require an exact triple match with a current suggestion, else `409 SUGGESTION_STALE`; on match insert a `SETTLED` row (FR-BAL-006/007).
  - `POST /api/groups/:groupId/settlements/:settlementId/undo` — party check first (`403 NOT_PAYMENT_PARTY` before `ALREADY_UNDONE`); then `409 ALREADY_UNDONE` if already undone; on success status → `UNDONE`, `undoneAt` set, `paidAt` unchanged, **row retained forever**; the outstanding plan regenerates on next read (it is derived — FR-BAL-008/009).
  - Specs: TC-BAL-009 (mark paid by payer — balance shift, plan regeneration, settled list), TC-BAL-010 (by recipient), TC-BAL-011 (non-party denied incl. combined party+mismatch precedence), TC-BAL-012 (all `SUGGESTION_STALE` rows: amount off, wrong parties, concurrent plan change, nothing outstanding, non-member named), TC-BAL-013 (undo by either party — balances revert, row retained with `undoneAt`, plan re-includes the payment), TC-BAL-014 (undo by non-party incl. combined case), TC-BAL-015 (double undo rejected, row unchanged).
  - **Must NOT touch**: `apps/api/src/settlement/engine/**`, `apps/api/src/ledger/**`, `apps/api/src/groups/**`, `apps/web/**`, `packages/shared/src/**`, `apps/api/prisma/**`, root `package.json` / `pnpm-lock.yaml`.
- Traces to: FR-BAL-006, FR-BAL-007, FR-BAL-008, FR-BAL-009 · UC-BAL-003 (main, E1), UC-BAL-004 (main, E1) · BR-BAL-006/007/008 · strategy G-2 (SUGGESTION_STALE)
- Acceptance: TC-BAL-009, TC-BAL-010, TC-BAL-011, TC-BAL-012, TC-BAL-013, TC-BAL-014, TC-BAL-015 green
- Architecture refs: 03-api-design.md §3c (settlements + undo rows), §3.4 (mark-paid consistency rule), §4 (service-level precedence, amended 2026-09-25); 01-system-architecture.md §6 (FR-BAL rows), §8.1 (layer 3); 02-data-model.md §5.2 (facts-only status), §4 (SettledPayment); testing/balances-settlement.md §2 (TC-BAL-009…015)
- Dependencies: TKT-bal-003
- Parallel group: none
