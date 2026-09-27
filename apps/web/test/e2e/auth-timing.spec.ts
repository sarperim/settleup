import { expect, test } from '@playwright/test';

import { e2eIdentity, register } from './helpers/auth';
import { PAGE_LOAD_BUDGET_MS, measureMedianPageLoad } from './helpers/timing';

/**
 * TC-ACC-027 — the auth pages meet the page-load budget (NFR-ACC-003, SC-004).
 *
 * Self-contained: register erin through the UI first so `/change-password` (a
 * protected route, UC-ACC-006) renders instead of redirecting to `/login`.
 * Timing per strategy §3 T4: median of 3, one retry on breach, ≤ 2.0 s gate.
 */
test('TC-ACC-027 — auth pages meet the page-load budget', async ({ page }) => {
  await register(page, e2eIdentity('erin', 'Erin', 'password-1'));

  const routes = ['/login', '/register', '/change-password'] as const;
  for (const route of routes) {
    const median = await measureMedianPageLoad(page, route);
    expect(median, `median load of ${route} (ms)`).toBeLessThanOrEqual(PAGE_LOAD_BUDGET_MS);
  }
});
