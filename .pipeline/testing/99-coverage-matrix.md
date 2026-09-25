# Coverage Matrix — Settle Up Test Plan (Consolidated)

Status: **draft — awaiting final approval** (consolidates the Gate 2 approvals; the Expense Tracking and Balances & Settlement plans are presented for approval together with this matrix) · Date: 2026-09-25
Sources: `.pipeline/testing/00-test-strategy.md` (Gate 1 approved) + the four domain plans. Detail lives in the domain plans' own §4 matrices; this document is the cross-domain rollup and the orphan check. **TC IDs are permanent**; every ID below refers to `TC-<DOMAIN>-xxx` in the plan of that domain.

## 1. The plan set

| Document | Status | TCs | unit | integration | e2e | system |
|---|---|---|---|---|---|---|
| `00-test-strategy.md` | Gate 1 approved | — | — | — | — | — |
| `accounts-access.md` | Gate 2 approved | 35 (TC-ACC-001…035) | 1 | 28 | 5 | 1 (TC-ACC-028, e2e phase) |
| `groups-membership.md` | Gate 2 approved | 31 (TC-GRP-001…031) | 2 | 23 | 6 | — |
| `expense-tracking.md` | **awaiting Gate 2** | 33 (TC-EXP-001…033) | 6 | 21 | 6 | — |
| `balances-settlement.md` | **awaiting Gate 2** | 26 (TC-BAL-001…026) | 5 | 15 | 6 | — |
| **Total** | | **125** | **14** | **87** | **23** | **1** |

## 2. Success criteria verification

| SC | Verification | Test cases |
|---|---|---|
| SC-001 (group adopts app) | Real-world adoption outcome — **not automatable** (strategy G-7); the e2e lifecycle proves the technical path | TC-BAL-025 (path only) |
| SC-002 (min-transaction suggestions + remainder properties) | Unit property/edge suites: split engine (exact sum, distinct recipients, ≤ 1 extra kuruş) + suggestion engine (minimality vs brute-force reference, edge cases, determinism) | TC-EXP-004, 005, 008 · TC-BAL-001, 002, 003, 004 |
| SC-003 (log an expense ≤ 30 s) | E2e timed journey + deterministic enablers (≤ 2 interactions, single screen, defaults, client-side validation) | TC-EXP-028 |
| SC-004 (pages ≤ 2 s) | E2E timing on the built app, all page families (T4 policy) | TC-ACC-027 · TC-GRP-031 · TC-EXP-032, 033 · TC-BAL-026 |
| SC-005 (zero-sum after every op) | Integration suite: `sumKurus === 0` after every create / edit / delete / settle / undo — the full operation matrix split across the two owning plans | TC-EXP-023 (create/edit/delete) + TC-BAL-016 (settle/undo) |
| SC-006 (non-member denied) | Authorization matrix: 12 group-scoped routes × {anonymous → 401, registered non-member → 404 with existence-hiding body parity}, read **and** modify, no side effects | TC-ACC-015 (21 endpoints, anonymous) + TC-GRP-021 (12 routes × 2 non-member callers) |
| SC-007 (full lifecycle) | Playwright journey: register → create group → join via code + approval → log expense → mark paid → undo → outstanding again | TC-BAL-025 (CI step-4 smoke) |

## 3. Functional requirements — all 45 (every FR is Must)

