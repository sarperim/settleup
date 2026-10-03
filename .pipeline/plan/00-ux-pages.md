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
- **Reference handling notes:** (a) `Responsive pair.png` did not survive the copy (only its `Zone.Identifier` stub reached the repo); the pairing is embedded per-screen, so nothing is believed lost — if the standalone file showed anything beyond the per-screen pairs, re-export it. (b) The planner model cannot view images (no vision support); palette/geometry above were extracted programmatically, and **visual verification is delegated to the coder and reviewer agents** (DeepSeek v4.1 Flash — vision capability assumed and proven by TKT-ui-010, the iteration's first ticket, before any page work starts).

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
- **Contains & actions:** The PG-007 form prefilled with the expense's current values; same validation. Editable only by the member who logged the expense (a non-logger never reaches or sees the entry). If amount, participants, or split type change, shares are recomputed; the edited timestamp is recorded. Save and abandon actions; on success return to the group's expenses.
- **MoSCoW:** Must

### PG-009 — Join by code (`/join/:code`)

- **Purpose:** Confirm joining a group whose join code the user holds.
- **Traces to:** UC-GRP-002; FR-GRP-003, FR-GRP-004; BR-GRP-004, BR-GRP-010
- **Domain(s):** Groups & Membership
- **Contains & actions:** The code is resolved and the group's **name** (nothing else) is shown before confirming; confirm action places the join request. States: request pending (awaiting creator approval); request already pending; already a member; code not found; a previously rejected user may re-request. Reached via shared link or via the code entry on PG-005.
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
