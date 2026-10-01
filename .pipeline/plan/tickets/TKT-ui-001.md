# TKT-ui-001: Design system, global styles & app shell

- Status: in-review
- PR: https://github.com/sarperim/settleup/pull/38
- Size: M
- Scope:
  - Create: `apps/web/src/styles/tokens.css` (design tokens as CSS custom properties), `apps/web/src/styles/base.css` (element defaults + shared component classes: buttons, form controls, lists, cards, alerts), `apps/web/src/styles/fonts.css` (self-hosted font pairing), `apps/web/src/layout/RootLayout.css` (colocated shell styles)
  - Modify: `apps/web/src/main.tsx` (single import of the stylesheets), `apps/web/src/layout/RootLayout.tsx` (apply shell classes — no functional changes), `apps/web/index.html` (font preload/resource hints if needed), `apps/web/package.json` + root `pnpm-lock.yaml` (self-hosting font packages only, e.g. `@fontsource/*` — CSS + font assets, no runtime JS)
  - Must NOT touch: `apps/web/src/pages/**` (page styling belongs to later tickets), `apps/web/src/api/**`, `apps/web/src/auth/**`, `apps/web/src/routes.ts` (route table frozen by arch 03 §6), `apps/api/**`, `packages/shared/**`, existing spec files
- Traces to: PG-001 (and the token foundation for PG-002…PG-009); no FR — foundation work for the UI/UX iteration
- Acceptance (explicit criteria — foundation, no TCs):
  1. Tokens pin the approved design direction (`00-ux-pages.md` § Design direction): light-beige base surfaces, pastel-red accent family for the nav bar, and a warm font pairing selected to fit — as named CSS custom properties in `tokens.css`, consumed by `base.css` and `RootLayout.css`; no hard-coded color or font values outside `tokens.css`
  2. The styled app shell renders on every route with unchanged function: brand, acting user's display name (never email), Groups + Change-password navigation, logout, anonymous Log-in / Create-account links (PG-001)
  3. All existing suites pass unmodified under the established root scripts (`pnpm test`, `pnpm test:e2e`) — no testid, role, label, or text-assertion changes anywhere in this ticket
  4. Production build initial bundle ≤ 300 KB gzipped (NFR-ACC-003 / SC-004), fonts served same-origin (helmet CSP, arch 01 §8.2); no remote font CDN; no new runtime JavaScript dependencies
  5. Styling convention pinned for later page tickets: global tokens + shared classes live in `styles/`; page-specific CSS is colocated with its page component
- Architecture refs: 01-system-architecture.md §2 C1 (SPA responsibilities), §7 NFR-ACC-003 row (bundle ≤ 300 KB gzipped), §8.2 (helmet CSP, self-origin only)
- UX refs: PG-001; `00-ux-pages.md` § Design direction (2026-10-01)
- Dependencies: none (iteration-1 board complete — 34/34 tickets done)
- Parallel group: none — this is the UI/UX iteration's foundation; every page ticket depends on it