| FR | Test cases | Status |
|---|---|---|
| FR-ACC-001 | ACC-001, 004, 023 | Covered |
| FR-ACC-002 | ACC-002, 003 | Covered |
| FR-ACC-003 | ACC-005, 024 | Covered |
| FR-ACC-004 | ACC-006, 007 | Covered |
| FR-ACC-005 | ACC-008, 009, 025 | Covered |
| FR-ACC-006 | ACC-010, 012, 013, 026 | Covered |
| FR-ACC-007 | ACC-011 | Covered |
| FR-ACC-008 | ACC-018 (API) · GRP-028, 030 · EXP-031 (UI) | Covered |
| FR-ACC-009 | ACC-015 (21 endpoints), 009, 025 | Covered |
| FR-ACC-010 | ACC-001, 023 | Covered |
| FR-GRP-001 | GRP-003, 026 | Covered |
| FR-GRP-002 | GRP-003, 006, 001, 002 | Covered |
| FR-GRP-003 | GRP-009, 027 | Covered |
| FR-GRP-004 | GRP-008, 010 | Covered |
| FR-GRP-005 | GRP-009, 013, 014, 017, 020 | Covered |
| FR-GRP-006 | GRP-013, 028 | Covered |
| FR-GRP-007 | GRP-014, 029 | Covered |
| FR-GRP-008 | GRP-021 + ACC-015 | Covered |
| FR-GRP-009 | GRP-005, 023, 024 | Covered |
| FR-GRP-010 | GRP-016, 013, 028, 030 | Covered |
| FR-GRP-011 | GRP-015, 029 | Covered |
| FR-GRP-012 | GRP-012, 015 | Covered |
| FR-GRP-013 | GRP-011 | Covered |
| FR-EXP-001 | EXP-007, 008, 009, 014, 028 | Covered |
| FR-EXP-002 | EXP-002, 012(a–f) | Covered |
| FR-EXP-003 | EXP-013 | Covered |
| FR-EXP-004 | EXP-004, 005, 007, 008 | Covered |
| FR-EXP-005 | EXP-004, 005, 008 | Covered |
| FR-EXP-006 | EXP-007, 015 | Covered |
| FR-EXP-007 | EXP-006, 009, 010, 017 | Covered |
| FR-EXP-008 | EXP-016, 029 | Covered |
| FR-EXP-009 | EXP-019, 030 | Covered |
| FR-EXP-010 | EXP-007, 015, 022 | Covered |
| FR-EXP-011 | EXP-021, 022, 031 · non-member → GRP-021 | Covered |
| FR-EXP-012 | EXP-018 | Covered |
| FR-BAL-001 | BAL-006, 021 | Covered |
| FR-BAL-002 | BAL-006, 017 | Covered |
| FR-BAL-003 | BAL-016 + EXP-023 (joint SC-005 suite) | Covered |
| FR-BAL-004 | BAL-001, 007 | Covered |
| FR-BAL-005 | BAL-003(d), 018 | Covered |
| FR-BAL-006 | BAL-009, 010, 011, 014 | Covered |
| FR-BAL-007 | BAL-009, 013 | Covered |
| FR-BAL-008 | BAL-013, 014 | Covered |
| FR-BAL-009 | BAL-013, 024 | Covered |
| FR-BAL-010 | BAL-006, 007 · non-member → GRP-021 | Covered |

## 4. Use-case flows — all 20 UCs, every main / alternate / error flow

