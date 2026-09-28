# TKT-exp-001: Split engine — equal split with random-spread remainder, exact split (pure)

- Status: in-review (PR #22 → dev)
- Evidence: TC-EXP-004/005/006 green. Local CI-parity: `pnpm exec vitest run --project unit` 21 files / 91 tests passed; `pnpm test` (unit + integration + web-unit on real PostgreSQL 17) 76 files / 226 tests passed; `pnpm lint`, `pnpm typecheck`, `pnpm build` all passed. Red-before-green confirmed (missing engine module). Deviation: added `paths.shared` to `apps/api/tsconfig.json` (type-only, mirrors `apps/web/tsconfig.json`) so the first backend import of the frozen `shared` types resolves under `pnpm typecheck` before `packages/shared/dist` exists.
- Size: S
- Scope: **Create** `apps/api/src/ledger/engine/**` (pure functions, no DB, no Nest wiring) and unit specs in `apps/api/test/unit/**`:
  - Equal split per arch §5.1 / ASM-001: `base = floor(amount / n)`; remainder `r = amount − n·base` assigned one kuruş each to `r` **distinct** participants chosen via the **injectable CSPRNG source** (CSPRNG Fisher–Yates shuffle); no participant receives more than one extra kuruş; shares sum exactly to the amount.
  - Exact split: per-participant kuruş accepted iff they sum exactly to the amount (zero-kuruş shares valid — OQ-EXP-003).
  - The engine is a pure function of (amount, participants, split type, RNG stream) — the module provisioning of the real CSPRNG lands with TKT-exp-002.
  - Unit specs: TC-EXP-004 (seeded fast-check properties: exact sum, base/base+1 bounds, exactly `r` recipients of +1, one row per participant), TC-EXP-005 (edge cases: zero amount, n=1, amount<n, exact division, same-seed determinism, 2^31−1 over 8 participants), TC-EXP-006 (exact-sum accept/reject ±1, zero shares).
  - **Must NOT touch**: ledger controllers/services/module wiring (TKT-exp-002), `apps/web/**`, `packages/shared/src/**`, `apps/api/prisma/**`, root `package.json` / `pnpm-lock.yaml`.
- Traces to: FR-EXP-004, FR-EXP-005, FR-EXP-007 (engine side) · UC-EXP-001 (steps 5, A1) · ASM-001, BR-EXP-004/005/006 · SC-002 (split-engine half) · R-EXP-001
- Acceptance: TC-EXP-004, TC-EXP-005, TC-EXP-006 green
- Architecture refs: 01-system-architecture.md §3 (rule 3 — pure engines, injectable CSPRNG), §5.1 (split engine); testing/00-test-strategy.md §3 (T5 — seeded PRNG at unit level only), §5 (property-test generators), §7 rule 2 (seed reproducibility); testing/expense-tracking.md §2 (TC-EXP-004…006)
- Dependencies: TKT-foundation-001…007 (shared `Kurus` types; CI)
- Parallel group: none — the engine everything else in this domain consumes
