# System Architecture — Settle Up

Status: ready for review · Date: 2026-09-25 · Amended: 2026-09-25 (test-planner G-1 resolution + Gate 2 decisions — see §11)
Inputs: `.pipeline/00-project-brief.md`, `.pipeline/analysis/00-domain-map.md`, `.pipeline/analysis/{accounts-access,groups-membership,expense-tracking,balances-settlement}.md`

## 0. Architecture-gate decisions (user, 2026-09-25)

| ID | Decision |
|----|----------|
| **D-ARCH-001** | Stack: **NestJS (TypeScript) API + React (TypeScript) SPA** (brief §7 backend choice resolved → NestJS). |
| **D-ARCH-002** | Password change **invalidates all other sessions**; the current session survives (resolves OQ-ACC-003). |
| **D-ARCH-003** | Password policy: **min 8 characters, max 128, no composition rules** (resolves OQ-ACC-005). |
| **D-ARCH-004** | **Fully derived ledger state**: balances and outstanding suggestions are computed on demand from stored facts; nothing is materialized (resolves the storage question the Balances report deferred to architecture). |

User-delegated decisions made here (see §4 for rationale + rejected alternatives): pnpm-workspace monorepo, Prisma ORM, Vitest + Playwright, Docker Compose deployment. User-requested addition: CI design in `04-ci-pipeline.md`.

## 1. Architecture overview

Settle Up is a **modular monolith**: one NestJS application, one PostgreSQL database, one React SPA served by the API from the same origin. There is exactly one deployable artifact.

```
                 ┌─────────────────────────────────────────────┐
                 │            Browser (web only)               │
                 │   React SPA  (apps/web, Vite build)         │
                 └────────────────────┬────────────────────────┘
                                      │ HTTPS, same origin
                 ┌────────────────────▼────────────────────────┐
                 │   Caddy reverse proxy (automatic TLS)       │
                 └────────────────────┬────────────────────────┘
                                      │
┌─────────────────────────────────────▼─────────────────────────────────────┐
│  API application — NestJS modular monolith (apps/api), Node.js LTS        │
│                                                                           │
│   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌────────────┐                   │
│   │  Auth   │  │ Groups  │  │ Ledger  │  │ Settlement │                   │
│   │ module  │  │ module  │  │ module  │  │   module   │                   │
│   └────┬────┘  └────┬────┘  └────┬────┘  └─────┬──────┘                   │
│        └────────────┴────────────┴─────────────┘                          │
│   Cross-cutting: AuthGuard · GroupMemberGuard · GroupCreatorGuard ·        │
│   exception filter (error contract) · config validation · pino logging    │
│                                                                           │
│   Prisma ORM ────────────────────────────►  PostgreSQL 16+ (single DB)    │
└───────────────────────────────────────────────────────────────────────────┘
```

**Why a monolith (rejected: microservices / separate services).** ~8 registered users, ≤ ~5 concurrent groups, one owner, near-free hosting (brief §7). Any network boundary between domains would add deployment surface, latency, and failure modes with zero benefit at this scale. Domain boundaries are preserved *inside* the monolith as NestJS modules with strict ownership rules (§3), so the design stays refactorable.

**Why SPA + JSON API (rejected: server-rendered Razor/JSP-style pages).** The add-expense form needs real interactivity (participant checkboxes, split-type toggle, per-participant amount inputs, live validation — SC-003 ≤ 30 s), and a JSON API gives the acceptance-test-heavy success criteria (SC-002, SC-005, SC-006, SC-007) a crisp, stable test surface. Serving the built SPA as static files from the API keeps a single origin (no CORS, one artifact).

### Repository layout (pnpm-workspace monorepo)

```
settleup/
├── package.json               # root: workspace scripts (lint, typecheck, test, build)
├── pnpm-workspace.yaml        # packages: ['apps/*', 'packages/*']
├── .github/workflows/ci.yml   # see 04-ci-pipeline.md
├── apps/
│   ├── api/                   # NestJS app + Prisma schema (prisma/schema.prisma)
│   └── web/                   # React SPA (Vite)
└── packages/
    └── shared/                # money (kuruş) types & helpers, DTO types, constants
```

## 2. Components