| UC | Flows covered | Test cases |
|---|---|---|
| UC-ACC-001 Register | main · A1 · E1 | ACC-001, 004, 023 · ACC-002, 003 (+034 combined) · ACC-004 |
| UC-ACC-002 Log in | main · E1 | ACC-005, 024 · ACC-006, 007 |
| UC-ACC-003 Log out | main | ACC-008, 025 |
| UC-ACC-004 Change password | main · E1 | ACC-010, 026 · ACC-011 (+035 combined) |
| UC-ACC-005 Owner reset | automatable steps 3+5 (CLI); steps 1–2, E1 = human, out-of-app | ACC-028 |
| UC-ACC-006 Anonymous access | main | ACC-015, 025 |
| UC-GRP-001 Create group | main · E1 | GRP-003, 026 · GRP-004 |
| UC-GRP-002 Join by code | main · A1 · A2 · E1 | GRP-009, 027 · GRP-011 · GRP-012 · GRP-008, 010 |
| UC-GRP-003 Approve | main | GRP-013, 028 |
| UC-GRP-004 Reject | main | GRP-014, 029 |
| UC-GRP-005 View members | main | GRP-016, 030 |
| UC-GRP-006 Non-member denial | main | GRP-021 + ACC-015, 025 |
| UC-EXP-001 Log expense | main · A1 · E1 · E2 · E3 · E4 | EXP-007/008/009, 028 · EXP-008 · EXP-010 · EXP-011 · EXP-012 · GRP-021 |
| UC-EXP-002 Edit expense | main · E1 · E2 | EXP-015, 029 · EXP-017 · EXP-016 |
| UC-EXP-003 Delete expense | main · E1 | EXP-018, 030 · EXP-019 |
| UC-EXP-004 View expenses | main · E1 | EXP-021, 022, 031 · GRP-021 |
| UC-BAL-001 View balances | main · E1 | BAL-006, 021 · GRP-021 |
| UC-BAL-002 View suggestions | main · A1 · E1 | BAL-007, 022 · BAL-008 · GRP-021 |
| UC-BAL-003 Mark paid | main · E1 | BAL-009, 010, 023 · BAL-011 (+012 error side) |
| UC-BAL-004 Undo | main · E1 | BAL-013, 024 · BAL-014 (+015 error side) |

## 5. Non-functional requirements — all 20, with verification method and level

| NFR | Verification | Level | Test cases |
|---|---|---|---|
| NFR-ACC-001 | Argon2id params + hash-only storage + no password in logs + login throttle | unit + integration | ACC-019, 020, 021, 031, 032, 033 |
| NFR-ACC-002 | **Not automated** — deployment-design review (accepted limitation) | review | — |
| NFR-ACC-003 | Auth pages ≤ 2 s (T4) | e2e | ACC-027 |
| NFR-ACC-004 | Account retention; no delete route (contract review) | review + integration | ACC-029 |
| NFR-ACC-005 | Full-scale functional fixture (8 users, 5 groups) | integration | GRP-024 (cross-domain, as promised) |
| NFR-GRP-001 | Authorization matrix, deny-by-default, existence hiding | integration | GRP-021 + ACC-015 |
| NFR-GRP-002 | Retention of groups/memberships/join requests; no delete endpoints (contract review) | integration + review | GRP-025 |
| NFR-GRP-003 | Group pages ≤ 2 s (T4) | e2e | GRP-031 |
| NFR-GRP-004 | Multi-group + 8-member group functional scale | integration | GRP-023, 024 |
| NFR-GRP-005 | Join-code format/determinism/uniqueness (entropy by construction) | unit | GRP-001, 002 (+003/006 API-level) |
| NFR-EXP-001 | ≤ 30 s journey + deterministic enablers | e2e | EXP-028 |
| NFR-EXP-002 | Expense pages ≤ 2 s (T4) | e2e | EXP-032, 033 |
| NFR-EXP-003 | Shares sum exactly; zero-sum after expense ops | unit + integration | EXP-004, 006, 007–009, 023 |
| NFR-EXP-004 | 50-expense ledger (integration + e2e); 501 cap | integration + e2e | EXP-024, 033, 025 |
| NFR-EXP-005 | Persist until deleted; hard delete only | integration | EXP-026, 018 |
| NFR-BAL-001 | Zero-sum after every operation (full matrix) | integration | EXP-023 + BAL-016 |
| NFR-BAL-002 | Engine edge cases (circular, single debtor/creditor, zero-balance, remainder, sub-lira) | unit (+integration structural) | BAL-003, 018 · EXP-004, 005, 008 |
| NFR-BAL-003 | Exact search, minimality vs brute-force reference at ≤ 8 nonzero | unit | BAL-001 |
| NFR-BAL-004 | Pages ≤ 2 s · compute ≤ 50 ms (T4 3× CI bound) | e2e + unit | BAL-026 · BAL-005 |
| NFR-BAL-005 | Settled rows retained; undo visible with undoneAt | integration | BAL-019, 013, 015 |

