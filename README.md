# Settle Up

Shared-expense tracking for a friend group: create a group, invite friends with a join code, log who paid for what, and see who owes whom — with suggested minimum-transaction settlement plans for settling up.

**Status:** MVP in active development (`dev` trunk). The foundation and Accounts & Access domains are complete; groups, expenses, and balances are under construction.

## Why this project exists

Settle Up is deliberately two things at once:

1. **A testbed for agentic SDLC.** The entire delivery lifecycle of this repo is driven by AI agents: a planner produced the architecture and test plans and decomposed them into a ticket board; an orchestrator dispatches coder agents (one ticket per worktree/PR); review-lead agents run multi-lane review loops (compliance / code / security) with fixer re-reviews before anything merges. Every step leaves an auditable artifact — plans, tickets, and signed review rounds live in [`.pipeline/plan/`](.pipeline/plan/) (board, tickets, review records). Humans own the decisions: merge grants, arbitration of blocked findings, and acceptance.
2. **A first-time DevOps setup.** The project is the vehicle for standing up the ops stack from scratch: a GitHub Actions CI pipeline (`lint` / `typecheck` / `test` / `build` / e2e smoke — see [`.github/workflows/ci.yml`](.github/workflows/ci.yml)), layered test automation (unit → DB-backed integration → system → browser e2e) with migration deployment in the loop, and a planned Docker Compose + Caddy deployment package with a runbook.

The app domain was chosen to be small and real — money, auth, and permissions are unforgiving enough to make the gates mean something.

## Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js ≥ 24, TypeScript, pnpm workspaces (monorepo) |
| API | NestJS (`apps/api`) — Argon2id password hashing, session cookies, CSRF, typed error envelope, serves the built SPA |
| Web | React SPA (`apps/web`) — Vite, client-side routing |
| Data | PostgreSQL via Prisma (`apps/api/prisma`), money stored as integer kuruş |
| Shared | `packages/shared` — frozen DTO types, money helpers, constants |
| Tests | Vitest (unit + integration) · Supertest (integration) · Playwright (e2e) · GitHub Actions CI |

## Repository layout

```
apps/
  api/          NestJS API — auth, groups, expenses, balances (domain modules land per ticket)
  web/          React SPA — pages, layout, API client
packages/
  shared/       DTO types, kuruş money helpers, constants (frozen contract)
scripts/
  e2e-db.mjs    Creates + migrates the e2e database (requires psql)
.pipeline/
  plan/         Agentic-SDLC artifacts — board, tickets, architecture/test plans, review records
```

## Getting started

Prerequisites: Node.js ≥ 24, pnpm 10, a running PostgreSQL (v15+), and `psql` on PATH for the e2e phase.

```bash
pnpm install

# Environment: DATABASE_URL and PORT are required (no defaults);
# everything else (Argon2id params, cookie settings, …) has safe defaults.
export DATABASE_URL=postgresql://user:pass@localhost:5432/settleup
export PORT=3000

pnpm --filter api generate          # prisma client
pnpm --filter api migrate:dev       # create/apply migrations (dev)
pnpm build                          # shared → api → web, in order

pnpm --filter api start             # serves the API + built SPA on $PORT
```

For SPA development with hot reload: `pnpm --filter web dev` (Vite dev server).

## Scripts

| Command | What it does |
|---|---|
| `pnpm lint` / `pnpm typecheck` | ESLint + tsc across all packages |
| `pnpm build` | Build shared → api → web |
| `pnpm test` | Unit + integration suites (integration boots the app in-process against `DATABASE_URL`; truncates tables per test) |
| `pnpm test:system` | System specs — run against a **built** API (e.g. the owner CLI) |
| `pnpm test:e2e` | Full e2e phase: create/migrate `E2E_DATABASE_URL` database → system specs → Playwright browser tests against the built api + web |

## Owner CLI

Reset a user's password (writes the Argon2id hash and revokes all of the user's sessions in one operation — no HTTP surface):

```bash
node apps/api/dist/scripts/set-password.js <email>   # new password via piped stdin
```

## Branching & CI

- `dev` is the working trunk — all PRs target it and are red/green-gated by the **Lint, test & build** status check.
- `master` intentionally lags `dev` until MVP release (trunk-promotion-by-design); it receives the promoted, release-ready state.
- Nothing merges without a clean review loop: coder PR → multi-lane review (compliance / code / security) with recorded round artifacts → merge.

## Learning more

- Delivery board and ticket statuses: [`.pipeline/plan/board.md`](.pipeline/plan/board.md)
- Architecture, API, and test plans: [`.pipeline/plan/`](.pipeline/plan/) (planner-produced, human-approved)
- Review records for every merged PR: [`.pipeline/plan/reviews/`](.pipeline/plan/reviews/)