| # | Component | Responsibility | Boundaries |
|---|-----------|----------------|------------|
| C1 | **Web SPA** (`apps/web`) | All user-facing flows: register/login/logout, change password, groups overview, group view (expenses / balances / settle-up / members tabs), add/edit expense form, join-by-code flow. | Talks only to the JSON API (`/api/*`). No direct DB access. Renders display names, never emails. |
| C2 | **Auth module** (`apps/api`, Accounts & Access) | Registration (opens session), login, logout, session lifecycle, password change (invalidates other sessions). Owns `User`, `Session`. Provides `AuthGuard` (global) and the acting-user context. | Only module that writes `users` / `sessions`. Exposes `UsersService` read API (id → displayName) to other modules. |
| C3 | **Groups module** (`apps/api`, Groups & Membership) | Group creation (join-code generation), join-by-code requests, approve/reject, membership, member lists. Owns `Group`, `JoinRequest`, `Membership`. Provides `GroupMemberGuard` and `GroupCreatorGuard` used by all group-scoped routes. | Only module that writes groups/memberships/join requests. Read model returns display names only. |
| C4 | **Ledger module** (`apps/api`, Expense Tracking) | Expense create/edit/delete (logger-only), split engine: equal split with ASM-001 random-spread remainder, exact split with sum validation, share persistence, timestamps. Owns `Expense`, `ExpenseShare`. | Only module that writes expenses/shares. Settlement reads them via the `LedgerReadService`. |
| C5 | **Settlement module** (`apps/api`, Balances & Settlement) | Balance engine (derived per-group balances), suggestion engine (minimum-transaction plan, deterministic), mark-paid / undo of settlement facts. Owns `SettledPayment`. `MemberBalance` is **derived, not stored** (D-ARCH-004). | Reads expenses/shares via `LedgerReadService`; never writes them. Only module that writes `settled_payments`. |
| C6 | **Shared package** (`packages/shared`) | `Kurus` branded type + parse/format/validation helpers, DTO TypeScript types, constants (field limits). | Pure code, no I/O; imported by api and web. Single source of truth for money rules (ASM-002). |
| C7 | **PostgreSQL** | Single database, all persisted facts. | Accessed only via Prisma from `apps/api`. |

### Domain → component mapping (explicit, per 00-domain-map.md)

| Domain (domain map) | Implementing components |
|---|---|
| Accounts & Access | C2 Auth module; UI in C1 (login/register/change-password pages); `User`/`Session` in C7 |
| Groups & Membership | C3 Groups module; UI in C1; `Group`/`JoinRequest`/`Membership` in C7; privacy rule operationalized by `GroupMemberGuard` (C3) applied to all group-scoped routes of C4/C5 |
| Expense Tracking | C4 Ledger module; UI in C1 (expense pages/form); `Expense`/`ExpenseShare` in C7 |
| Balances & Settlement | C5 Settlement module; UI in C1 (balances + settle-up views); `SettledPayment` in C7; `MemberBalance` derived by C5 from C4's shares + C5's settled payments |
| (cross-cutting) Privacy OBJ-005 | Not a domain (per domain map note): enforced via C2 `AuthGuard` + C3 `GroupMemberGuard` on every group-scoped endpoint of C3/C4/C5 |

## 3. Module interaction rules

1. **One writer per table.** Each table has exactly one owning module (see 02-data-model.md §6). Cross-module writes are forbidden; cross-module reads go through the owning module's exported service (`UsersService`, `LedgerReadService`, `MembershipService`).
2. **Guards before controllers.** Global `AuthGuard` (everything except `/api/auth/register`, `/api/auth/login`) implements FR-ACC-009. `GroupMemberGuard` on every `/api/groups/:groupId/...` route implements FR-GRP-008 / SC-006; non-members receive 404 (existence-hiding, §8.3).
3. **Pure engines.** Split engine (C4) and suggestion engine (C5) are pure functions (input → output, no DB), unit/property-testable in isolation. Randomness for ASM-001 comes from an injectable CSPRNG source.
4. **Facts only.** The database stores facts (users, sessions, groups, memberships, join requests, expenses, shares, settled payments). Everything monetary beyond facts — balances, outstanding suggestions — is derived (D-ARCH-004).

## 4. Technology stack