## 6. Business rules — all 40

| BR | Test cases | | BR | Test cases |
|---|---|---|---|---|
| BR-ACC-001 | ACC-001 | | BR-EXP-001 | EXP-007, 009 |
| BR-ACC-002 | ACC-002, 003 | | BR-EXP-002 | EXP-007, 013, 014 |
| BR-ACC-003 | ACC-018, GRP-016/028/030, EXP-031 | | BR-EXP-003 | EXP-012(l–m), 007, 009 |
| BR-ACC-004 | ACC-005, 006, 007 | | BR-EXP-004 | EXP-004, 005, 008 |
| BR-ACC-005 | ACC-010, 011 | | BR-EXP-005 | EXP-015 |
| BR-ACC-006 | ACC-008, 016, 017 | | BR-EXP-006 | EXP-006, 010, 017 |
| BR-ACC-007 | ACC-028 | | BR-EXP-007 | EXP-016, 019, 029, 030 |
| BR-ACC-008 | ACC-001, 023 (absence) | | BR-EXP-008 | EXP-007, 015, 022 + contract review |
| BR-GRP-001 | GRP-003 (+ all creator fixtures) | | BR-EXP-009 | GRP-021, ACC-018/025 |
| BR-GRP-002 | GRP-003, 006, 001, 002 | | BR-EXP-010 | EXP-002, 012(a–b), 005(a) |
| BR-GRP-003 | GRP-009, 010 | | BR-EXP-011 | EXP-018 |
| BR-GRP-004 | GRP-013, 014 | | BR-BAL-001 | BAL-017 |
| BR-GRP-005 | GRP-003 | | BR-BAL-002 | BAL-006, 009, 013 |
| BR-GRP-006 | GRP-023, 024 | | BR-BAL-003 | BAL-016 + EXP-023 |
| BR-GRP-007 | GRP-025 + contract review | | BR-BAL-004 | BAL-001, 007 |
| BR-GRP-008 | GRP-025, 019 + contract review | | BR-BAL-005 | BAL-003(d), 018 |
| BR-GRP-009 | GRP-021 + ACC-015 | | BR-BAL-006 | BAL-009, 010, 013, 011, 014 |
| BR-GRP-010 | GRP-015, 029 | | BR-BAL-007 | BAL-009, 019 |
| BR-GRP-011 *(does not exist — numbering ends at 010)* | — | | BR-BAL-008 | BAL-009, 013, 019 |
| | | | BR-BAL-009 | GRP-021, ACC-018/025 |
| | | | BR-BAL-010 | **Not automated** — feature absent (contract review) |
| | | | BR-BAL-011 | BAL-003(e), 022 |

## 7. Cross-cutting items

| Item | Test cases |
|---|---|
| ASM-001 (random-spread remainder) | EXP-004, 005, 008 |
| ASM-002 (kuruş, 2 decimals) | EXP-001, 002, 003 (+ every money assertion) |
| ASM-003 (current password required) | ACC-010, 011 |
| ASM-004 (session management incl. logout) | ACC-008, 016, 017 |
| D-ARCH-002 (password change invalidates other sessions) | ACC-012 |
| D-ARCH-003 (password policy 8–128, no composition) | ACC-004(a–d), 013 |
| D-ARCH-004 (derived ledger state) | BAL-018, 019 (assertions only via API; no stored-plan reads) |
| API error contract (envelope, all codes) | ACC-022 · ACC-014/GRP-022/EXP-027/BAL-020 (CSRF) · per-code cases in each plan's §4 |
| CSRF — all 13 state-changing routes (4 auth + 4 groups + 3 expenses + 2 settlements) | ACC-014 · GRP-022 · EXP-027 · BAL-020 |
| Existence hiding (404 parity) | GRP-021 (+ ACC-015) |
| Login non-enumeration parity | ACC-007 |
| Throttle contract (429, amended 2026-09-25) | ACC-031, 032, 033 |
| Email normalization at login (amended 2026-09-25) | ACC-030 |
| Error precedence — DTO before service (amended 2026-09-25) | ACC-034, 035 · GRP-010 · EXP-012 |
| `SUGGESTION_STALE` consistency rule (strategy G-2) | BAL-012 |
| Suggestion greedy fallback > 12 nonzero (strategy G-5) | BAL-004 |
| Expense-list defensive cap (strategy G-5) | EXP-025 |

