# CI Pipeline — Settle Up

Status: ready for review · Date: 2026-09-25
Audience note: written for a **first-time CI user** — GitHub Actions, 4 steps, as requested. The workflow file is `.github/workflows/ci.yml` at the repository root.

## 1. What CI is (30-second version)

Continuous Integration = a robot that runs every time you push code or open a pull request on GitHub. It checks out your code on a GitHub-provided machine (a "runner"), and executes the steps you defined in a YAML file. If any step fails, the commit/PR is marked red — you find broken code immediately instead of on your server. For Settle Up, CI is also where the correctness-critical test suites live their enforced life: **the zero-sum tests (SC-005) and the suggestion-engine edge cases (SC-002) run on every push**, so a regression can never silently reach the VPS.

Key GitHub terms used below:

| Term | Meaning |
|---|---|
| **workflow** | One YAML file in `.github/workflows/` describing what to run |
| **event / trigger** | When to run: here, every `push` to `main` and every `pull_request` |
| **job** | A unit of work on a fresh runner (VM) — we have exactly one |
| **step** | A command or reusable action inside a job — our 4 logical stages below |
| **service container** | An extra container started alongside the job — we use PostgreSQL |
| **required check** | A check that GitHub enforces before a PR can be merged |

## 2. The four steps

```
push / PR
   │
   ▼
┌────────────────────────────┐
│ 1. SET UP                  │  checkout → pnpm → Node 24 (cached) → install → prisma generate
├────────────────────────────┤
│ 2. QUALITY GATES           │  eslint (all packages) → tsc typecheck (all packages)
├────────────────────────────┤
│ 3. TEST                    │  start PostgreSQL service container → prisma migrate deploy
│                            │  → vitest: unit + integration (DB-backed)
├────────────────────────────┤
│ 4. BUILD & E2E SMOKE       │  build api + web → boot the real app → Playwright lifecycle
│                            │  smoke (SC-007 path) → upload build artifact
└────────────────────────────┘
```

| # | Step | What it proves | Why it's in CI |
|---|------|----------------|----------------|
| 1 | **Set up** | The repo installs cleanly from a frozen lockfile on a bare machine | Catches broken dependencies before anything else runs; the pnpm store cache keeps it fast (~30 s warm) |
| 2 | **Quality gates** | Code is lint-clean and type-checks across `apps/api`, `apps/web`, `packages/shared` | TypeScript strict mode is a correctness tool for the kuruş invariants (OBJ-004); ESLint catches the classic bugs |
| 3 | **Test** | Unit tests (split engine ASM-001 properties, suggestion engine SC-002 edge cases) + integration tests against a **real PostgreSQL** (auth, groups, expenses, zero-sum after every op — SC-005, SC-006) | These are the acceptance-critical suites; running them against real Postgres catches SQL/migration issues a mock never would |
| 4 | **Build & E2E smoke** | The production build compiles; the app boots; a Playwright suite drives the SC-007 lifecycle (register → group → join+approve → expense → settle → undo) and asserts page-load timing (SC-004) | Proves the artifact you'd actually deploy works end-to-end, not just in isolation |

Note: the YAML below has more than four `- name:` entries — the four **logical steps** group the mechanical ones (checkout, install…). Keep the logical grouping in comments; that's the "4-step CI".

## 3. Prerequisite: root script contract

CI only calls root-level pnpm scripts (defined in the root `package.json`, delegating to workspaces via `pnpm -r`). The coder must provide exactly these:

| Command | Must do |
|---|---|
| `pnpm lint` | ESLint in `apps/api`, `apps/web`, `packages/shared` |
| `pnpm typecheck` | `tsc --noEmit` in all three packages |
| `pnpm test` | Vitest unit + integration suites; integration suites read `DATABASE_URL` |
| `pnpm build` | Build `packages/shared` → `apps/api` (nest build) → `apps/web` (vite build); api build output serves `apps/web/dist` |
| `pnpm test:e2e` | Playwright: boots the built api + web against `E2E_DATABASE_URL`, runs the smoke suite |

## 4. The workflow file — `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