| Concern | Choice | Why | Rejected alternative — why |
|---|---|---|---|
| Runtime | Node.js 24 LTS | Active LTS at build time; required by NestJS/Vite ecosystem; small footprint. | Bun/Deno — faster but thinner ecosystem maturity for NestJS. |
| Language | TypeScript (strict), one language across stack | Single maintainer + agent-driven pipeline: one set of types (`packages/shared`) shared by API and SPA eliminates drift. | JS without types — rejected: kuruş-exact invariants (OBJ-004) demand compiler support. |
| Backend framework | **NestJS** | User decision D-ARCH-001. Modular structure maps 1:1 onto domain modules; guards/pipes/exception filters give declarative cross-cutting concerns; mainstream and well-documented. | ASP.NET Core — user-considered (Q1-B/C): native `decimal` is its edge, mitigated below; rejected for two-language stack and weaker fit with the JSON-API test contract. |
| Frontend | React 19 + Vite SPA | User decision D-ARCH-001. Interactive expense form (SC-003); Vite = fast, simple builds. | Next.js — rejected: no SSR/SEO need for a private app; adds a server framework. Server-rendered pages — rejected: form interactivity and API-level acceptance tests suffer. |
| Monorepo | **pnpm workspaces** (user-delegated) | 3 packages need no task graph; pnpm gives strict dependency handling, fast installs, workspace protocol; root scripts (`pnpm lint/test/build`) drive CI cleanly. | Nx / Turborepo — rejected: caching/task orchestration is waste at this size. npm workspaces — rejected: slower installs, weaker workspace-linking controls. |
| ORM | **Prisma** (user-delegated) | Declarative schema = the data model doc is executable; generated fully-typed client catches query errors at compile time; first-class migrations (`prisma migrate`) for a first-time maintainer. | TypeORM — rejected: patchy maintenance history, subtle query pitfalls. Drizzle — viable (SQL-first, light), rejected: Prisma's schema+migration+client DX is stronger for a solo first-time operator. Kysely — rejected: query builder, no migration story. |
| Database | PostgreSQL 16+ (17 in CI/compose) | Brief constraint §7. | None — constrained. |
| Money representation | **Integer kuruş** (`Int` columns, branded `Kurus` type in shared) | Exact integer arithmetic makes OBJ-004 drift-free *by construction*; Postgres `SUM(int)` → bigint; JS values ≪ 2^53. | Postgres `numeric` + JS number — rejected: re-introduces float parsing at every boundary; app-level decimal libs — rejected: extra dependency for what integers already give. |
| Sessions | Server-side `sessions` table + HttpOnly cookie holding a 256-bit random token (stored hashed, SHA-256) | Logout (FR-ACC-005) and password-change invalidation (D-ARCH-002) require server-side revocation. | Stateless JWT — rejected: cannot revoke without a denylist, i.e. server state anyway. |
| Password hashing | **Argon2id**, OWASP params m=19456 KiB, t=2, p=1 | NFR-ACC-001 asks for protected, non-recoverable storage; Argon2id is the current standard, memory-hard. | bcrypt — acceptable but older design; Argon2id preferred, no downside in Node. |
| Auth cookie | `settleup_session`, HttpOnly, Secure, SameSite=Lax, 30-day sliding expiry | Revocable, no JS access, CSRF-resistant baseline (§8.2). | localStorage token — rejected: XSS-stealable, no revocation. |
| Tests | Vitest (unit/integration) + Playwright (E2E) | One fast runner across all packages; Playwright drives the real browser for SC-003/SC-004/SC-007. | Jest — rejected: slower, CJS friction in a pnpm/Vite monorepo. Cypress — rejected: heavier, single-browser context model. |
| Logging | pino (structured JSON, request ids) | Cheap, unattended-friendly (brief §4 owner persona); greppable/machine-readable. | console.log — rejected: no levels/structure. winston — rejected: heavier, no benefit. |
| Reverse proxy | Caddy | Automatic TLS with zero certificate management for a non-ops owner. | nginx — rejected here: manual cert handling. None — rejected: no TLS. |
| Hosting | Docker Compose (api + postgres + caddy) on a small VPS or free-tier container host (e.g. Fly.io) | Brief §7 near-free, owner-maintained; one `docker compose up`; restart policies cover unattended operation. | Kubernetes — absurd overkill. Serverless — cold starts + Postgres connection limits. |

