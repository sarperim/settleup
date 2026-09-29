# TKT-bal-001 — Review round 1

- **PR:** [#28](https://github.com/sarperim/settleup/pull/28) — `tkt-bal-001` → `dev`
- **Head reviewed:** `be6edf5580c7e08db1a6541f4f990eeec6b6a883`
- **Reviewers:** compliance-reviewer, code-reviewer, security-reviewer (full pipeline)
- **CI:** GitHub Actions `Lint, test & build` — **green** on head `be6edf5`
  (run [36553395633](https://github.com/sarperim/settleup/actions/runs/36553395633))
- **Verdict:** **MERGEABLE** — zero open blocking findings, CI green. Loop ends early on pass 1.

## Blast radius gate

**Classification: FULL.**

Reasoning: the diff touches executable TypeScript logic
(`apps/api/src/settlement/engine/suggestion-engine.ts`) and test files
(`apps/api/test/unit/**` — 5 specs + 1 support helper), plus the ticket
metadata file (`.pipeline/plan/tickets/TKT-bal-001.md`, status line only).
The LOW gate requires every touched file to be presentation-only/non-executable
and no test files; that fails on both counts. The ticket also pins automated
acceptance TCs (TC-BAL-001…005), which alone mandates the full pipeline so the
compliance-reviewer can verify coverage. Therefore all three reviewers ran on
pass 1 — not a fast pass.

## Findings

### Compliance-reviewer — VERDICT: compliant (0 findings)

TC coverage verified line-by-line: TC-BAL-001 (minimality vs independent
exhaustive reference, 500 seeded runs), TC-BAL-002 (determinism + shuffled
input order), TC-BAL-003 (edge table a–g), TC-BAL-004 (13 nonzero → fallback,
warning asserted), TC-BAL-005 (8-member adversarial, median ≤ 150 ms = 3× T4
bound). No `.skip`/`.only`/`.todo`, no deleted or softened assertions. Scope
matches the ticket exactly — none of the forbidden paths (settlement
module/controller/service, `apps/web/**`, `packages/shared/src/**`,
`apps/api/prisma/**`, root `package.json`/`pnpm-lock.yaml`) are touched.
Architecture §5.3 matched: pure, zero-dependency, DFS tight-transfer, canonical
memoization, first minimum-length solution, stable member-id order, kuruş-exact,
`> 12` greedy fallback + warning.

Observations (explicitly **not violations**, no action required):
- TC-BAL-003 case f is expressed as a zero/zero-balance input; gross cycles are
  unrepresentable at this net-position interface — faithful to the pinned contract.
- `tc-bal-004` adds a "no fallback at exactly 12" boundary test beyond the
  literal TC — accepted as strengthening, asserts no extra production capability.

### Code-reviewer — VERDICT: approve (0 blockers; 5 nits, non-blocking)

| ID | Sev | Location | Finding | Status |
|----|-----|----------|---------|--------|
| CODE-1 | nit | `apps/api/test/unit/support/settlement-reference.ts:1-89` | Reference oracle re-implements the engine's tight-transfer model rather than the plan's "BFS over payment assignments"; still a valid minimality oracle (tight transfers are WLOG optimal) but shares the engine's central assumption. Suggest a partition/max-zero-sum-subset oracle or document the assumption. | open (non-blocking) |
| CODE-2 | nit | `apps/api/src/settlement/engine/suggestion-engine.ts:70` (`canonicalKey`) | `${id}:${value}` joined with `|`/`:` is ambiguous if a member id contains those separators (UUID/CUID safe in practice). `JSON.stringify` of sorted entries would remove the edge. | open (non-blocking) |
| CODE-3 | nit | `apps/api/test/unit/tc-bal-002-determinism.spec.ts:22-31` | Fixed vector has only one creditor, so shuffled-order check exercises only the debtor scan, not creditor sorting. A ≥2-creditor/≥2-debtor vector would cover it. | open (non-blocking) |
| CODE-4 | nit | `apps/api/test/unit/tc-bal-005-budget.spec.ts:70-79` | Uses median-of-5 with no retry (T4 policy text says median-of-3, 1 retry); only `console.warn` for the 50 ms sub-budget. Within the documented 3× gate. | open (non-blocking) |
| CODE-5 | nit | `apps/api/src/settlement/engine/suggestion-engine.ts:233-248` | Non-zero-sum (malformed) input silently returns a partial plan for stranded debt; zero-sum is guaranteed upstream (OBJ-004). Contract-documentation suggestion. | open (non-blocking) |

### Security-reviewer — VERDICT: approve (0 blockers; 1 low, non-blocking)

| ID | Sev | Location | Finding | Status |
|----|-----|----------|---------|--------|
| SEC-1 | low | `apps/api/src/settlement/engine/suggestion-engine.ts:70-180` | Exact DFS is exponential; fallback only at `> 12`. If wired (TKT-bal-002/003) to input not capped at ≤8 members, 9–12 adversarial nonzero balances could force a heavy search. **No exploit path in this PR** — pure function, no caller, group size capped at 8 (NFR-BAL-003), TC-BAL-005 bounds 8-member cases at 150 ms. Fix when wiring lands: assert/document the ≤8-member precondition at the service boundary. | open (non-blocking) |

Security also noted (not a finding): non-zero-sum input yields a partial plan
rather than rejecting — acceptable for a pure engine, enforce at service layer.

## Mergeability check

- Open blocking findings: **none** (0 compliance violations, 0 code blockers,
  0 critical/high security findings).
- CI on latest commit (`be6edf5`): **green**.
- Non-blocking nits/low: 6 total — do not block per the mergeability rule.

**Result: MERGEABLE. No fixer dispatch; loop terminates on the clean pass 1.**

## Recommendation

Merge PR #28. The six open items are non-blocking; if desired, they can be
folded into TKT-bal-002/003 (which own the service wiring) rather than a fix
round here — in particular SEC-1's caller-contract assertion belongs at the
service boundary. No upstream defects identified.
