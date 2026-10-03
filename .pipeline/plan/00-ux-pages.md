# UX Page Plan — Settle Up

Status: approved at Gate 1 (2026-10-01) · amended 2026-10-03 (§ Design contract — Figma reference screens, iteration 3) · Date: 2026-10-01
Inputs: `.pipeline/00-project-brief.md`, `.pipeline/analysis/*.md` (4 domain reports), `.pipeline/architecture/01-system-architecture.md` §2 C1, `.pipeline/architecture/03-api-design.md` §6 (SPA route table).

Total: **9 entries** (8 route pages + 1 app-shell layout region).

## Provenance and relationship to the architecture

Iteration 1 shipped the app functionally complete but visually unstyled — no UX page plan existed; the page inventory was pinned structurally by `03-api-design.md` §6 (SPA route table). This plan retroactively formalizes that inventory as the UX source of truth and adds the page-level structure (content, actions, states) that §6 does not carry. Routes are **frozen** by the architecture: every PG entry below maps 1:1 onto a §6 route (plus the shell), and no entry in this plan requires a route-table change.

**This plan is structure only** — page name, purpose, content, actions. No layout, components, styling, or copy. Whatever an entry does not pin is not free choice at implementation time: the coder builds it minimally and unopinionated. UI decisions made later flow back here as amendments, and affected tickets are re-validated.

**Defect found while deriving (flow-back):** UC-GRP-002 step 1 offers two entry paths — "by opening the link **or entering the code**". Only the link path exists today: `/join/:code` is reachable solely via a shared link; no code-entry surface exists anywhere in the UI. This plan closes the gap structurally by adding a join-by-code entry action to PG-005 (Groups overview) that navigates to the existing `/join/:code` route — **no route-table change, no architecture amendment**. It generates an implementation ticket in the UI/UX iteration.

## Design direction (user decision, 2026-10-01)

Recorded at Gate 1 approval — the visual contract input for the UI/UX iteration. The user's brief:

- **Overall:** light beige base design.
- **Nav bar:** pastel colors, preferably red.
- **Typography:** fonts selected to fit that palette — selection delegated to the implementation within this direction.

This section records **direction, not specifics**. Exact tokens (hex values, typefaces, spacing scale) are pinned once by the design-system foundation ticket (TKT-ui-001) and flow back here as an amendment recording the final choices. Constraints that shape any implementation of this direction (from the architecture, not taste): fonts must be **self-hosted / same-origin** (helmet CSP, arch 01 §8.2 — no remote font CDNs), and the SPA initial bundle stays **≤ 300 KB gzipped** (NFR-ACC-003 / SC-004) — no heavyweight UI frameworks.

#### Pinned specifics — TKT-ui-001, 2026-10-01

Amended on landing the design-system foundation. The approved direction above is now implemented as concrete choices, recorded here so every page ticket builds on one palette and type scale:

- **Base surfaces:** light beige — page `#f7f2e9`, raised/card `#fffdf8`, sunken `#efe7d8`, borders `#e3d8c6` / `#cdbca2`.
- **Text:** warm browns — `#3d3630` body, `#7c6f60` muted.
- **Accent (pastel red) family:** `#e59a9d` base, `#d97c80` strong/hover, `#f8e2e3` soft. **Nav bar** uses `#edb6b6` with `#45292b` text and `#d97c80` for the active item.
- **Status:** danger `#c25b55`, success `#5f8f6f`, focus `#b5565a`.
- **Typography (warm pairing):** **Fraunces** (variable display serif) for headings, **Nunito** (variable humanist sans) for body, packaged self-hosted via `@fontsource-variable/*` (CSS + woff2 only; no runtime JS, no remote CDN).
- **Styling convention for all later page tickets:** design tokens live in `apps/web/src/styles/tokens.css` (the single source of colour/font values); global element defaults and shared classes (`.card`, `.alert`, `.list`, `.btn` + modifiers, `.muted`, `.stack`, `.row`) live in `apps/web/src/styles/base.css`; the app-shell styles live in `apps/web/src/layout/RootLayout.css`; **page-specific CSS is colocated with its page component** and must consume the tokens via `var(--…)` — no hard-coded colour or font values outside `tokens.css`.
- **Verified budget:** production SPA initial bundle **91.5 KB gzipped** (≤ 300 KB, NFR-ACC-003).

## Design contract — Figma reference screens, 1:1 (user decision, 2026-10-03)

Recorded at iteration-3 intake. The user exported the Figma designs as PNGs into `figma/` (8 files, one per route screen) with the instruction **"i want 1 to 1 screens"** — the contract is pixel-faithful reproduction of the references, not direction-following.