**Money handling discipline (mitigates the rejected `decimal` advantage):** all amounts cross every boundary as integer kuruş (`amountKurus`). The only decimal surface is the UI text field and JSON payload strings (`"123.45"`), converted in **one place** — `parseKurus()` in `packages/shared` — which rejects negatives, >2 decimals, and values above the storage bound (02-data-model.md §8). Property tests (SC-002, NFR-BAL-001) verify the invariants.

## 5. Key algorithms

### 5.1 Split engine (C4, implements ASM-001 / BR-EXP-004/005/006)

Input: `amountKurus` (int ≥ 0), participants, split type.
- **Equal:** `base = floor(amount / n)`; `remainder r = amount − n·base` (0 ≤ r < n). Pick `r` **distinct** participants via CSPRNG Fisher–Yates shuffle; each gets `base + 1`; the rest get `base`. Guarantees: exact sum, distinct recipients, ≤ 1 extra kuruş each (SC-002 properties).
- **Exact:** per-participant kuruş accepted iff they sum exactly to `amountKurus` (BR-EXP-006).
- Shares are **stored** with the expense (permanent record); recomputed with a fresh draw only when amount, participants, or split type change on edit (FR-EXP-006).

### 5.2 Balance engine (C5, implements BR-BAL-001/002, D-ARCH-004)

Per (group, member), computed on demand by SQL aggregation (integer kuruş):

```
balance(m, g) = Σ expenses.amountKurus      where payerId = m, groupId = g
              − Σ shares.shareKurus         where participantId = m, expense.groupId = g
              + Σ payments.amountKurus      where payerId = m, groupId = g, status = SETTLED
              − Σ payments.amountKurus      where recipientId = m, groupId = g, status = SETTLED
```

**Zero-sum by construction (OBJ-004):** Σ over members = Σ(expense amounts) − Σ(all shares) + Σ(settled payer) − Σ(settled recipient). Shares sum to the expense amount (§5.1 invariant), and each settled payment contributes +X and −X. Total = 0, in exact integer arithmetic — there is no second stored copy that can drift. SC-005 tests assert this after every operation.

### 5.3 Suggestion engine (C5, implements BR-BAL-004/005/011)

Input: current nonzero balances of a group (≤ 8 members per brief §7). Output: payment list zeroing all balances.
- **Exact search** (permitted by NFR-BAL-003): depth-first search — settle the first debtor against each creditor in turn (`min(|debtor|, creditor|)`), recurse on the reduced balance vector, memoize on the canonical state, keep the first minimum-length solution found.
- **Deterministic:** creditors/debtors iterated in stable member-id order, so identical balances always produce the identical plan (required for "mark this suggestion paid" to be well-defined, §8.3).
- Zero-balance members excluded (BR-BAL-005); amounts kuruş-exact, sub-lira suggestions allowed (BR-BAL-011).
- **Defensive fallback (flagged):** if nonzero balances ever exceed 12 (impossible under brief §7 expected scale), fall back to greedy largest-debtor↔largest-creditor matching (still zeroes everything, possibly non-minimal) and log a warning. Never expected to trigger; exists so a future oversized group degrades instead of hanging.

## 6. FR traceability matrix

Every FR from all four domain reports. **All 45 FRs are Must (domain map); all are mapped — no orphans.**

### Accounts & Access → C2 Auth module (UI in C1)

| FR | Implementing component | Notes |
|---|---|---|
| FR-ACC-001 | C2 | `POST /api/auth/register` |
| FR-ACC-002 | C2 | Unique email index + 409 `EMAIL_TAKEN` |
| FR-ACC-003 | C2 | `POST /api/auth/login`, session row + cookie |
| FR-ACC-004 | C2 | 401 `INVALID_CREDENTIALS`, no session |
| FR-ACC-005 | C2 | `POST /api/auth/logout`, deletes session |
| FR-ACC-006 | C2 | `POST /api/auth/password` (current pw verified, Argon2id) |
| FR-ACC-007 | C2 | 400 `INVALID_CURRENT_PASSWORD` |
| FR-ACC-008 | C2 (data) + C3/C4/C5 (read models) + C1 (render) | Group-scoped responses expose `displayName` only, never email |
| FR-ACC-009 | C2 `AuthGuard` (global) | Only register/login are public |
| FR-ACC-010 | C2 | Register response sets session cookie |

