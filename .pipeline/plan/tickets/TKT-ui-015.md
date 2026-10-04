# TKT-ui-015: Groups overview — 1:1 restyle (PG-005)

- Status: blocked
- Size: M
- Scope:
  - Modify: `apps/web/src/pages/GroupsOverviewPage.tsx` + colocated `GroupsOverviewPage.css`
  - Must NOT touch: `apps/web/src/styles/**`, `apps/web/src/layout/**`, any other page (incl. `JoinPage.tsx` — the code-entry destination), `apps/web/src/api/**`, `apps/web/src/routes.ts`, `apps/api/**`, existing spec files, `figma/**`
- Traces to: FR-GRP-001, FR-GRP-002, FR-GRP-003, FR-GRP-009; UC-GRP-001, UC-GRP-002 (code entry); UC-ACC-002 step 3 (post-login landing)
- Acceptance (page-alignment, explicit + existing TCs green):
  1. Rendered page matches Figma board 04 "Groups" **1:1 — Desktop layout (`2:24338`) at 1230px, Mobile layout (`2:24445`) at 390px**; the frozen snapshot `figma/groups.png` is the pinned acceptance target. PR includes before/after screenshots at both widths; reviewer verifies against the design-context output and the snapshot.
  2. Structure per PG-005 frozen: the user's group list (each opens the group view), empty state, create-group action with name input + invalid-name error, and the **join-by-code entry** (added in iteration 2 to close the UC-GRP-002 gap) navigating to PG-009. Structural deviation in the reference → STOP, flow back via the user — especially if the reference omits the code entry.
  3. No horizontal scroll at 390px.
  4. TC-GRP-003, TC-GRP-026 (create), TC-GRP-004 (invalid name), TC-GRP-009/027 or the equivalent join-entry UI specs, TC-GRP-031 (page timing) pass unmodified; full suite green.
- Architecture refs: 01-system-architecture.md §8.2 (CSP); 03-api-design.md §6 (routes unchanged — `/` and `/join/:code`)
- UX refs: PG-005; `00-ux-pages.md` § Design contract — Figma reference screens (2026-10-03), incl. the Figma source-of-truth subsection
- Figma refs: file `XzY4HLCoW70yfI9NgeLXqC` — board 04 Groups: Desktop layout `2:24338`, Mobile layout `2:24445`. Read via figma MCP. Board chrome and state labels are scaffolding — implement the layout frames only.
- Dependencies: TKT-ui-010, TKT-ui-011
- Parallel group: P-12 (with TKT-ui-012…014, 016…019 — verified disjoint page-file scopes)

## Blocker (2026-10-04) — ESCALATED: desktop content-width cap (E1)

Implementation landed and is code-mergeable: **PR #57** (branch `tkt-ui-015`, base `dev`, CI green at head `7397f87`). The review loop (pass 1, all three lenses: code approve, compliance compliant, security approve) **escalated E1** — a cross-cutting plan/scope defect with no in-scope fix, so it never entered the fixer loop.

**E1:** board 04 desktop `2:24338` has a 1230px frame with 42px padding → **1146px content, 3× ~371px cards**. The shell caps content at `--layout-max-width: 60rem` (`styles/tokens.css:104`) via `.app-main` (`layout/RootLayout.css:134`) → **912px content → ~293px cards**. All page-local geometry matches (rhythm 26/20, gaps 16, card height 134 vs 136, 3-up/1-up, 2-up/1-up); only the column width differs. The fix lives in `styles/`+`layout/` — forbidden by this ticket and by P-12. **Acceptance item 1 is unmet as written.** It affects every P-12 page's desktop width fidelity.

**Owner options:**
1. **Waive** the 1230px width delta for iteration 3 — accept the shell cap as an intentional deviation (record in `00-ux-pages.md`); then re-review/merge #57.
2. **Open a layout ticket** to widen `--layout-max-width`/`.app-main` to the reference column and re-verify the affected pages.

Also routed back (non-blocking): group-card data gap (`GET /api/groups` lacks per-group balance/member counts — API extension needed); frozen copy kept over the reference (Create/Join/empty line, 1–100 message); create reveal-vs-open interpretation.

**Review artifact:** `reviews/TKT-ui-015-round-1.md`. PR #57 left open, not merged.