# A new push to the same PR cancels the now-outdated run (saves minutes)
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  ci:
    name: Lint, test & build
    runs-on: ubuntu-latest
    timeout-minutes: 15

    # Step 3+ needs a real database: PostgreSQL as a service container.
    services:
      postgres:
        image: postgres:17-alpine
        env:
          POSTGRES_USER: settleup
          POSTGRES_PASSWORD: settleup
          POSTGRES_DB: settleup_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U settleup"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10

    env:
      DATABASE_URL: postgresql://settleup:settleup@localhost:5432/settleup_test
      E2E_DATABASE_URL: postgresql://settleup:settleup@localhost:5432/settleup_e2e

    steps:
      # ── Step 1: Set up ────────────────────────────────────────────
      - name: Check out repository
        uses: actions/checkout@v4

      - name: Install pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10

      - name: Install Node 24 (with pnpm cache)
        uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Generate Prisma client
        run: pnpm --filter api exec prisma generate

      # ── Step 2: Quality gates ─────────────────────────────────────
      - name: Lint
        run: pnpm lint

      - name: Typecheck
        run: pnpm typecheck

      # ── Step 3: Test (unit + integration on real Postgres) ────────
      - name: Apply migrations to test database
        run: pnpm --filter api exec prisma migrate deploy

      - name: Unit & integration tests
        run: pnpm test

      # ── Step 4: Build & E2E smoke ─────────────────────────────────
      - name: Build
        run: pnpm build

      - name: Create E2E database & apply migrations
        run: |
          psql "$DATABASE_URL" -c "CREATE DATABASE settleup_e2e;"
          pnpm --filter api exec prisma migrate deploy --schema prisma/schema.prisma
        env:
          DATABASE_URL: postgresql://settleup:settleup@localhost:5432/settleup_e2e

      - name: E2E smoke tests (Playwright)
        run: pnpm test:e2e

      - name: Upload build artifact
        if: github.ref == 'refs/heads/main'
        uses: actions/upload-artifact@v4
        with:
          name: app-build
          path: |
            apps/api/dist
            apps/web/dist
          retention-days: 7
```

(Action version tags are current at time of writing; bumping them later is routine maintenance. `psql` is preinstalled on ubuntu runners.)

### How the Postgres service container works

GitHub starts `postgres:17-alpine` as a container next to your job, waits until `pg_isready` passes (the `options` block), and maps it to `localhost:5432`. Your tests connect with `DATABASE_URL` exactly like production — same engine, same migrations (`prisma migrate deploy`). Nothing is mocked; the database is thrown away when the job ends. **No secrets are needed** — the credentials are throwaway values for the ephemeral runner.

### Caching

`actions/setup-node` with `cache: pnpm` stores the pnpm store directory keyed on `pnpm-lock.yaml`. Warm installs take ~30 s instead of a few minutes. Playwright browser binaries can be cached later with `actions/cache` if E2E step time matters (optional; runners preinstall browsers for Playwright's default channel anyway).

## 5. First-time setup checklist (you, once)

1. Push the repo to GitHub (`git remote add origin … && git push -u origin main`).
2. Open the repo → **Actions** tab → you should see the "CI" workflow run on your push. Watch the first run go green.
3. Protect `main` (Settings → Branches → Add branch ruleset):
   - ✅ Require a pull request before merging
   - ✅ Require status checks to pass: select **Lint, test & build**
   - ✅ (optional) Require branches to be up to date
4. From now on: work on branches → open a PR → CI runs → merge only when green. (Direct pushes to `main` also run CI, as a safety net.)
5. Optional: add a status badge to the README: `![CI](https://github.com/<you>/settleup/actions/workflows/ci.yml/badge.svg)`.

## 6. Cost & limits (near-free constraint, brief §7)

- **Public repo:** GitHub Actions is completely free.
- **Private repo:** the Free plan includes 2,000 runner-minutes/month. This workflow targets **≤ 5 minutes per run** (timeout hard-capped at 15). At a hobby pace of even 60 runs/month you use ~300 minutes — comfortably inside the free tier. The `concurrency` block avoids wasting minutes on superseded PR runs.

## 7. What CI deliberately does NOT do

- **No deploy step.** Deployment stays a deliberate, owner-run action (`docker compose up -d` + `prisma migrate deploy` on the VPS — 01-system-architecture.md §10). Rejected for now: auto-deploy on green `main` (push-to-production from CI is convenient but wrong for a first CI: you want to watch deploys manually first). Natural future step 5: a `deploy` job gated on `main` + manual approval (`environment: production`), SSHing to the VPS or using a container registry.
- **No linting of commit messages, no coverage thresholds, no matrix testing across OS/Node versions** — one OS, one Node version, single-tenant app; anything more is ceremony. Each is a rejected alternative documented here rather than silently absent.

## 8. Traceability

| CI concern | Traces to |
|---|---|
| Zero-sum integration tests run on every push | SC-005, NFR-BAL-001, OBJ-004 |
| Suggestion-engine + split-engine unit tests | SC-002, NFR-BAL-002/003, R-EXP-001, R-BAL-002, ASM-001 |
| Authorization negative tests (API level) | SC-006, NFR-GRP-001, FR-GRP-008 |
| E2E lifecycle smoke | SC-007, SC-001 path |
| Page-load timing assertions | SC-004, NFR-ACC-003/GRP-003/EXP-002/BAL-004 |
| ≤ 5 min runtime, free tier | Brief §7 hosting constraint, NFR-ACC-002 |

The **content** of the test suites (exact cases) is the test-planner's deliverable, not this document's — CI defines the stages that execute them and the script contract (§3) the coder must satisfy.