### Groups & Membership → C3 Groups module (UI in C1)

| FR | Implementing component | Notes |
|---|---|---|
| FR-GRP-001 | C3 | `POST /api/groups`; creator membership row in same transaction |
| FR-GRP-002 | C3 | 8-char Crockford-base32 CSPRNG join code; returned to creator on group reads |
| FR-GRP-003 | C3 | `POST /api/join-requests {code}` |
| FR-GRP-004 | C3 | 404 `CODE_NOT_FOUND` |
| FR-GRP-005 | C3 | `GET /api/groups/:id/join-requests` (creator only) |
| FR-GRP-006 | C3 | `POST /api/join-requests/:id/approve` → membership |
| FR-GRP-007 | C3 | `POST /api/join-requests/:id/reject` |
| FR-GRP-008 | C3 `GroupMemberGuard` applied to all group-scoped routes of C3/C4/C5 | Deny-by-default (NFR-GRP-001) |
| FR-GRP-009 | C3 | `Membership @@unique(groupId,userId)`; user may hold many rows |
| FR-GRP-010 | C3 + C1 | `GET /api/groups/:id/members` → display names |
| FR-GRP-011 | C3 | Rejected request row may be reset to PENDING (02 §5.3) |
| FR-GRP-012 | C3 | `JoinRequest @@unique(groupId,userId)` |
| FR-GRP-013 | C3 | 409 `ALREADY_MEMBER` on join request |

### Expense Tracking → C4 Ledger module (UI in C1)

| FR | Implementing component | Notes |
|---|---|---|
| FR-EXP-001 | C4 | `POST /api/groups/:id/expenses` |
| FR-EXP-002 | C4 (+ C6 `parseKurus`) | Reject negative / >2-decimal amounts (BR-EXP-010: zero allowed) |
| FR-EXP-003 | C4 + C3 guard | Payer/participants validated against membership |
| FR-EXP-004 | C4 split engine | `floor(amount/n)` base share |
| FR-EXP-005 | C4 split engine | Random-spread remainder, CSPRNG |
| FR-EXP-006 | C4 | Shares stored; recomputed only on amount/participants/split change |
| FR-EXP-007 | C4 | Exact split sum validation → 400 `SPLIT_SUM_MISMATCH` |
| FR-EXP-008 | C4 | 403 `NOT_LOGGER` on edit |
| FR-EXP-009 | C4 | 403 `NOT_LOGGER` on delete |
| FR-EXP-010 | C4 | `createdAt` auto; `editedAt` set on edit; no date field in API/DTO |
| FR-EXP-011 | C4 + C1 | `GET .../expenses`, `GET .../expenses/:id` (members only) |
| FR-EXP-012 | C4 | Hard delete, `ExpenseShare` cascades (BR-EXP-011) |

### Balances & Settlement → C5 Settlement module (UI in C1)

| FR | Implementing component | Notes |
|---|---|---|
| FR-BAL-001 | C5 | `GET /api/groups/:id/balances` — derived per-member |
| FR-BAL-002 | C5 | Formula §5.2, always filtered by groupId |
| FR-BAL-003 | C5 (+ C4) | Zero-sum by construction (§5.2); asserted by tests after every op |
| FR-BAL-004 | C5 suggestion engine | Exact min-transaction search (§5.3) |
| FR-BAL-005 | C5 | Zero balances filtered from suggestions |
| FR-BAL-006 | C5 | Mark-paid actor ∈ {payer, recipient} → else 403 `NOT_PAYMENT_PARTY` |
| FR-BAL-007 | C5 | `POST /api/groups/:id/settlements` creates SETTLED fact |
| FR-BAL-008 | C5 | `POST .../settlements/:id/undo` — payer/recipient only |
| FR-BAL-009 | C5 | Undo → status UNDONE, excluded from balance; outstanding plan regenerates (it is computed, D-ARCH-004) |
| FR-BAL-010 | C5 + C3 guard + C1 | Members-only views |

## 7. NFR translation (business NFR → technical spec with numbers)