- **Each PNG is a responsive pair** (verified programmatically — see the vision note below): a left panel ~1230 CSS px wide (desktop layout) and a right panel 390 CSS px wide (mobile layout), separated by a transparent gutter. **Acceptance viewports: 1230px and 390px.**
- **Reference → page mapping:** `login.png` → PG-002 · `createaccount.png` → PG-003 · `changeaccount.png` → PG-004 · `groups.png` → PG-005 · `groupview.png` → PG-006 · `addexpense.png` → PG-007 · `editexpense.png` → PG-008 · `joinbycode.png` → PG-009. PG-001 (app shell) is the chrome visible in every reference screen.
- **Palette family** (sampled from the PNGs): consistent with the recorded direction — warm cream surfaces, pastel-red accents, warm brown text. Exact token values are re-pinned by the iteration-3 foundation ticket (TKT-ui-010) and flow back here as an amendment, mirroring the TKT-ui-001 pattern.
- **Structural freeze:** the PG entries below remain the structural contract — content, actions, states. If a reference deviates structurally (shows content or actions a PG entry does not pin, or omits pinned ones), the coder **stops** and it flows back through the user as a plan amendment before that page's work continues. A restyle must not drop or invent functionality.
- **New capability — mobile layouts:** the current implementation is desktop-shaped; this iteration adds the 390px layout per each reference's right panel. No route changes, no architecture amendment.
- **Reference handling notes:** (a) `Responsive pair.png` did not survive the copy (only its `Zone.Identifier` stub reached the repo); the pairing is embedded per-screen, so nothing is believed lost — if the standalone file showed anything beyond the per-screen pairs, re-export it. (b) The planner model cannot view images (no vision support); palette/geometry above were extracted programmatically.

#### Figma source of truth (MCP-connected, 2026-10-03)

The design file is connected to the pipeline via the Figma MCP server (user-level opencode config — every pipeline agent: coder, reviewers, orchestrator, inherits access). The MCP is the **primary design source**; the committed PNGs remain the **frozen acceptance snapshots** (a live Figma file can drift mid-PR; reviews verify against the pinned snapshot, and an intentional mid-iteration design change re-freezes it via the user).

- **File:** `settleup` — key `XzY4HLCoW70yfI9NgeLXqC`, single page "Page 1" (`0:1`). Eight numbered board frames, one per screen, stacked vertically at x = −871.
- **Board map (node IDs):**