## 8. Orphan check (both directions)

**Requirements without tests:** none. Every FR (45/45), every UC main flow (20/20), every UC alternate/error flow (all 21 named flows), every NFR (20/20 — 18 automated, NFR-ACC-002 by architecture review, BR-BAL-010's feature-absence by contract review), and every BR (40/40 — retention/absence rules verified by contract review plus the retention TCs) traces to at least one test case or an explicitly recorded, user-visible verification method.

**Tests without requirements:** none. All 125 TCs trace to at least one FR/UC/NFR/BR flow, an architecture contract (API §1–§4, arch §5/§8), an SC, an ASM/D-ARCH decision, or a recorded amendment/interpretation — each domain plan's §4 matrix shows the reverse mapping. The 8 tests that trace primarily to architecture/amendment items rather than domain-report requirements are: ACC-014 (CSRF), ACC-022 (envelope), GRP-022/EXP-027/BAL-020 (CSRF), ACC-031–035 (throttle/normalization/precedence amendments), GRP-018/019 (interpretations I-1/I-2) — all are contracts the architecture docs define, which is a legitimate trace target.

**Cross-domain promise ledger (all kept):**
- FR-ACC-008 UI assertions → GRP-028, 030 · EXP-031 ✓
- NFR-ACC-005 scale fixture → GRP-024 ✓
- SC-006 matrix ownership (GRP plan, cross-referenced by EXP/BAL) → GRP-021 ✓
- SC-005 operation matrix split (EXP-023 + BAL-016) ✓
- SC-007 lifecycle ownership (BAL plan) → BAL-025 ✓

## 9. Consolidated accepted limitations (visible to the user, by design)

| # | Limitation | Where recorded |
|---|---|---|
| L-1 | SC-001 adoption outcome — real-world usage, not automatable | Strategy G-7 |
| L-2 | NFR-ACC-002 near-free hosting — architecture/deployment review | Strategy §6 |
| L-3 | 30-day session expiry and 15-minute throttle window **wall-clock rollover** — no clock injection (T6) | Strategy G-6 · ACC §1 |
| L-4 | Owner CLI password reset — session behavior unspecified upstream (F1); recommended runbook amendment recorded | ACC §1 |
| L-5 | BR-BAL-010 money movement — feature absent by design | BAL §1 |
| L-6 | Combined-error precedence among service-level checks (EXP) and party+mismatch (BAL) — unspecified upstream, all outcomes are equivalent rejections | EXP §1 · BAL §1 |
| L-7 | Interpretations I-1/I-2 (approve/reject on decided requests; non-member callers) — recorded, flagged for architect confirmation | GRP §1 |
| L-8 | Join-code entropy — by construction (CSPRNG), not separately testable | GRP §1 |
| L-9 | UC-ACC-005 steps 1–2 and E1 (owner's human identity verification) — out-of-app by design | ACC §1 |
| L-10 | No load tests — load trivial by construction at 8×5 scale | Strategy §6 |

## 10. The contract

The coder agent implements against the four domain plans under this strategy; **the tests are the definition of done** — an FR is complete when its test cases pass, not when the code looks right. Once approved, test cases may not be weakened to make implementation pass; only the user can change a test case. Changes to any TC propagate per the change-propagation rule (strategy §7 / plan headers): affected tickets are listed and flagged for planner re-validation. No tickets exist yet — `.pipeline/plan/` has not been created; when the planner slices this backlog, ticket acceptance criteria must reference TC IDs verbatim.