| NFR | Technical specification |
|---|---|
| NFR-ACC-001 (non-recoverable passwords) | Argon2id, m=19456 KiB, t=2, p=1; hash-only storage; no password ever logged. Login throttling (flagged addition, §9): max 10 failed attempts per (email, IP) per **fixed 15-minute window** (in-memory, single instance); the 11th and subsequent attempts return **429 `TOO_MANY_ATTEMPTS`** (03 §4) before credential verification — correct credentials are blocked too; the window is anchored at the first counted failure and cleared on expiry or on successful login; `POST /api/auth/login` only (register is not throttled). Full deterministic semantics: §8.2. |
| NFR-ACC-002 (near-free, unattended) | Single container ≤ 512 MB RAM / 1 vCPU; Docker Compose with `restart: unless-stopped`; runs on a free-tier container host or ≤ $5/mo VPS; RTO = owner attention (target ≤ 24 h); RPO ≤ 24 h via nightly `pg_dump` (ops guidance, §10). |
| NFR-ACC-003 (≤ 2 s pages) | Server API p95 ≤ 300 ms; SPA initial bundle ≤ 300 KB gzipped; static assets cache-headered; end-to-end page load ≤ 2 s on a normal connection (SC-004) — asserted by Playwright timing checks. |
| NFR-ACC-004 (account retention) | No delete/update paths for accounts beyond password change and display-name change absence (no account editing at all beyond password); accounts live for app lifetime. |
| NFR-ACC-005 (scale w/o ops) | 8 users, 5 groups: load ≈ trivial; no autoscaling, no queue, no scheduler. |
| NFR-GRP-001 (deny by default) | Route-level guards; authorization negative tests (SC-006) in CI (04-ci-pipeline.md); non-members get 404 (no existence disclosure). |
| NFR-GRP-002 (group data retention) | No delete/archiving endpoints or queries for groups, memberships, join requests (feature-absent by design). |
| NFR-GRP-003 (≤ 2 s pages) | Same budget as NFR-ACC-003. |
| NFR-GRP-004 (scale) | ≤ 5 groups × ≤ 8 members; membership check = one indexed lookup per request. |
| NFR-GRP-005 (join-code secrecy) | 8-char Crockford base32 from CSPRNG ≈ 2^40 ≈ 1.1×10^12 space; combined with creator approval (BR-GRP-004); no rotation (OQ-GRP-002 non-goal). |
| NFR-EXP-001 (≤ 30 s logging) | Add-expense reachable in ≤ 2 interactions from group page; single-screen form; participants default to **all members**, payer defaults to the acting user; client-side validation with no round-trips until submit; submit p95 ≤ 500 ms. E2E-verified (SC-003). |
| NFR-EXP-002 (≤ 2 s pages) | Same budget as NFR-ACC-003. |
| NFR-EXP-003 (zero-sum contribution) | Shares sum === amount enforced in `LedgerService` before any write (unit + property tests); expense + shares written in one DB transaction. |
| NFR-EXP-004 (scale) | 20–50 expenses/trip; list queries indexed by `(groupId, createdAt)`; no pagination needed at this size (full-list responses; flagged defensive cap at 500 rows → error, never expected). |
| NFR-EXP-005 (persist until deleted) | Hard delete only (BR-EXP-011); no archive tables, no TTL. |
| NFR-BAL-001 (zero-sum tests) | Integration suite computes Σ balances = 0 after every create/edit/delete/settle/undo (SC-005); runs in CI step 3. |
| NFR-BAL-002 (engine edge-case tests) | Unit suite: circular debts, single debtor/creditor, zero-balance members, remainder-spread properties (SC-002). |
| NFR-BAL-003 (exact search acceptable) | DFS + memoization (§5.3); input ≤ 8 nonzero balances per brief §7. |
| NFR-BAL-004 (≤ 2 s pages) | Balance/suggestion computation ≤ 50 ms at max expected group size; same page budget. |
| NFR-BAL-005 (settled-payment retention) | Settled rows are never deleted; undo sets `status=UNDONE, undoneAt` (row retained). |

**Complexity note (simplest design rule):** every in-scope FR is Must (domain map), so nothing was cut from the design. Items that *would* add material complexity if ever promoted from the scope-out list: join-code rotation, member removal, group deletion/archiving, email verification, self-serve password reset, multi-currency, notifications, offline mode. Each currently maps to no component — by design.

