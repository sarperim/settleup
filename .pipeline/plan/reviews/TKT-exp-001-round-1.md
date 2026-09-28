# Review Round 1 — PR #22 (TKT-exp-001: Split engine — equal split with random-spread remainder, exact split, pure)

PR: https://github.com/sarperim/settleup/pull/22
Branch: `tkt-exp-001` → `dev` · Head at review: `8526a1c` · Base: `df9ca72` (= `origin/dev` tip; merge-base verified — the PR is a clean descendant of dev's tip)
Review date: 2026-09-28
Isolated checkout: `/tmp/opencode/worktrees/rl-tkt-exp-001` — branch `pr-22` at `8526a1c` (same commit as the PR head `origin/tkt-exp-001`; `git worktree list`-resolved main checkout `/home/sarp/settleup` on `dev` at `df9ca72` never touched). Tree clean at review start, after every lane, and at every gate (lead-verified; reviewers modified nothing — confirmed by `git status` after all three lanes and after every lead phase). Scratch namespace `/tmp/opencode/review-exp-001/`. All five `_e1r`-suffixed databases (`settleup_test/e2e/e1r_c/e1r_k/e1r_s`) provisioned by the lead with migrations applied; every lane ran on its own database (no collision).

Scope context: first ticket of the expense domain (C4) — the pure split engine everything else in the domain consumes. Per `.pipeline/plan/tickets/TKT-exp-001.md`: equal split per arch §5.1 / ASM-001 (floor base + one extra kuruş to each of `r` distinct CSPRNG-chosen recipients), exact split (accept iff parts sum exactly, zero shares valid per OQ-EXP-003), pure function of (amount, participants, split type, RNG stream) with the production CSPRNG wiring landing in TKT-exp-002. Acceptance: TC-EXP-004/005/006 green.

Environment note: three reviewer sessions — `compliance-reviewer`, `code-reviewer`, `security-reviewer` — dispatched concurrently via `opencode run` against this checkout, each with its own provisioned PostgreSQL. **Dispatch incident (recorded for history integrity):** the lead's tooling timeout (20 min) killed the code and compliance lane clients mid-run (server-side sessions died with them; only the security lane, whose final turns were in flight, completed through its kill). Both lanes were re-dispatched fresh against the same head with the same per-lane databases and completed normally; nothing from the interrupted attempts was relied on. Full lane reports preserved at `/tmp/opencode/review-exp-001/{compliance,code,security}-report.md`. Every claim in the PR body's implementation record was re-verified by the lead; nothing was trusted.

## Blast radius gate (pass-1 dispatch decision)

**Classification: FULL — all three review lanes run.** Reasoning recorded:

- The diff adds executable production logic (`apps/api/src/ledger/engine/split-engine.ts`, 181 lines) — not presentation-only, not non-executable, not comment/formatting-only. The LOW gate's "every touched file presentation-only or non-executable" condition fails on its face.
- Test files are touched (three new unit specs) — the LOW gate's "no test files" condition fails.
- The ticket pins automated acceptance TCs (TC-EXP-004/005/006 green) — the compliance lane must verify them; the LOW gate's "no pinned acceptance TCs" condition fails.
- The engine is the CSPRNG-consuming fairness-critical core of the ledger domain (ASM-001) — squarely security-relevant; the security lane must confirm the randomness handling is sound.

## Scope fence (allowed set) — verified held exactly (lead + compliance lane, independently)

`git diff origin/dev...HEAD`: exactly 5 files, no renames, no mode changes (+451/−1):

| File | Change |
|---|---|
| `.pipeline/plan/tickets/TKT-exp-001.md` | status `todo`→`in-review (PR #22 → dev)` + one added `Evidence:` line only (verified — every other line byte-identical) |
| `apps/api/src/ledger/engine/split-engine.ts` | new (181 lines) |
| `apps/api/test/unit/tc-exp-004-equal-split-properties.spec.ts` | new (79 lines, 1 test) |
| `apps/api/test/unit/tc-exp-005-equal-split-edges.spec.ts` | new (97 lines, 7 tests) |
| `apps/api/test/unit/tc-exp-006-exact-split-sum.spec.ts` | new (92 lines, 4 tests) |

**Zero lines** (verified by direct path-filtered diff query — lead and compliance lane independently) to the ticket's must-NOT-touch set: ledger controllers/services/module wiring (the engine is referenced by no other file in `apps/api/src` — rg-verified, only self-matches; the emitted `dist/ledger/engine/split-engine.js` has zero runtime imports), `apps/web/**`, `packages/shared/src/**`, `apps/api/prisma/**`, root `package.json`, `pnpm-lock.yaml`. `apps/api/tsconfig.json` is unchanged (not in the diff — matches the evidence-line claim; the coder's `paths` experiment was reverted in head commit `8526a1c`). No new dependencies. No pre-existing test or `support/` helper touched (`support/seeded-prng.ts` is pre-existing, from TKT-groups-001 `1133efe`).

