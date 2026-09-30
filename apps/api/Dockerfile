# syntax=docker/dockerfile:1

# Settle Up api image (01-system-architecture.md §10).
#
# Build context is the **repository root** (a pnpm-workspace monorepo), because
# the api depends on `packages/shared` and the single container serves the SPA
# built from `apps/web`. `docker compose` wires this up (see docker-compose.yml).
#
# The image carries the compiled api (`apps/api/dist`), the compiled shared
# package, the built SPA (`apps/web/dist`, resolved by the api at
# `../../web/dist`) and the Prisma CLI so the owner can run
# `npx prisma migrate deploy` in a one-off container.

# ── Stage 1: build ──────────────────────────────────────────────────────────
# The full (non-slim) image ships the C toolchain that argon2 / Prisma native
# engine installation may need when no prebuilt binary matches this Node ABI.
FROM node:24-bookworm AS build

# Pin the package manager to the `packageManager` field in package.json.
RUN npm install -g pnpm@10.34.5

WORKDIR /app

# Dependency layer (cache-friendly): manifests only, then install from the
# frozen lockfile (mirrors CI step 1, 04-ci-pipeline.md §4).
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile

# Source layer. `.dockerignore` keeps host `node_modules`/`dist` out.
COPY . .

# Generate the Prisma client against the committed schema, then build the
# workspace in its required order: shared → api → web (04-ci-pipeline.md §3).
RUN pnpm --filter api exec prisma generate \
 && pnpm build

# ── Stage 2: runtime ────────────────────────────────────────────────────────
FROM node:24-bookworm-slim AS runtime

# openssl: Prisma's query engine links against it on Debian.
# hadolint ignore=DL3008
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
# The workspace's node_modules (pnpm symlink layout), the generated Prisma
# client, and every build output travel together from the build stage.
COPY --from=build /app /app

# Run from `apps/api` so `dist/main.js`, `dist/scripts/set-password.js` and
# `prisma/schema.prisma` all resolve exactly as arch §10 documents.
WORKDIR /app/apps/api

ENV NODE_ENV=production
EXPOSE 3007

CMD ["node", "dist/main.js"]