## 8. Cross-cutting concerns

### 8.1 Authentication & authorization
- ASM-004 **validated here**: sessions = DB rows (`sessions` table) + opaque 256-bit token in an HttpOnly/Secure/SameSite=Lax cookie; sliding 30-day expiry; logout deletes the row (FR-ACC-005). This satisfies "standard session management incl. logout".
- Password change (D-ARCH-002): verify current password (ASM-003) → update Argon2id hash → delete all of the user's session rows **except** the current one.
- Authorization layers: (1) global `AuthGuard` → 401 for anonymous; (2) `GroupMemberGuard` on group-scoped routes → 404 `NOT_FOUND` for non-members (existence-hiding); (3) role checks inside handlers (creator for join-request handling, logger for expense edit/delete, payment party for mark/undo) → 403 with specific codes.

### 8.2 Web security
- CSRF: SameSite=Lax cookie **plus** every state-changing endpoint requires header `X-Requested-With: XMLHttpRequest` (set by the SPA's fetch wrapper). Browsers do not attach custom cross-site headers without preflight → classic form-post CSRF is blocked. (Rejected: double-submit token — more moving parts for equal effect at same-origin.)
- Headers: helmet defaults (CSP allowing self origin only, no inline scripts), HSTS behind TLS.
- **Login throttle — deterministic semantics (response contract: `429 TOO_MANY_ATTEMPTS`, 03-api-design.md §4; resolves test-planner G-1 / Gate 1 Q2, option a).** `POST /api/auth/login` only; in-memory counter in C2 (single instance — no cross-process state). Keyed by **(email, IP)**: the submitted email, lowercased before keying (the same normalization the lookup uses, so case variants cannot split one account's counter; keyed whether or not the account exists — a counter that existed only for real accounts would itself be an account-existence oracle and break login non-enumeration parity), paired with the client IP (`req.ip` with Express `trust proxy` enabled for the Caddy hop, so the key is the originating client, not the proxy).
  - **What counts:** only attempts that fail credential verification (the `401 INVALID_CREDENTIALS` path — unknown email or wrong password). CSRF (403) and DTO-validation (400) rejections never reach verification and never count. Check order in the login handler: DTO validation → throttle check → credential verification (a malformed payload therefore gets 400 even from a throttled pair).
  - **Window — fixed, anchored at the first counted failure:** a pair's first counted failure opens a 15-minute window and sets the counter to 1; each further counted failure increments it. The first ten counted failures are processed normally (each returns 401). Once the counter reaches 10 the pair is throttled. The counter and window are cleared exactly when (i) 15 minutes have elapsed since the window-opening failure — the entry is dropped, and the next counted failure opens a fresh window — or (ii) the pair logs in successfully (the next counted failure after that opens a new window). Throttled (429) attempts neither increment the counter nor extend the window.
  - **While throttled:** the 11th and subsequent attempts from the pair return `429 TOO_MANY_ATTEMPTS` in the standard error envelope (03 §4 — generic message, no `details`, no `Retry-After`), **before credential verification — attempts with correct credentials are blocked too**. One-line rationale: per-(email, IP) keying means only the requester who accumulated the ten failures is blocked (nobody can lock out another user at ~8-user, single-instance scale), whereas a throttle that still verified credentials would not slow any brute force; a blocked legitimate user waits out at most the remainder of the 15-minute window.
  - **Scope:** `POST /api/auth/login` only. `POST /api/auth/register` is not throttled — open registration has no credential verification to brute-force.
  - Rejected alternative: sliding window — marginally fairer pacing but requires per-failure timestamps and has blurrier test boundaries; the fixed window is a single (count, windowStart) pair — the simplest deterministic contract.
  - **Flagged** (unchanged): added hardening beyond the brief — cheap, reversible, aligned with NFR-ACC-001's internet-facing rationale.
- Email enumeration on registration is inherent to open registration + BR-ACC-002 (409 reveals account existence). Accepted at friend-group scale; noted, not mitigated.

### 8.3 Error handling
Single error contract for the whole API (definition and code table in 03-api-design.md §4): JSON `{ "error": { "code", "message", "details? } }`, NestJS exception filter, no stack traces or internals in responses, 500s logged with request id. Never leak group existence to non-members (404).

### 8.4 Logging
pino JSON to stdout; one line per request (method, path, status, duration ms, userId if authenticated, request id); levels via `LOG_LEVEL` env (default `info`); emails and session tokens never logged (email → hashed in log context).

### 8.5 Configuration
Env vars validated at boot (fail fast, no defaults for required): `DATABASE_URL`, `PORT`, `LOG_LEVEL`, `ARGON2_*` (defaults per §7), `COOKIE_SECURE` (default true in prod). No secrets in repo; `.env` gitignored, `.env.example` committed.

## 9. Flagged items (consolidated also in the summary to the user)

1. **Login rate limiting** added as hardening — not required by any FR/NFR; flagged for user awareness, trivially removable. (Response contract and deterministic semantics specified 2026-09-25 — §8.2 + 03 §4 — resolving test-planner G-1.)
2. **Defensive greedy fallback** in suggestion engine when > 12 nonzero balances (§5.3) — beyond expected scale; flagged.
3. **Settlement `SettledPayment.markedPaidBy` field considered and rejected** — no FR requires recording *who* marked a payment paid; R-BAL-001 relies on member honesty as decided. Revisit only if a dispute-resolution FR appears.
4. **Expenses list defensive cap** (500 rows per response → error) — never expected at brief §7 scale; flagged.
5. **Owner password-reset procedure** (UC-ACC-005, OQ-ACC-001 decided out-of-app): operational runbook in §10 — uses a repo-provided host-run CLI script (no HTTP surface, no app capability). Flagged for user confirmation that a CLI script counts as "outside the application".

## 10. Deployment view (owner-operated, near-free)

```
docker compose up -d
  caddy:80/443   → auto-TLS, proxies to api
  api:3007       → NestJS server, serves /api/* + built SPA from apps/web/dist
  postgres:5432  → volume-backed, postgres:17-alpine
```

- Migrations: `prisma migrate deploy` runs as part of deployment (documented in README; not auto-run on boot — deliberate: owner-controlled).
- Backups (ops guidance, supports NFR-ACC-002/NFR-GRP-002/NFR-BAL-005 retention): nightly cron `pg_dump` → volume + owner pulls a copy off-site monthly; RPO ≤ 24 h.
- **Owner password-reset runbook (UC-ACC-005):** `docker compose exec api node dist/scripts/set-password.js <email>` prompts for a new password, writes an Argon2id hash directly to the DB. No HTTP endpoint, no in-app admin role — consistent with OQ-ACC-001's "outside the application" decision; flagged in §9.5 for confirmation.

## 11. Traceability & change propagation

- Initial architecture: no existing test plans or tickets to re-validate. Downstream agents must treat this document, 02, 03, and 04 as the implementation contract.
- Every FR maps to ≥ 1 component (§6); every UC maps to ≥ 1 endpoint except UC-ACC-005 by design (03-api-design.md §6).
- Constraints check (brief §7): web-only ✓, NestJS backend ✓ (choice made as required), PostgreSQL ✓, near-free hosting ✓, no deadline ✓, expected scale respected throughout ✓. No constraint violated.

- **2026-09-25 — amendment (test-planner G-1 resolution + Gate 2 user decisions):** the login-throttle response contract is now specified — `429 TOO_MANY_ATTEMPTS`, fixed 15-minute window anchored at the first counted failure, 11th+ attempt blocked before credential verification (correct credentials included), counter cleared on window expiry or successful login, login endpoint only (§7 NFR-ACC-001 row, §8.2; error table in 03 §4). Email normalization at login (lowercase before lookup — user decision 2026-09-25) is documented in 03 §1/§2 and 02 §4/§9, and error precedence in 03 §4. No FR/NFR semantics changed — NFR-ACC-001's throttle translation (10 / (email, IP) / 15 min, in-memory) is unchanged in substance, only made deterministic and testable. Downstream: the accounts-access test plan adds **TC-ACC-031** (throttle) and finalizes **TC-ACC-030** (email normalization), and may add precedence TCs — test-planner to re-validate coverage; planner unaffected (implementation detail, no ticket scope change).
