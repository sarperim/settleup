# TKT-ui-010: Iteration-3 foundation — reference-driven token refresh & shared styles

- Status: blocked
- Size: M
- Scope:
  - Modify: `apps/web/src/styles/tokens.css`, `apps/web/src/styles/base.css`, `apps/web/src/styles/fonts.css` (only if the references change typography or font family)
  - Must NOT touch: any page component (`apps/web/src/pages/**`), `apps/web/src/layout/**`, `apps/web/src/api/**`, `apps/web/src/routes.ts`, `apps/api/**`, existing spec files, `figma/**` (read-only reference)
- Traces to: foundation (iteration-3 design foundation — no FR; explicit acceptance below)
- Acceptance (foundation-style, explicit):
  1. **MCP connectivity proof — gate for the whole iteration:** call `get_design_context` on representative frames from the Figma file (file key `XzY4HLCoW70yfI9NgeLXqC` — e.g. board 01 Desktop `2:24031`, board 05 Desktop `2:24555`) and extract the design's palette and typography from the returned reference code and metadata. This is a **text** read — no image vision required. If the design context cannot be retrieved (auth, permissions, rate limits), STOP and report — do not fall back to guessing from the PNG snapshots alone.
  2. Token values refreshed from the design context; family confirmed warm cream surfaces + pastel-red accents + warm brown text (per `00-ux-pages.md` § Design contract). Note: the design uses **no Figma variables** (verified 2026-10-03) — values come from the design-context output. Single source: all color/font values live in `tokens.css`; nothing hard-coded elsewhere.
  3. Shared classes in `base.css` (`.card`, `.alert`, `.list`, `.btn` + modifiers, `.muted`, `.stack`, `.row`) restyled to the shared component appearance shown in the references (cards, alerts, chips, buttons, inputs, badges recur across all boards).
  4. Full suite green (`pnpm test`, `pnpm test:e2e`) — presentational change only; no testid, role, label, or text-assertion changes.
  5. Production SPA initial bundle ≤ 300 KB gzipped (NFR-ACC-003); CSP-clean — no remote assets or fonts (arch 01 §8.2).
  6. **Third supporting color (iteration-2 open item):** during extraction, explicitly check whether the references carry a third supporting color beyond the pastel-red accent family (the owner request recorded on the iteration-2 board, never ticketed). If present → land it as part of the refreshed tokens and note it in the flow-back amendment, closing the open item. If absent → do NOT invent one; report back and the request stays open as a separate user decision.
  7. Flow-back: the final token values are recorded as an amendment in `00-ux-pages.md` § Design contract (mirroring the TKT-ui-001 "Pinned specifics" pattern) — the ticket is not done until the plan records what shipped.
- Architecture refs: 01-system-architecture.md §8.2 (helmet CSP — self-hosted assets), §3 (NFR-ACC-003 bundle budget)
- UX refs: `00-ux-pages.md` § Design contract — Figma reference screens (2026-10-03) — the whole section, including the Figma source-of-truth subsection and board map; § Pinned specifics — TKT-ui-001 (the values being refreshed)
- Figma refs: file `XzY4HLCoW70yfI9NgeLXqC` (page `0:1`) — read via the figma MCP; no variables exist, values come from `get_design_context` output. Board chrome ("Board heading", state labels) is scaffolding — never implemented.
- Dependencies: none in-repo — but requires (a) the `figma/` snapshot commit on main, and (b) the figma MCP server reachable from the coder environment (user-level opencode config, verified 2026-10-03)
- Parallel group: none — iteration-3 foundation; every page ticket depends on it

## Blocker (2026-10-03) — ESCALATED: typography fidelity gap (E1)

Implementation landed and is code-merge-ready: **PR #49** (branch `tkt-ui-010`, base `dev`), CI green at head `4a1314c`; MCP gate passed and token values extracted. The review loop escalated on an acceptance-relevant gap only the owner can resolve.

**E1 (the blocking decision):** the Figma references use **Nunito Sans + Inter**; the shipped font stack is **Fraunces + Nunito**. Verified by both coder and reviewers against the design context. Closing the gap requires adding `@fontsource-variable/nunito-sans` and `@fontsource-variable/inter` to `package.json`/`pnpm-lock.yaml` — TKT-ui-001's scope, not TKT-ui-010's — so the coder correctly deferred and did **not** expand scope. Because iteration-3's contract is "1:1 screens," the type does not match; not a waivable detail.

**Owner options:**
1. Authorize the font dependency — open a scoped font ticket (or amend TKT-ui-010's scope) to add the two packages and re-pin `fonts.css` fonts tokens, then re-dispatch.
2. Waive E1 — accept Fraunces + Nunito for this iteration (recorded as a scope/acceptance deviation).

**NF1 (non-blocking, should-fix):** `--color-accent-contrast` changed `#4a2a2c`→`#9d493f` (`tokens.css:44`, consumed by 3 pages) is not recorded in the `00-ux-pages.md` amendment — one-line fix, or waive (value already recorded under accent-strong).

**Resolved in this ticket:** acceptance 6 — third supporting color **ABSENT**, independently verified; none invented; the iteration-2 owner request stays open. Acceptance 7 flow-back amendment landed.

**Review artifacts:** `reviews/TKT-ui-010-round-{1,2,3}.md`. No merge was performed. Ticket remains unmerged; PR #49 stays open for the owner.
