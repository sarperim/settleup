# TKT-ui-010: Iteration-3 foundation — reference-driven token refresh & shared styles

- Status: todo
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
