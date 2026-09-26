import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright e2e configuration (TKT-foundation-006; 04-ci-pipeline.md §3/§4,
 * testing/00-test-strategy.md §2/§8).
 *
 * The deployable artifact is a **single origin**: the built API serves the
 * built SPA and the JSON API from one port (01-system-architecture.md §2 C1).
 * So `webServer` boots exactly that artifact — `apps/api/dist/main.js`, which
 * serves `apps/web/dist/index.html` — against `E2E_DATABASE_URL`. Both
 * `pnpm build` and the e2e database create/migrate are prerequisites performed
 * by the root `test:e2e` script and CI step 4.
 *
 * `E2E_DATABASE_URL` is required: without it the app cannot boot, so the
 * config fails immediately with an actionable message rather than a Playwright
 * webServer timeout.
 */
const configDir = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.resolve(configDir, '..', 'api');

const port = Number(process.env.E2E_PORT ?? 3011);
const databaseUrl = process.env.E2E_DATABASE_URL?.trim();

if (!databaseUrl) {
  throw new Error(
    [
      'E2E_DATABASE_URL is required to run the Playwright e2e suite.',
      '',
      'The e2e level boots the built app against a real PostgreSQL',
      '(00-test-strategy.md §2), so it needs its own database, separate from',
      'DATABASE_URL. The root `pnpm test:e2e` script creates it and applies',
      'Prisma migrations before Playwright starts.',
    ].join('\n'),
  );
}

/** Inherit the ambient environment (PATH, HOME, …) for the booted process. */
const serverEnv = Object.fromEntries(
  Object.entries(process.env).filter(
    (entry): entry is [string, string] => entry[1] !== undefined,
  ),
);

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // CI shows the GitHub annotations; locally the plain list reporter is enough.
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node dist/main.js',
    cwd: apiDir,
    url: `http://127.0.0.1:${port}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      ...serverEnv,
      PORT: String(port),
      // The e2e database — never the integration DATABASE_URL.
      DATABASE_URL: databaseUrl,
      COOKIE_SECURE: 'true',
      LOG_LEVEL: 'error',
    },
  },
});
