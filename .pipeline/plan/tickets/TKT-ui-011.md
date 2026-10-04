# TKT-ui-011: App shell — responsive chrome per the references (PG-001)

- Status: done
- PR: https://github.com/sarperim/settleup/pull/54 (base `dev`, merged — `d834a72`; unblocked via owner Figma PAT / REST API)
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

## Blocker RESOLVED (2026-10-04) — Figma REST API via owner PAT

The Figma MCP read quota is exhausted, but the owner supplied a **Figma Personal Access Token**, stored at **`/tmp/opencode/figma_pat.txt`** (NOT in the repo — do not commit, copy, or echo it into project files). The token authenticates against the **Figma REST API**, which is not subject to the MCP quota — verified by the orchestrator (`GET /v1/me` and `GET /v1/files/XzY4HLCoW70yfI9NgeLXqC/nodes?ids=2:24556` both return data).

Extraction path for the coder:
- `X-Figma-Token: $(tr -d '[:space:]' < /tmp/opencode/figma_pat.txt)`
- Node JSON (geometry, fills, typography, padding, text): `GET https://api.figma.com/v1/files/XzY4HLCoW70yfI9NgeLXqC/nodes?ids=<nodeId>` — read `nodes[<id>].document` (absoluteBoundingBox, fills, fontSize/fontFamily/fontWeight/lineHeight, cornerRadius, itemSpacing, padding*, characters).
- Image/vector export (brand mark): `GET https://api.figma.com/v1/images/XzY4HLCoW70yfI9NgeLXqC?ids=<nodeId>&format=svg|png&scale=2` returns asset URLs.

**Unblocks:** TKT-ui-011 (this ticket) and TKT-ui-014…019 (each can extract its board the same way). The prior MCP-quota blocker is closed.

## Implementation (2026-10-04) — PR #54

Extracted the four "Top bar" frames via the Figma REST API and landed the
chrome in the two scoped files. Measurements taken programmatically at the
acceptance viewports (`header.getBoundingClientRect`):

| Viewport / variant | Design | Landed |
|---|---|---|
| Desktop 1230 (both variants) | 72px, pad 32px, mark 30px, name 23/700, nav gap 22, pill 34px | 72 / 32 / 30 / 23-700 / 22 / 34 |
| Mobile 390 authenticated | 94px, pad 18×14, mark 27px, name 20/700, nav gap 16, pill 29px | 94 / 18×14 / 27 / 20-700 / 16 / 29 |
| Mobile 390 anonymous | 81px, single 16px nav row | 81 / 16 |

- Display name sits on the brand row (top-right) on mobile and at the start of
  the right-hand nav group on desktop, per the references; never an email.
- Nav weights per the frozen frames: auth Groups 600 / Change password 400 /
  user 700 / Log out 700; anon current link 700 / other 600.
- No horizontal scroll at 390px (`scrollWidth === clientWidth === 390`).
- Colours resolve only through `tokens.css` (`design-tokens.spec.ts` green).

Only `apps/web/src/layout/RootLayout.tsx` + `RootLayout.css` changed; no spec,
route, page, token, or `figma/` file touched.

**Evidence:** web-unit 92/92; unit+web-unit 195/195; typecheck clean; eslint
clean; build 92.81 KB gz JS / 4.19 KB gz CSS. Integration + Playwright e2e
cannot run in this environment (no PostgreSQL) — pre-existing baseline.
Before/after screenshots: evidence-only branch `tkt-ui-011-screenshots`,
embedded in PR #54.

**Flagged:** (1) reference font families (Nunito Sans/Inter) remain the waived
shipped pairing (TKT-ui-010 E1); (2) the brand mark is a plain solid circle per
the export, implemented as CSS (no asset file); (3) the reference shows no
route-active nav pill, so the previous `.active` pill styling was removed — no
test asserts it.
