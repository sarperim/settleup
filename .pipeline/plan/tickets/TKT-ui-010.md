# TKT-ui-010: Iteration-3 foundation — reference-driven token refresh & shared styles

- Status: blocked
- Size: M
- Scope:
  - Modify: `apps/web/src/styles/tokens.css`, `apps/web/src/styles/base.css`, `apps/web/src/styles/fonts.css` (only if the references change typography or font family)
  - Must NOT touch: any page component (`apps/web/src/pages/**`), `apps/web/src/layout/**`, `apps/web/src/api/**`, `apps/web/src/routes.ts`, `apps/api/**`, existing spec files, `figma/**` (read-only reference)
- Traces to: foundation (iteration-3 design foundation — no FR; explicit acceptance below)
- Acceptance (foundation-style, explicit):
  1. **Vision proof — gate for the whole iteration:** read the committed reference PNGs (`figma/*.png`) and extract the design's palette and typography. If the model cannot reliably read values from the images, STOP and report — do not guess. This ticket is the cheap, early proof that the implementation loop works before 8 page tickets are dispatched.
  2. Token values refreshed from the references; family confirmed warm cream surfaces + pastel-red accents + warm brown text (per `00-ux-pages.md` § Design contract). Single source: all color/font values live in `tokens.css`; nothing hard-coded elsewhere.
  3. Shared classes in `base.css` (`.card`, `.alert`, `.list`, `.btn` + modifiers, `.muted`, `.stack`, `.row`) restyled to the shared component appearance shown in the references.
  4. Full suite green (`pnpm test`, `pnpm test:e2e`) — presentational change only; no testid, role, label, or text-assertion changes.
  5. Production SPA initial bundle ≤ 300 KB gzipped (NFR-ACC-003); CSP-clean — no remote assets or fonts (arch 01 §8.2).
  6. **Third supporting color (iteration-2 open item):** during extraction, explicitly check whether the references carry a third supporting color beyond the pastel-red accent family (the owner request recorded on the iteration-2 board, never ticketed). If present → land it as part of the refreshed tokens and note it in the flow-back amendment, closing the open item. If absent → do NOT invent one; report back and the request stays open as a separate user decision.
  7. Flow-back: the final token values are recorded as an amendment in `00-ux-pages.md` § Design contract (mirroring the TKT-ui-001 "Pinned specifics" pattern) — the ticket is not done until the plan records what shipped.
- Architecture refs: 01-system-architecture.md §8.2 (helmet CSP — self-hosted assets), §3 (NFR-ACC-003 bundle budget)
- UX refs: `00-ux-pages.md` § Design contract — Figma reference screens (2026-10-03) — the whole section; § Pinned specifics — TKT-ui-001 (the values being refreshed)
- Dependencies: none in-repo — but requires the `figma/` reference commit on main first (planner lands it with user approval before dispatch)
- Parallel group: none — iteration-3 foundation; every page ticket depends on it

## Blocker (2026-10-03) — vision-proof gate failed

Dispatched coder ran the acceptance item 1 gate and it **fails**: the model (DeepSeek v4.1 Flash) has no image input — `Read` on `figma/*.png` returns "Cannot read image (this model does not support image input)". No vision-capable tool is available. The coder correctly changed nothing and guessed nothing.

This invalidates the iteration-3 design contract's founding assumption (`00-ux-pages.md` § Design contract 2026-10-03: "visual verification is delegated to the coder and reviewer agents (DeepSeek v4.1 Flash — vision capability assumed and proven by TKT-ui-010)"). Reviewer agents are the same model family, so the reviewer-visually-verifies fallback is likewise unproven.

**Impact:** TKT-ui-010 cannot complete; TKT-ui-011 and the P-12 wave (ui-012…019) are blocked transitively.

**Unblocks via a user decision (not an agent call):**
1. Provide a vision-capable model/tool for the coder + reviewers, then re-dispatch; or
2. A human extracts the exact palette/typography from the PNGs and records them in `00-ux-pages.md` § Design contract, converting TKT-ui-010 to a value-application ticket; or
3. Explicitly authorize programmatic-only extraction, accepting that typography and 1:1 visual fidelity cannot be verified — a scope reduction that must be recorded in the plan before dispatch.

Reconciled run artifact: `.pipeline/plan/run-report.md` (iteration-3). No PR was opened; the dead `tkt-ui-010` worktree was removed.
