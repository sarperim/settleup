# TKT-bal-001: Suggestion engine — minimum-transaction settlement plans (pure)

- Status: done
- PR: https://github.com/sarperim/settleup/pull/28
- Size: M
- Scope: **Create** `apps/api/src/settlement/engine/**` (pure functions, no DB, no Nest wiring) and unit specs in `apps/api/test/unit/**`:
  - Exact minimum-transaction search per arch §5.3: depth-first — settle the first debtor against each creditor in turn (`min(|debtor|, creditor|)`), recurse on the reduced balance vector, memoize on the canonical state, keep the first minimum-length solution.
  - **Deterministic**: creditors/debtors iterated in stable member-id order — identical balances always produce the identical plan (required for mark-paid to be well-defined).
  - Zero-balance members excluded; amounts kuruş-exact (sub-lira suggestions allowed — BR-BAL-011).
  - Defensive greedy fallback above 12 nonzero balances: largest-debtor↔largest-creditor matching — still zeroes everything, possibly non-minimal, deterministic, logs a warning (arch §9 flag 2).
  - Unit specs: TC-BAL-001 (minimality vs an **exhaustive brute-force reference implemented in the test** — seeded zero-sum vectors, 2–8 nonzero entries), TC-BAL-002 (determinism + input-order independence), TC-BAL-003 (SC-002 edge table a–g: all-zero, single debtor/creditor, two-debtors-one-creditor, zero-balance excluded, sub-lira, circular nets-to-zero, mixed), TC-BAL-004 (13 nonzero → fallback), TC-BAL-005 (compute budget at 8-member adversarial vectors — ≤ 50 ms median, CI-enforced at 3× per strategy T4).
  - **Must NOT touch**: settlement module/controller/service files (TKT-bal-002/003 own them), `apps/web/**`, `packages/shared/src/**`, `apps/api/prisma/**`, root `package.json` / `pnpm-lock.yaml`.
- Traces to: FR-BAL-004, FR-BAL-005 (engine side) · UC-BAL-002 (step 2, engine) · OBJ-002, SC-002 (suggestion half), BR-BAL-004/005/011 · NFR-BAL-002/003 · R-BAL-002
- Acceptance: TC-BAL-001, TC-BAL-002, TC-BAL-003, TC-BAL-004, TC-BAL-005 green
- Architecture refs: 01-system-architecture.md §3 (rule 3 — pure engines), §5.3 (suggestion engine incl. fallback), §9 flag 2; testing/00-test-strategy.md §3 (T4/T5), §5 (generators); testing/balances-settlement.md §2 (TC-BAL-001…005)
- Dependencies: TKT-foundation-001…007
- Parallel group: P-7 (with TKT-exp-006 and TKT-bal-002 — verified disjoint: this ticket writes `apps/api/src/settlement/engine/**` + `apps/api/test/unit/**` only)
