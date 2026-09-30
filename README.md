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
docker-compose.yml  Deployment stack — caddy + api + postgres (architecture §10)
Caddyfile           Edge config — automatic TLS, reverse-proxies to api
.env.example        Committed deployment env template (copy to .env)
apps/
  api/          NestJS API — auth, groups, expenses, balances
    Dockerfile  api image build (context: repo root)
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

## Deployment & operations (owner-run)

The production artifact is one Docker Compose stack (architecture §10). It is deliberately **owner-run** — CI never deploys (04 §7); it only gates the branch.

```
docker compose up -d
  caddy :80/:443  → automatic TLS, reverse-proxies to api:3007
  api   :3007     → NestJS server: serves /api/* + the built SPA from one origin
  postgres :5432  → volume-backed (postgres:17-alpine)
```

### First deploy

Prerequisites: Docker Engine with the Compose v2 plugin, and a host (a small VPS or a free-tier container host).

```bash
cp .env.example .env        # then set POSTGRES_PASSWORD and SITE_ADDRESS
docker compose build
docker compose up -d        # boots postgres, api, caddy
docker compose run --rm api npx prisma migrate deploy
```

Migrations are **not** run on boot — `prisma migrate deploy` is an explicit, owner-controlled step (architecture §10). Run it again after every deploy that adds a migration. The `api` service is never published to the host: only Caddy reaches it on the internal network (the login throttle keys off `req.ip` under Express `trust proxy: 1`).

Verify the stack is serving through Caddy:

```bash
curl -i http://localhost/           # 200, the SPA index.html
curl -i http://localhost/api/nope   # 404, the standard {"error":{...}} envelope
```

### Resource envelope

NFR-ACC-002: the single application container runs within **≤ 512 MB RAM / 1 vCPU**. `docker-compose.yml` enforces this on the `api` service (`mem_limit: 512m`, `cpus: 1.0`). Caddy and PostgreSQL are left uncapped; both are lightweight at the expected scale (≈ 8 users, ≤ 5 groups).

### TLS and local verification

Caddy terminates TLS automatically (architecture §4/§10). In production, set `SITE_ADDRESS` in `.env` to your public hostname (e.g. `settleup.example.com`) and point its DNS record at the host — Caddy obtains and renews the certificate on the first request, with no certificate files or renewal cron to manage.

For local verification the default `SITE_ADDRESS=http://localhost` serves plain HTTP on :80, so the `curl` checks above work without a domain. Automatic TLS is Caddy's runtime behaviour and cannot be exercised locally without a public domain. When testing auth over plain HTTP, set `COOKIE_SECURE=false` in `.env` (otherwise the browser refuses to store the `Secure` session cookie).

### Environment variables

`docker compose` reads `.env` from the repository root; `.env.example` is the committed template. `apps/api/.env.example` documents the app-level defaults. The same values (plus `POSTGRES_*`) are listed here.

| Variable | Default | Used by | Purpose |
|---|---|---|---|
| `DATABASE_URL` | composed from `POSTGRES_*` | api | Prisma/PostgreSQL connection string |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `settleup` / *(required, no default)* / `settleup` | postgres, api | Database credentials — **set the password before the first deploy**; the stack fails closed without it |
| `PORT` | `3007` | api | HTTP listen port (architecture §10) |
| `LOG_LEVEL` | `info` | api | pino level: `trace`…`fatal` |
| `COOKIE_SECURE` | `true` | api | `Secure` session cookie; `false` only for plain-HTTP local testing |
| `ARGON2_MEMORY_COST` / `ARGON2_TIME_COST` / `ARGON2_PARALLELISM` | `19456` / `2` / `1` | api | Argon2id parameters (NFR-ACC-001) |
| `SITE_ADDRESS` | `http://localhost` | caddy | Caddy site address; a hostname enables automatic TLS |

No secrets are committed: `.env` is gitignored, `.env.example` is the template, and the committed defaults are non-secret placeholders for local verification only.

### Backups

RPO ≤ 24 h: a nightly logical dump written to the `postgres-backups` volume, plus a monthly off-site copy (architecture §10). A dump holds password hashes and live session tokens, so keep it owner-readable only and encrypt the off-site copy.

```cron
# crontab -e — nightly at 03:15 (escape % as \% in crontab)
15 3 * * * cd /opt/settleup && docker compose exec -T postgres \
  sh -c 'umask 077; pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f /backups/settleup-$(date +\%F).dump; find /backups -name "settleup-*.dump" -mtime +30 -delete'
```

`umask 077` writes each dump `0600`; the same command prunes dumps older than 30 days.

Copy the dumps off-site monthly — encrypted, since the file is secret material:

```bash
mkdir -p ~/settleup-backups
docker compose cp postgres:/backups/. ~/settleup-backups/
chmod 600 ~/settleup-backups/*.dump
# Encrypt before it leaves the host, then rsync/scp the ciphertext:
#   age -r <recipient> -o settleup-$(date +%F).dump.age settleup-$(date +%F).dump
```

Restore (into the running database):

```bash
docker compose exec -T postgres \
  sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists /backups/<file>.dump'
```

### Owner password reset (UC-ACC-005)

There is no HTTP endpoint or in-app admin role (architecture §9 flag 5, §10). The owner runs the CLI inside the running container; it writes an Argon2id hash directly to the database and **deletes all of the account's sessions** in the same operation — there is no acting session to preserve, and a reset is the suspected-compromise / forgotten-password path.

```bash
docker compose exec api node dist/scripts/set-password.js alice@example.com
# prompts on stdin; works non-interactively when piped (`-T` disables the TTY).
# Read the password without echoing it or leaking it into shell history:
read -rsp 'New password: ' NEWPASS && printf '%s\n' "$NEWPASS" | \
  docker compose exec -T api node dist/scripts/set-password.js alice@example.com
unset NEWPASS
```

The user logs in again with the new password. The same script can be run against a host build: `node apps/api/dist/scripts/set-password.js <email>`.

### CI first-time setup

CI is the quality gate; deployment is not part of it. To enable the gate on a fresh GitHub repository, follow the checklist in [`04-ci-pipeline.md` §5](.pipeline/architecture/04-ci-pipeline.md): push the repo, watch the first **CI** run go green, protect `master` (require a pull request and the **Lint, test & build** status check), then merge only on green. `dev` is the working trunk; `master` receives the promoted, release-ready state.

## Branching & CI

- `dev` is the working trunk — all PRs target it and are red/green-gated by the **Lint, test & build** status check.
- `master` intentionally lags `dev` until MVP release (trunk-promotion-by-design); it receives the promoted, release-ready state.
- Nothing merges without a clean review loop: coder PR → multi-lane review (compliance / code / security) with recorded round artifacts → merge.

## Learning more

- Delivery board and ticket statuses: [`.pipeline/plan/board.md`](.pipeline/plan/board.md)
- Architecture, API, and test plans: [`.pipeline/plan/`](.pipeline/plan/) (planner-produced, human-approved)
- Review records for every merged PR: [`.pipeline/plan/reviews/`](.pipeline/plan/reviews/)
