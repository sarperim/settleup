# TKT-foundation-002: Prisma data model & initial migration

- Status: done (merged via PR #3 → master, 2026-09-26 — review-process note below)
- PR: https://github.com/sarperim/settleup/pull/3
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

**Flagged during implementation (recorded for the review loop):**
- **FLAG-1 (architecture-doc defect — blocked the migration):** `02-data-model.md §4` renders the generator header and the enums on a single line (`generator client { provider = "prisma-client-js" }`, `enum SplitType { EQUAL EXACT }`). This is **invalid Prisma grammar** under the pinned Prisma 6.19.3 (P1012 "not a valid definition within a generator" / "This line is not an enum value definition") — the reference schema as literally written cannot compile. The shipped schema normalizes to one-setting-per-line / one-value-per-line; **enum names, values, and order are unchanged** (semantic contract intact — acceptance criterion 1 still holds for models, enums, uniques, indexes, relations, cascade). Recommended amendment to `02 §4`: same normalization (architect). Also annotated in the schema header comment.
- Dev-env note: local verification ran on Node v22 (f-001 pins `engines: >=24`) against genuine **PostgreSQL 17.11** binaries (no Docker/root on the box) — all four acceptance criteria passed (migrate dev, migrate deploy ×2, idempotency, generate + typecheck + runtime client import). CI runner (Node 24) unaffected.
- **Review-process note (status flip, 2026-09-26, user-directed):** this ticket merged without a formal review loop — its PR ran no CI (the workflow only existed on the f-007 branch at the time) and no reviewer pass was dispatched. Mitigations on record: all four acceptance criteria were verified locally by the coder (above); the schema and initial migration were subsequently exercised green inside TKT-foundation-007's pipeline (CI run 36221858640 — "Apply migrations to test database" and "Create E2E database & apply migrations" both ✓ against the service container) and security-read during f-007's pass 3 (pure DDL, env-based datasource, no hardcoded credentials, no privilege primitives). Remaining routed items for this ticket: the 02-data-model.md §4/§7 architect amendment (FLAG-1 above).