## Reviewer verdicts (pass 1, dispatched in parallel)

| Lane | Verdict | Blocking findings |
|------|---------|-------------------|
| compliance | **COMPLIANT** | 0 violations · 2 nits (C-2, C-3) · 2 observations routed upstream (C-1, C-4) |
| code | **APPROVE** | 0 blockers · 1 should-fix (K-2, non-blocking) · 4 nits (K-1, K-3, K-4, K-5) |
| security | **APPROVE** | 0 findings at critical/high/medium · 1 low, forward-routed (S-1 → TKT-exp-002) |

## Baseline gates (review-lead run, from scratch in the isolated worktree)

- `pnpm install` — exit 0 (fresh worktree, from the shared store). `pnpm --filter api exec prisma generate` — exit 0.
- `pnpm lint` — exit 0 (shared, api, web). `pnpm typecheck` — exit 0 (shared, api, web).
- `pnpm build` (`pnpm -r --sort`) — exit 0 (`apps/api/dist/main.js` + `dist/ledger/engine/split-engine.js`, `packages/shared/dist/index.js`, `apps/web/dist/` emitted; tree pre-built for the lanes — no lane ran a concurrent build).
- `pnpm exec vitest run --project unit` — **21 files / 91 tests passed, exit 0** (2.66 s).
- `DATABASE_URL=postgresql://settleup:settleup@127.0.0.1:5432/settleup_test_e1r pnpm test` — **76 files / 226 tests passed, exit 0** (57.0 s) — matches the ticket's evidence claim exactly (baseline 72/214 implied at merge-base; delta +4 files / +12 tests — the 3 new spec files contain 1+7+4 `it(` blocks, arithmetic lead-verified).
- `E2E_DATABASE_URL=postgresql://settleup:settleup@127.0.0.1:5432/settleup_e2e_e1r PSQL=/tmp/opencode/review-exp-001/psql pnpm test:system` — **1/1 passed, exit 0** (TC-ACC-028 built-CLI owner-reset — the same system test that caught the coder's reverted tsconfig-paths experiment).
- CI on head `8526a1c`: run [36420672523](https://github.com/sarperim/settleup/actions/runs/36420672523) "Lint, test & build" **SUCCESS** (lead-verified via `gh pr checks 22`).
- All three reviewer lanes independently re-ran the suite green on their own databases (compliance 76/226 on `settleup_e1r_c`; code 76/226 on `settleup_e1r_k` + lint/typecheck/unit; security 76/226 on `settleup_e1r_s`; each also re-ran the unit project 21/91).
- **Lead non-vacuity verification (mutation probes, re-run in a throwaway copy at the same commit — `/tmp/opencode/review-exp-001/mut`, since removed; the shared worktree was never mutated):**
  - **Mutation A** (remainder `+1` dropped: `shareKurus: base` for all): TC-EXP-004 **failed** (property, first case) + TC-EXP-005 cases **c, (e)-2nd, f failed** (4 tests total). TC-EXP-006 unaffected (exact split). Matches the PR body's red-before-green claim in substance.
  - **Mutation B** (exact-sum check disabled: `if (false)`): both TC-EXP-006 **reject** cases failed; both accept cases still passed.
  - **Mutation C** (draw forced when r=0: shuffle loop `i <= count`): TC-EXP-005 cases **a, d failed via the ThrowingRandomSource**; case **b survived** — explained and resolved by the code lane (§4.2 of its report): the mutation is *semantically inert at n=1* (`randomIntBelow(bound=1)` legitimately returns 0 without drawing; self-swap; empty slice), and a stronger variant that actually draws (unconditional `random.nextUint32()` at the top of `equalSplit`) trips **a, b, d** — case (b) pins "no draw" exactly as strongly as the contract allows. Not a test gap.
  - All mutations reverted → byte-identical to head (`diff` clean) → 12/12 green in the same throwaway copy; probe worktree removed; shared worktree untouched at `8526a1c` throughout.
- **Lead spot-checks of the lanes' most consequential claims** (all confirmed by direct execution against the pre-built engine, in scratch outside the worktree): (1) K-3's duplicate-ids premise — `equalSplit(3, ['u0','u0'])` → `[{u0,2},{u0,2}]`, sum 4 ≠ 3 (the Set-marking doubles the +1). (2) K-2's premise — `exactSplit(5000, ['alice','bob'], {alice: 5000})` → `ok:true`, bob 0 (missing-key→0 path has zero spec coverage). (3) S-1's evidence — `exactSplit(1000, [a,b], {a:1500,b:-500})` → `ok:true` and `{a:500.5,b:499.5}` → `ok:true` (negative and non-integer parts accepted pre-validation). (4) K-3(b)'s premise — `splitExpense({EXACT, participantIds: [], amountKurus: 100})` → misleading `SPLIT_SUM_MISMATCH` instead of the `equalSplit` `RangeError`. (5) K-1's premise — for amount 10002 over 4, `SEED` marks {u0,u3} and `SEED_2` marks {u0,u1}, so the different-seed contrast is deterministically assertable. (6) Compliance's no-wiring claim — rg over `apps/api/src` excluding the engine dir: only the engine itself. (7) C-1's tooling premise — `apps/api/tsconfig.json` includes only `src/**/*` (test dirs outside the typecheck globs); no test anywhere references `SplitType` (rg over both test trees: zero matches).

## Compliance lane (summary)

- **TC coverage:** all three acceptance TCs present, translated clause-by-clause with strictness-preserving strengthenings — TC-EXP-004 (fixed fast-check seed + 500 runs; generators at the strategy §5 bounds exactly: amount 0…2^31−1, n 1–8; all four expected properties: exact sum, base/base+1 bounds, exactly `r` recipients of +1, one row per participant via length + sorted-id multiset; per-case deterministic seed derivation), TC-EXP-005 (all six plan edge cases a–f; the three r=0 rows pinned by a throwing source — stronger than the plan's "no draw needed" notes), TC-EXP-006 (accept value-for-value, reject ±1 with the reason enum, zero-share vector accepted and preserved). The plan's "service surfaces as `400 SPLIT_SUM_MISMATCH`" correctly stays engine-level here (reason string) — the 400 surfacing belongs to the integration TCs of TKT-exp-002; correct level split, not a softening. No `.skip`/`.only`/`.todo`/`xit` markers (rg-verified).
- **Scope:** held exactly (independently re-verified — the fence table above).
- **Architecture:** 01 §3 rule 3 asserted at the runtime level (the emitted engine JS has zero runtime imports — the `RandomSource` import is type-only and erased; reusing C3's abstraction is explicitly anticipated by `random-source.ts`'s own header); §5.1 equal/exact translated verbatim; strategy §3 T5 (the seeded PRNG is the one sanctioned double), §7 rule 2 (every randomized path runs from fixed, reported seeds).
- **Gold-plating:** none — the engine surface is exactly the ticket's FRs; `splitExpense` is the ticket's own mandated dispatch; the `never` exhaustiveness arm is a compile-time guard, not behavior.
- **Implementation record:** every checkable claim verified true (21/91, 76/226, 1/1, lint/typecheck/build, scope fence, tsconfig unchanged, red-before-green consistent with the lead's probes).

## Code lane (summary)

Verified correct, on record: `randomIntBelow` rejection sampling analytically unbiased (`limit = floor(2^32/bound)·bound`; accepted draws uniform; `bound | 2^32` → zero rejection; worst-case expected ≤ 2 iterations; `bound ≤ 1` shortcut correct and entropy-saving); partial Fisher–Yates uniform over count-subsets (standard argument + the lane's own empirical probe: 1.5M trials across n=4/r=2, n=3/r=1, n=5/r=3 — all subsets within 1–2% of uniform); `equalSplit` arithmetic exact in doubles through 2^31−1 (case f pins the boundary); input order preserved and pinned; `exactSplit` sum constrained by BR-EXP-006 with the discriminated-union failure matching the error-contract vocabulary; `splitExpense`'s `never`-assignment the standard exhaustiveness idiom. RUNS=500 judged adequate (constructive invariants; property 1 independent of the engine's own formula — sum + bounds + n rows jointly pin `r`; the dangerous boundaries separately pinned by TC-EXP-005, the correct division of labor). Test quality: deterministic seeds throughout, `ThrowingRandomSource` doubles an elegant pin of the no-draw contracts, expected values trace to plan constants rather than implementation echoes. One should-fix (K-2: the documented missing-key→0 semantics has zero test coverage — one additive case) and four nits (table below); zero blockers.

## Security lane (summary)

Verified clean: no new input path, dependency, secret, logging path, or configuration exists in the diff (sweeps + emitted-artifact check: the built engine module has zero runtime imports). **Randomness handling textbook-correct and empirically uniform** (chi-square over 300k trials per configuration: n=4/r=2 χ²=6.7 df 5; n=8/r=3 χ²=43.2 df 55; n=8/r=1 χ²=2.4 df 7 — all well under crit₀.₀₁; per-participant +1 frequency max |z| = 1.22); no draw reuse, no state leak; the observable output (who got +1) is the intended public information; production CSPRNG wiring correctly deferred to TKT-exp-002. Rejection loop probabilistically bounded even adversarially; `randomIntBelow` is module-private so no pathological bound is reachable. One low finding forward-routed (S-1: the engine performs no input hardening — negative shares, non-integer kuruş, NaN, duplicate ids all accepted pre-validation — by design the TKT-exp-002 service fence must own validation; routed with a concrete validation checklist for that ticket's acceptance criteria). NaN in `exactAmounts` is safely rejected by the sum check. Carried S-2/R-2 (joinCode pino redact) untouched by this diff and still tracked on its original tickets — carried-status only.

## Consolidated findings

IDs scoped to this PR/round. **No blocking findings at any tier.** Should-fix, nits, and observations never block.

| ID | Severity | Source | Location | Status | Summary |
|----|----------|--------|----------|--------|---------|
| K-2 | should-fix (non-blocking) | code | `split-engine.ts:139,169` | open | The documented missing-key→0 semantics (`exactAmounts[participantId] ?? 0` + the dispatch's `?? {}`) has zero test coverage — all four TC-EXP-006 cases supply complete maps, so a regression of either `??` passes the suite. Test gap, not a code defect (paths unreachable via service-validated input). Fix: one additive accept case in `tc-exp-006` (`{alice: 5000}` over [alice,bob] → `[5000, 0]`), ~10 lines. |
| K-1 | nit (non-blocking) | code | `tc-exp-005-equal-split-edges.spec.ts:63,71` | open | Two `it` blocks share the label `(e)`: the plan's determinism case and an extra different-seed case (the plan table has exactly six rows). The extra case also never asserts the two seeds produce *different* vectors (deterministically assertable: SEED marks {u0,u3}, SEED_2 marks {u0,u1}). Fix: relabel `(e′)` + `expect(b).not.toEqual(a)`. |
| K-3 | nit (non-blocking) | code | `split-engine.ts:104–110,155–170` | open | (a) `participantIds` distinctness precondition undocumented while duplicates silently break the sum invariant (lead-verified: `equalSplit(3, ['u0','u0'])` sums to 4). (b) The n=0 guard is asymmetric: `splitExpense({EXACT, [], amount>0})` returns a misleading `SPLIT_SUM_MISMATCH` instead of the `equalSplit` `RangeError`. Fix: one JSDoc line; optionally hoist the throw into `splitExpense`. |
| K-4 | nit (non-blocking — design-point adjudication, see § below) | code | `split-engine.ts:26–31` | open | Local `SplitType` union judged the correct call under the FLAG constraint; drift pin not warranted by precedent (type-only union — the error-code guard mechanism does not transfer). Optional: name the mirrored module in the JSDoc (`packages/shared/src/dto/expenses.ts#SplitType`) so either side greps to the other. |
| K-5 | nit (non-blocking) | code | `split-engine.ts:132` | open | `exactSplit` exported but unconsumed outside the module (specs exercise EXACT through the dispatch — good). Either drop the `export` or accept it as the symmetric primitive seam for TKT-exp-002. |
| C-1 | observation (non-blocking — planning/architecture defect, route to FLAG-1 owner) | compliance | `split-engine.ts:31` vs `packages/shared/src/dto/expenses.ts:20` | open — upstream | The local `SplitType` mirror has no drift guard, unlike the error-code precedent's runtime pin — but the pin mechanism is mechanically unavailable for a type-only union under current tooling (esbuild-compiled specs, test dirs outside the api typecheck globs, shared exports no runtime anchor), and the DTO mirrors set the same un-pinned precedent. Root cause is FLAG-1 (build-before-check ordering), already routed to architect/planner. This is the **third** un-pinned mirror instance; drift first surfaces as a typecheck error at TKT-exp-002's DTO→engine call site, which that ticket should wire directly. |
| C-2 | nit (non-blocking) | compliance | ticket `TKT-exp-001.md:4` | open | The evidence line phrases the mirror as "No deviation" — technically true within the ticket's four corners and fully disclosed, but it is an instance of the FLAG-1'd workaround against arch §4's one-set-of-types intent. Recommend future evidence lines say "FLAG-1 instance, precedent-faithful". No action on this PR. |
| C-3 | nit (non-blocking) | compliance | `tc-exp-005-equal-split-edges.spec.ts:71–83` | open | Extra sub-case beyond the plan's a–f table (the second `(e)`). Strengthens the suite (seed-variance robustness), adds no capability, lives in an in-scope file. Acceptable test-authorship latitude; overlaps K-1's label point. |
| C-4 | observation (non-blocking — route to TKT-exp-002 planning) | compliance | `split-engine.ts:139` | open — upstream | `exactAmounts` missing-key semantics (absent key = valid zero share, or `VALIDATION_FAILED`?) is unspecified engine behavior untested by the new specs. BR-EXP-006's sum check still fully constrains the outcome; request-shape validation belongs to exp-002's DTO layer. Pin the shape contract when that ticket lands. |
| S-1 | low (non-blocking — forward-routed to TKT-exp-002) | security | `split-engine.ts:113–149` | open — upstream | Engine performs no input hardening by design (lead-verified: negative parts, non-integer kuruş, NaN amounts, duplicate ids all accepted/handled pre-validation). Not exploitable via this diff (the engine is wired to nothing), but once exp-002 lands, any service-validation gap flows straight into persisted ledger shares. Routed with a concrete pre-engine validation checklist: integer amount in [0, 2^31−1]; participantIds non-empty and de-duplicated; EXACT values integers in [0, amount] with keys ⊆ participantIds. Optional defense-in-depth: engine-side `RangeError`s mirroring the existing n=0 guard. |

**Upstream routings (planning/architecture defects and forward-contract items, not PR violations — the fixer fixes code, not documents):** C-1 (FLAG-1 owner — third un-pinned mirror; the durable fix deletes all mirrors and the error-code pin at once), C-4 (exp-002 planning — exactAmounts shape contract), S-1 (exp-002 acceptance — the service validation fence).

## Deviation adjudication (the coder's flagged design point, user-routed)

**Local `SplitType` union instead of importing from `packages/shared` — COMPLIANT with pre precedent; no change required.** Adjudicated independently by the compliance lane (its §6) and the code lane (K-4); the lead concurs:

- **Ticket:** nothing in the ticket or its fence mandates importing `SplitType` from shared; the ticket pins purity, the algorithm, and the file scope — all satisfied. `packages/shared/src/**` and `apps/api/tsconfig.json` untouched (verified). The evidence line discloses the choice fully and accurately: "structurally identical to shared's" — verified true (`'EQUAL' | 'EXACT'` ≡ `packages/shared/src/dto/expenses.ts:20`) — and "tsconfig.json is unchanged" — verified true.
- **Architecture:** arch §3 rule 3 (purity/injectable CSPRNG) is unaffected — a shared import would also be type-only and erased; the blocker is tooling, not purity. The tension with arch §4's "one set of types eliminates drift" rationale is the pre-existing **FLAG-1 root cause** (documented in TKT-foundation-004): `packages/shared` exposes only its compiled `dist/`, and `pnpm typecheck`/`pnpm test` run before `pnpm build`, so importing shared from `apps/api/src` fails with TS2307/module-not-found. The coder's attempted `paths`-to-source mapping broke the API build and TC-ACC-028 (the system test caught it — the fence worked) and was correctly reverted at head `8526a1c`.
- **Precedent:** three prior instances of the identical pattern for the identical root cause — `error-contract.ts` (FLAG comment + runtime drift pin), `register.dto.ts` and `create-group.dto.ts` (inline-mirrored bounds, no pin). This PR's instance carries the same FLAG-style comment and disclosure discipline. The one gap vs the fullest precedent form (no drift pin) is mechanically unavailable for a type-only union under current tooling, matches the DTO-mirror precedent, and is bounded: drift becomes a compile error at TKT-exp-002's DTO→engine seam the moment that ticket wires a shared-typed value in. Routed upstream as C-1; the residual risk is owned by the already-routed FLAG-1.

## Mergeability (pass 1)

Open blocking findings (compliance violation / code-review blocker / critical-high security): **ZERO.**

- Compliance: **compliant** — zero violations; C-1/C-4 are routed upstream, C-2/C-3 nits.
- Code: **approve** — zero blockers; one should-fix (K-2) and four nits, all optional strengthenings.
- Security: **approve** — zero findings at any blocking severity; S-1 is a low forward-routed contract item for TKT-exp-002; randomness handling verified sound analytically and empirically.

**RESULT: MERGEABLE on pass 1 — the loop ends early on a clean pass.** Pass 2/3 and both fixer rounds unused. No disputes arose (nothing to arbitrate). No upstream defect blocks this PR (C-1/C-4/S-1 are routings, not blockers). Suite green on the final head: unit 21/91, full 76/226 (real PostgreSQL 17), system 1/1, lint/typecheck/build exit 0, CI SUCCESS — independently reproduced by the lead and all three lanes.

## Carried items from prior rounds — status record (inputs weighed, not waived)

| Item | Status in/after this PR |
|---|---|
| S-2 / R-2 (g-002 S-2 = g-004 R-2, from PR #16): `joinCode` absent from pino `REDACTED_KEYS` | Open, dormant, outside this ticket's fence — this diff adds no logging and touches no groups/common code. Still tracked on its original tickets; the user's bundle/waive/re-carry decision from the groups rounds stands. |
| g-002 C-5 / g-003 C-5: direct-read verification vehicle, planner amendment | Not surfaced — this ticket's specs are unit-level, no DB reads involved. |
| FLAG-1 (TKT-foundation-004): shared exposes only compiled dist/; build-before-check ordering blocks imports from `apps/api/src` | Continues as this round's **C-1** (third un-pinned mirror instance). Upstream, architect/planner; the durable fix (build shared before typecheck/test, or resolve shared sources) deletes all mirrors and the error-code pin at once. |
| **New forward-contract items for TKT-exp-002** (this round): S-1 service validation fence checklist; C-4 exactAmounts shape contract; C-1's DTO→engine seam as the natural SplitType drift pin; K-3(b)'s shared n=0 guard placement | Recorded for the exp-002 planner/coder — none block this PR. |

## Loop status

- Pass 1 (this round): all three lanes dispatched in parallel (blast radius FULL — gate reasoning above) → **zero open blocking findings → MERGEABLE**. No fixer dispatch; passes 2–3 unused.
- **User action requested: merge PR #22** (head `8526a1c` + this artifact's docs-only commit, pushed to `tkt-exp-001` per the established convention — cf. `docs(reviews): add PR #20 round-1 review artifact`; CI re-runs on the new head, expected green as it touches only `.pipeline/plan/`). After merge confirmation, the ticket's status moves to `done` and the board can be regenerated.
- Open non-blocking follow-ups recorded for the next owner (user's call: fixer bundle, fold into TKT-exp-002, follow-up ticket, or waive): **K-2** (should-fix — one additive test case), **K-1** (e-label + contrast assert), **K-3** (JSDoc precondition + guard symmetry), **K-5** (exactSplit export), **C-2/C-3** (nits); upstream **C-1** (FLAG-1 owner), **C-4 + S-1** (exp-002 planning/acceptance).

Ticket status remains `in-review` — the merge decision and the `done` transition belong to the user.
