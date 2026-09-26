import { expect, test } from '@playwright/test';

/**
 * E2E harness canary (TKT-foundation-006, acceptance criterion 4).
 *
 * The smallest proof that the browser-level harness works: the built app boots
 * against the e2e database and serves the built SPA, and the SPA actually
 * mounts and renders the `/` route (groups overview) — not just that
 * `index.html` was returned.
 *
 * SC-007/SC-003 journeys land with the domain e2e suites; this canary is
 * deliberately read-only and self-contained.
 */
test('loads the built SPA at / and renders the groups overview route', async ({
  page,
}) => {
  const response = await page.goto('/');

  expect(response?.status()).toBe(200);

  // The root layout chrome renders …
  await expect(page.getByText('Settle Up')).toBeVisible();
  // … and the client router mounted the `/` route's content into #root
  // (index.html ships an empty #root; a populated one proves the SPA ran).
  await expect(
    page.getByRole('heading', { name: 'Groups' }),
  ).toBeVisible();
  await expect(page.locator('#root')).not.toBeEmpty();
});
