# TKT-foundation-001: Monorepo scaffolding & dependency baseline

- Status: done (merged via PR #1 → master, 2026-09-26; review loop closed clean at round 2 — artifacts in .pipeline/plan/reviews/TKT-foundation-001-round-{1,2}.md)
- PR: https://github.com/sarperim/settleup/pull/1
- Size: M
- Scope: **Create** the pnpm-workspace monorepo exactly as laid out in 01-system-architecture.md §1:
  - Root: `package.json` (workspace scripts per the 04-ci-pipeline.md §3 contract — `lint`, `typecheck`, `build` real; `test`, `test:e2e` as clearly-marked passing stubs — `test` is wired to the unit runner by TKT-foundation-007 and completed by TKT-foundation-006; `test:e2e` is replaced by TKT-foundation-006), `pnpm-workspace.yaml` (`apps/*`, `packages/*`), `tsconfig.base.json` (TypeScript strict), ESLint flat config covering all three packages, and **extend** the repo `.gitignore` (node_modules, dist, `.env`, coverage, Playwright artifacts), `apps/api/.env.example` (`DATABASE_URL`, `PORT`, `LOG_LEVEL`, `ARGON2_*` with the §7 defaults, `COOKIE_SECURE` — arch §8.5).
  - `apps/api`: NestJS skeleton (`main.ts`, `app.module.ts`, `nest-cli.json`) that builds and boots.
  - `apps/web`: Vite + React skeleton (`index.html`, `src/main.tsx` placeholder, `vite.config.ts`) that builds.
  - `packages/shared`: package skeleton with a placeholder `src/index.ts`.
  - **Install the full architecture-fixed dependency baseline here, once** (so later tickets avoid lockfile churn — see audit note): root devDeps (typescript, eslint + typescript-eslint, vitest, supertest, fast-check); `apps/api` (NestJS platform, helmet, cookie-parser, pino, argon2, `@prisma/client`; devDeps: prisma CLI, class-validator/class-transformer or the chosen validation library); `apps/web` (react, react-dom, react-router-dom; devDeps: `@playwright/test`). Commit `pnpm-lock.yaml`.
  - **Must NOT touch**: `.pipeline/**`; `apps/api/prisma/**` (TKT-foundation-002); `packages/shared/src/**` beyond the placeholder export (TKT-foundation-003); `apps/api/src/**` beyond the minimal boot skeleton (TKT-foundation-004 owns the platform); `.github/workflows/**` (TKT-foundation-007); `apps/web/src/**` beyond the placeholder (TKT-foundation-005).
- Traces to: Foundation (brief §7 stack/hosting constraints; arch 01 §1)
- Acceptance (explicit criteria — foundation carries no TCs):
  1. Fresh clone → `pnpm install --frozen-lockfile` succeeds (lockfile committed).
  2. `pnpm lint` exits 0; `pnpm typecheck` exits 0 across `apps/api`, `apps/web`, `packages/shared`.
  3. `pnpm build` compiles `packages/shared` → `apps/api` (nest build) → `apps/web` (vite build) in that order, producing `apps/api/dist` and `apps/web/dist`.
  4. The api skeleton boots and listens on `PORT` given a valid env; the web dev server renders the placeholder page.
  5. `pnpm test` and `pnpm test:e2e` exit 0 as marked stubs.
- Architecture refs: 01-system-architecture.md §1 (repository layout), §4 (stack table: pnpm workspaces, TypeScript strict, Node 24); 04-ci-pipeline.md §3 (root script contract)
- Dependencies: none
- Parallel group: none — every other ticket builds on this one

**Audit note:** sole owner of the root `package.json` / `pnpm-lock.yaml` dependency baseline. Later tickets must not add dependencies unless they are their group's designated lockfile-eligible ticket (P-1: TKT-foundation-002; P-2: TKT-foundation-004).
