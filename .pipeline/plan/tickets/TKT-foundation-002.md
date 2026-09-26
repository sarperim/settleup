# TKT-foundation-002: Prisma data model & initial migration

- Status: in-progress
- Size: M
- Scope: **Create** `apps/api/prisma/**`:
  - `schema.prisma` — the reference schema of 02-data-model.md §4 transcribed field-for-field (8 models: User, Session, Group, JoinRequest, Membership, Expense, ExpenseShare, SettledPayment; 3 enums; `@unique`/`@@unique` constraints; `@@index`es; relations incl. `onDelete: Cascade` on ExpenseShare→Expense).
  - The initial migration under `apps/api/prisma/migrations/` (Prisma Migrate is the single schema truth — 02 §11).
  - Prisma scripts in `apps/api/package.json` (`generate`, `migrate dev`/`migrate deploy`).
  - **Must NOT touch**: `apps/api/src/**` (no PrismaService wiring — that is TKT-foundation-004's platform scope), `packages/**`, `apps/web/**`.
- Traces to: Foundation (02-data-model.md is the persistence contract for every domain's entities)
- Acceptance (explicit criteria):
  1. Schema matches 02-data-model.md §4 exactly — models, enums, uniques, indexes, relations, cascade.
  2. Against a fresh PostgreSQL 17: `prisma migrate dev` applies cleanly; `prisma migrate deploy` applies cleanly to a second fresh database (the CI/production path).
  3. `prisma migrate deploy` re-run on the already-migrated database exits 0 with no changes (idempotent).
  4. `prisma generate` emits the typed client; `pnpm typecheck` passes with the client importable from `apps/api`.
- Architecture refs: 02-data-model.md §2–§4 (entity catalog, ERD, reference schema), §5 (relationship & lifecycle notes), §11 (migration management); 01-system-architecture.md §4 (Prisma row); 04-ci-pipeline.md §4 (migrate steps)
- Dependencies: TKT-foundation-001
- Parallel group: P-1 (with TKT-foundation-003 — verified disjoint: this ticket writes `apps/api/prisma/**` + `apps/api/package.json` scripts only; TKT-foundation-003 writes `packages/shared/**` only)

**Audit note:** lockfile-eligible ticket of P-1 — if a dependency outside the TKT-foundation-001 baseline is genuinely required, only this ticket may add it; TKT-foundation-003 may not.
