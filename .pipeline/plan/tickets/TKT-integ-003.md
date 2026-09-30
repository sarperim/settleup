# TKT-integ-003: Deployment & ops package — Docker Compose, Caddy, runbook

- Status: in-progress
- Size: M
- Scope: **Create** the deployment artifacts and operational runbook (no TCs by design — production is not tested by the test plan, strategy §6; NFR-ACC-002 is review-verified):
  - `docker-compose.yml` + `Caddyfile` + api `Dockerfile` (+ `.dockerignore`) per arch §10: caddy :80/:443 with automatic TLS proxying to the api; api container (Node, serves `/api/*` + the built SPA); `postgres:17-alpine` volume-backed; `restart: unless-stopped` on all services.
  - Root `README.md` runbook: deploy steps (`docker compose up -d`; `prisma migrate deploy` as the owner-controlled migration step — deliberately not auto-run on boot), env var reference (parity with `.env.example`), backups (nightly cron `pg_dump` → volume + monthly off-site copy, RPO ≤ 24 h), the owner password-reset runbook (`set-password.js` — stdin usage, session clearing, arch §10), and the CI first-time-setup pointer (04 §5).
  - **Must NOT touch**: application source (`apps/**/src/**`, `packages/**`), `.github/workflows/**`, `apps/api/prisma/**`.
- Traces to: NFR-ACC-002 (near-free, unattended hosting — review-verified), NFR-GRP-002/NFR-BAL-005 (retention, backup support) · brief §7 (hosting constraint), §4 (owner persona)
- Acceptance (explicit criteria — no TCs, operational):
  1. `docker compose build` succeeds; `docker compose up -d` boots all three services; `prisma migrate deploy` applies migrations to the compose Postgres; through the stack the api serves the built SPA index at `/` and a `/api` 404 in the error envelope.
  2. `restart: unless-stopped` on all services; the ≤ 512 MB / 1 vCPU envelope is documented (compose limits or README guidance — arch §7 NFR-ACC-002 row).
  3. The README covers every runbook section listed above; no secrets are committed (`.env` gitignored; `.env.example` is the template).
  4. The Caddy configuration matches arch §10 (auto-TLS; local verification over HTTP documented — production TLS is automatic by Caddy's design and not locally testable).
- Architecture refs: 01-system-architecture.md §10 (deployment view incl. the amended owner password-reset runbook), §4 (Caddy, hosting rows), §7 (NFR-ACC-002 row), §9 flag 5; 04-ci-pipeline.md §5 (first-time setup), §7 (no deploy step in CI — deployment stays owner-run)
- Dependencies: TKT-bal-007, TKT-exp-006 (the complete, lifecycle-proven artifact — deployment ships only what SC-007 has verified)
- Parallel group: P-9 (final ticket — no other ticket depends on it)
