# TKT-ui-011: App shell — responsive chrome per the references (PG-001)

- Status: blocked
- Size: M
- Scope:
  - Modify: `apps/web/src/layout/RootLayout.tsx` + colocated `RootLayout.css`
  - Must NOT touch: `apps/web/src/styles/**` (frozen by TKT-ui-010), any page component, `apps/web/src/api/**`, `apps/web/src/routes.ts`, `apps/api/**`, existing spec files, `figma/**`
- Traces to: FR-ACC-005, FR-ACC-008; UC-ACC-003 (logout); UC-ACC-006 (guard behavior renders through the shell)
- Acceptance (page-alignment, explicit + existing TCs green):
  1. Shell chrome matches the "Top bar" frames in the Figma references — **desktop (72px top bar) at 1230px viewport and mobile at 390px viewport, 1:1**, in both nav variants the design distinguishes: authenticated (mobile top bar 94px — boards 03–08) and anonymous (mobile top bar 81px — boards 01–02). App name + brand mark, acting user's display name, nav to groups overview and change password, logout. PR includes before/after screenshots at both widths in both variants; reviewer verifies against the design-context output and the frozen PNG snapshots.
  2. Structure per PG-001 unchanged: display name never email; authenticated vs anonymous nav sets; logout ends the session and returns to login.
  3. No horizontal scroll at 390px.
  4. TC-ACC-008, TC-ACC-009, TC-ACC-025 (logout/session behavior) and TC-ACC-027 (auth page timing) pass unmodified; full suite green — no testid, role, label, or text-assertion changes.
- Architecture refs: 01-system-architecture.md §8.2 (CSP); §6 route table via 03-api-design.md §6 (routes frozen — nav targets unchanged)
- UX refs: PG-001; `00-ux-pages.md` § Design contract — Figma reference screens (2026-10-03), incl. the Figma source-of-truth subsection
- Figma refs: file `XzY4HLCoW70yfI9NgeLXqC` — Top bar frames: authenticated desktop `2:24556` (board 05), anonymous desktop `2:24032` (board 01); mobile Top bars are the first children of the mobile layouts (`2:24878` authenticated, `2:24075` anonymous). Brand mark assets exportable via `get_design_context`/`download_assets`.
- Dependencies: TKT-ui-010 (refreshed tokens)
- Parallel group: none — lands before the page tickets: every page screenshot includes the shell, so page verification is only meaningful against the new chrome

## Blocker (2026-10-03) — Figma MCP read quota exhausted

Dispatched coder stopped before touching any file (worktree clean, no PR). **The Figma MCP read quota is exhausted** — every read tool (`get_design_context`, `get_metadata`, `get_screenshot`) returns *"You've reached the Figma MCP tool call limit on the Starter plan."* Confirmed independently by the orchestrator. Cause: plan `Sarp's team`, tier `starter`, seat `View` — the official limit is ~**20 tool calls per month**, consumed by the earlier iteration-3 tickets (ui-010/012/013).

No non-MCP fallback exists: the frozen `figma/*.png` snapshots cannot be used because this model has **no image input**; no design-context output for the top-bar nodes was saved to the repo or `/tmp`; and the MCP is OAuth-only (no PAT/REST fallback under the filesystem/CSP boundary). The brand-mark asset is only obtainable via the MCP.

**Impact:** TKT-ui-011 cannot be implemented to the 1:1 contract; and TKT-ui-014…019 (P-12 remaining) are blocked too — each needs design-context reads for its board.

**Unblocks via an owner action (not an agent call):**
1. Restore MCP read quota — upgrade the Figma seat to Dev/Full (≈200/day) or the plan; or wait for the monthly reset; **or**
2. Provide a Figma Personal Access Token (or a saved design-context dump for the top-bar + page nodes) so the coder can use the REST API without MCP quota; **or**
3. Explicitly re-scope iteration 3 to "structural only, no 1:1 fidelity/brand mark" — a scope reduction to be recorded in the plan before dispatch.

No structural contradiction with PG-001 was found — this is purely a tooling/access blocker.