| Screen | PG | Board frame | Desktop layout (1230px) | Mobile layout (390px) | PNG snapshot |
|---|---|---|---|---|---|
| 01 Login | PG-002 | `2:24021` | `2:24031` | `2:24075` | `figma/login.png` |
| 02 Create Account | PG-003 | `2:24111` | `2:24121` | `2:24185` | `figma/createaccount.png` |
| 03 Change Password | PG-004 | `2:24231` | `2:24241` | `2:24289` | `figma/changeaccount.png` |
| 04 Groups | PG-005 | `2:24328` | `2:24338` | `2:24445` | `figma/groups.png` |
| 05 Group View | PG-006 | `2:24545` | `2:24555` | `2:24878` | `figma/groupview.png` |
| 06 Add Expense | PG-007 | `2:25203` | `2:25213` | `2:25401` | `figma/addexpense.png` |
| 07 Edit Expense | PG-008 | `2:25583` | `2:25593` | `2:25793` | `figma/editexpense.png` |
| 08 Join by Code | PG-009 | `2:25987` | `2:25997` | `2:26087` | `figma/joinbycode.png` |

  PG-001 (app shell) is the "Top bar" frame inside every board (desktop: 72px; mobile: 81px on boards 01–02 — anonymous nav — vs 94px on boards 03–08 — authenticated nav; matches PG-001's nav sets).
- **No Figma variables or styles exist** on the design (variable defs returned empty, 2026-10-03). Exact token values are extracted from `get_design_context` output — the reference code carries fills, typography, and layout as text.
- **Board chrome is scaffolding, not app UI:** each board's "Board heading" (screen number, title, subtitle, responsive label) and the small state labels above state cards document the design — they are NOT implemented. The implementation targets are the **Desktop layout** and **Mobile layout** frames.
- **State catalogs:** several boards lay out multiple UI states side by side (board 08's request-state grid of five cards; board 07's prefilled/exact-split columns; permission-denied cards). Each card is one state the app renders at the right moment — never all states on one page.
- **Workflow per screen:** `get_design_context` on the Desktop and Mobile layout nodes (reference code + assets) → implement → verify against `get_screenshot` renders and the frozen PNG snapshot. Structural deltas discovered in a board flow back per the freeze rule above.

#### Pinned specifics — TKT-ui-010, 2026-10-03

Recorded on landing the iteration-3 foundation (reference-driven token refresh & shared styles). The exact values below are extracted from `get_design_context` output — file key `XzY4HLCoW70yfI9NgeLXqC`, desktop-layout nodes of boards 01/04/05/06/08 (`2:24031`, `2:24338`, `2:24555`, `2:25213`, `2:25997`). They supersede the TKT-ui-001 pinned values above wherever the two differ. Single source: `apps/web/src/styles/tokens.css`.

- **Surfaces (warm cream):** page `#fcf8f2`, raised/card `#fffdfc`, sunken `#f7eee5`, borders `#ddd0c5` / `#c9b7aa`.
- **Text:** warm browns — `#3d302b` body/headings, `#786a62` muted.
- **Accent (pastel-red) family:** base/nav `#efa6a0`, strong (primary buttons, links, active, breadcrumb) `#9d493f`, strong-hover (`#853b33` — the primary button/link pointer state, derived from the strong value, not a static fill in the sampled text), soft (chips, icon backgrounds) `#f6d7d2`, on-accent (text on the strong accent surface) `#fffdfc`; nav text `#6b3832`.
- **Status:** success `#31705a` / soft `#e2f1e9` (positive balance `#25634f`), danger `#b23e3e` / soft `#fbe7e4` (negative balance `#a74642`), **warning `#99611c` / soft `#fff0d2`** (new — rate-limit and pending/rejected states), focus `#9d493f`; on-danger `#fffdfc` (was `#fffaf6`).
- **Nav active pair (inverted):** `--color-nav-active-bg` `#fffdfc` (cream pill on the red nav — was `#d97c80`), `--color-nav-active-text` `#6b3832` (warm brown — was `#fffaf6`); a visible change consumed by the unmodified `layout/RootLayout.css`.
- **Radii / shadow:** cards `18px`, controls `12px`, small `8px`; card shadow `0 8px 24px rgba(107,56,50,0.08)`, small shadow `0 1px 2px rgba(107,56,50,0.08)`.
- **Shared classes restyled to the references:** `.card`, `.alert` (+ `--success` / `--warning` / `--info`), `.list`, `.btn` + `.btn--secondary` / `.btn--danger`, `.muted`, `.stack`, `.row`. Page tickets consume the tokens via `var(--…)`; page-specific CSS stays colocated (`PG-002…PG-009`).
- **Contract spec (sanctioned):** the stylesheet-level acceptance items 2, 3, 5 and 6 are pinned by `apps/web/src/styles/design-tokens.spec.ts` — a **new** DOM-free spec that reads the stylesheets as text. Adding a new spec is not an edit to an existing spec (the ticket's must-not-touch forbids editing *existing* specs), and the pipeline's TC-coverage rule requires the explicit acceptance items to be automated; this note sanctions the spec's file path. (Declaring it in the ticket's `Modify` list remains a planner scope follow-up.)
- **Third supporting color (iteration-2 open item) — answer: absent.** The references carry only the cream/brown/red-accent palette plus *semantic* status colours (green success, amber warning, red danger) and multi-hue per-member avatars (decorative). No third *supporting/brand* colour beyond the pastel-red family is present, so none was invented. The owner request is **not** closed by this iteration; it remains an open user decision.
- **Typography — flagged, not yet landed.** The references use **Nunito Sans** (headings/brand) and **Inter** (body/UI) — a different family pairing from the shipped **Fraunces + Nunito** (TKT-ui-001) — at a 30/22/17/15/13/11px scale with 400/500/600/700 weights. Landing the family swap requires the `@fontsource-variable/nunito-sans` and `@fontsource-variable/inter` packages (`package.json` + `pnpm-lock.yaml`), which are outside TKT-ui-010's file scope (TKT-ui-001 explicitly listed those files; this ticket does not). Font tokens and `fonts.css` are therefore unchanged pending a user/planner dependency decision; `--font-size-*` / weights remain the TKT-ui-001 scale.
- **Verified:** production SPA initial bundle **92.67 KB gzipped** (≤ 300 KB, NFR-ACC-003); fonts self-hosted same-origin (no remote URL; helmet CSP, arch 01 §8.2).

**Design-pinned structural additions (flow-back, pending user confirmation 2026-10-03):** the boards add three structural elements the PG entries did not pin — (a) PG-008: a breadcrumb (group / expense / edit) above the form; (b) PG-008: a logger-only **permission-denied state card** — the design presents denial as an in-page state (badge + message) rather than a redirect; (c) PG-009: a privacy note beneath the join card. Recorded in the PG entries below as iteration-3 additions; further deltas discovered during implementation flow back the same way.

## Pages

### PG-001 — App shell (layout region, not a route)

- **Purpose:** Persistent chrome around every route: identifies the app, identifies the signed-in user, and hosts logout and primary navigation.
- **Traces to:** UC-ACC-003, FR-ACC-005, FR-ACC-008; UC-ACC-006 (guard behavior renders through it)
- **Domain(s):** Accounts & Access (cross-page)
- **Contains & actions:** App name. When authenticated: the acting user's **display name** (never email), navigation to groups overview (PG-005) and change password (PG-004), and a logout action that ends the session and returns to login (PG-002). When anonymous: navigation to login and register only.
- **MoSCoW:** Must

### PG-002 — Login (`/login`)

- **Purpose:** Establish an authenticated session with email + password.
- **Traces to:** UC-ACC-002, UC-ACC-006 (redirect target), FR-ACC-003, FR-ACC-004
- **Domain(s):** Accounts & Access
- **Contains & actions:** Email and password inputs; submit. Error state: credentials do not match (no session). Throttled state: login temporarily blocked (429 `TOO_MANY_ATTEMPTS` contract, arch 01 §8.2). Link to register (PG-003). On success: session established, user taken to groups overview (PG-005).
- **MoSCoW:** Must

### PG-003 — Register (`/register`)

- **Purpose:** Create an account (email + password + display name) and be signed in immediately.
- **Traces to:** UC-ACC-001, FR-ACC-001, FR-ACC-002, FR-ACC-010
- **Domain(s):** Accounts & Access
- **Contains & actions:** Email, password, and display-name inputs; submit. Error states: email already taken; invalid input. On success: session established without a separate login, user taken to groups overview (PG-005).
- **MoSCoW:** Must

### PG-004 — Change password (`/change-password`)

- **Purpose:** Replace the signed-in user's own password.
- **Traces to:** UC-ACC-004, FR-ACC-006, FR-ACC-007, ASM-003
- **Domain(s):** Accounts & Access
- **Contains & actions:** Current-password and new-password inputs; submit. Error state: current password incorrect (password unchanged). Success confirmation; other sessions are invalidated (D-ARCH-002), the acting session survives.
- **MoSCoW:** Must

### PG-005 — Groups overview (`/`)

- **Purpose:** The signed-in user's home: their groups, and the entries into creating and joining groups.
- **Traces to:** UC-ACC-002 (step 3), UC-GRP-001, UC-GRP-002 (code entry), FR-GRP-001, FR-GRP-002, FR-GRP-003, FR-GRP-009
- **Domain(s):** Groups & Membership
- **Contains & actions:** The user's list of groups (each opens the group view, PG-006); empty state when a member of no groups. Create-group action with a group-name input (error state: invalid name); on success the creator lands on the new group's view, where its join code is shown. **Join-by-code entry (new — closes the UC-GRP-002 gap):** a code input that takes the user to the join confirmation page (PG-009) for the entered code.
- **MoSCoW:** Must

### PG-006 — Group view (`/groups/:groupId`)

- **Purpose:** The working surface of one group: its ledger, balances, settle-up plan, and members — plus the creator's membership gatekeeping.
- **Traces to:** UC-GRP-003, UC-GRP-004, UC-GRP-005, UC-EXP-004, UC-BAL-001, UC-BAL-002, UC-BAL-003, UC-BAL-004; FR-GRP-002, FR-GRP-005, FR-GRP-006, FR-GRP-007, FR-GRP-010, FR-EXP-011, FR-BAL-001, FR-BAL-004, FR-BAL-006
- **Domain(s):** Groups & Membership · Expense Tracking · Balances & Settlement
- **Contains & actions:**
  - Header region: group name; the group's join code, visible to the creator only, with a copy affordance.
  - **Expenses section:** the group's expenses (description, amount, payer, participants, created/edited timestamps); entry to add an expense (PG-007); per-expense edit (PG-008) and delete actions, shown only to the member who logged that expense; empty state.
  - **Balances section:** every member's running per-group balance by display name (signed; positive = owed, negative = owing) and the visible zero-sum total.
  - **Settle-up section:** outstanding suggestions (who pays whom, how much — minimum-payment plan), each with a mark-paid action shown only to that payment's payer or recipient; the settled-payment list with party-only undo; undone entries labelled; nothing-owed state.
  - **Members section:** all members by display name (never email) with the creator marked.
  - **Join-requests region (creator only):** pending join requests by display name, each with approve and reject actions; empty state.
  - Loading and error states per section; a non-member never sees any of this (existence-hiding, UC-GRP-006).
- **MoSCoW:** Must

### PG-007 — Add expense (`/groups/:groupId/expenses/new`)

- **Purpose:** Log a shared expense in ≤ 30 seconds (SC-003): the common case is description + amount + submit.
- **Traces to:** UC-EXP-001; FR-EXP-001…FR-EXP-007; NFR-EXP-001
- **Domain(s):** Expense Tracking
- **Contains & actions:** Single screen: short description; amount in TRY; payer selection (defaults to the acting user); participant selection (defaults to all members); split-type choice — equal or exact; per-participant amount inputs when exact. Client-side validation with inline errors, no round-trips until submit (error states: no participants, invalid amount, exact-sum mismatch). On success: return to the group's expenses with the new expense shown.
- **MoSCoW:** Must

### PG-008 — Edit expense (`/groups/:groupId/expenses/:expenseId/edit`)

- **Purpose:** Change an expense the acting user logged (logger-only).
- **Traces to:** UC-EXP-002; FR-EXP-006, FR-EXP-008
- **Domain(s):** Expense Tracking
- **Contains & actions:** The PG-007 form prefilled with the expense's current values; same validation. Editable only by the member who logged the expense (a non-logger never reaches or sees the entry). If amount, participants, or split type change, shares are recomputed; the edited timestamp is recorded. Save and abandon actions; on success return to the group's expenses. *Iteration-3 design-pinned additions:* a breadcrumb (group / expense / edit) above the form; a logger-only permission-denied state card (in-page badge + message, not a redirect) for a non-logger arriving at the edit route.
- **MoSCoW:** Must

### PG-009 — Join by code (`/join/:code`)

- **Purpose:** Confirm joining a group whose join code the user holds.
- **Traces to:** UC-GRP-002; FR-GRP-003, FR-GRP-004; BR-GRP-004, BR-GRP-010
- **Domain(s):** Groups & Membership
- **Contains & actions:** The code is resolved and the group's **name** (nothing else) is shown before confirming; confirm action places the join request. States: request pending (awaiting creator approval); request already pending; already a member; code not found; a previously rejected user may re-request. Reached via shared link or via the code entry on PG-005. *Iteration-3 design-pinned addition:* a privacy note beneath the join card (existence-hiding reminder).
- **MoSCoW:** Must

## Coverage check — both directions

Every user-facing UC lands on ≥ 1 page; every page traces to ≥ 1 UC.

| UC | Page(s) |
|---|---|
| UC-ACC-001 Register | PG-003 |
| UC-ACC-002 Log in | PG-002 (→ PG-005 step 3) |
| UC-ACC-003 Log out | PG-001 (shell action) |
| UC-ACC-004 Change password | PG-004 |
| UC-ACC-005 Manual reset | **No page — by design** (out-of-app owner runbook, arch 01 §10; OQ-ACC-001 decided) |
| UC-ACC-006 Anonymous access | **Behavior, not a page** — guard redirects to PG-002 |
| UC-GRP-001 Create group | PG-005 (create action; join code surfaces on PG-006) |
| UC-GRP-002 Join by code | PG-009 + PG-005 (code entry) |
| UC-GRP-003 Approve request | PG-006 (join-requests region) |
| UC-GRP-004 Reject request | PG-006 (join-requests region) |
| UC-GRP-005 View members | PG-006 (members section) |
| UC-GRP-006 Non-member denial | **Behavior, not a page** — error/empty states on PG-006…008; API 404 |
| UC-EXP-001 Log expense | PG-007 |
| UC-EXP-002 Edit expense | PG-008 |
| UC-EXP-003 Delete expense | PG-006 (action in expenses section — no dedicated page) |
| UC-EXP-004 View expenses | PG-006 (expenses section) |
| UC-BAL-001 View balances | PG-006 (balances section) |
| UC-BAL-002 View suggestions | PG-006 (settle-up section) |
| UC-BAL-003 Mark paid | PG-006 (action in settle-up section) |
| UC-BAL-004 Undo settlement | PG-006 (action in settle-up section) |

Gaps found and closed: one — the UC-GRP-002 code-entry surface (see Provenance). No page exists without a UC; no new pages beyond the §6 routes are proposed, because every UC already lands.
