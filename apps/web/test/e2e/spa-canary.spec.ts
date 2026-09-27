import { expect, test } from '@playwright/test';

/**
 * E2E harness canary (TKT-foundation-006, acceptance criterion 4; updated by
 * TKT-accounts-005).
 *
 * The smallest proof that the browser-level harness works: the built app boots
 * against the e2e database and serves the built SPA, and the SPA actually
 * mounts and renders — not just that `index.html` was returned.
 *
 * TKT-accounts-005 made `/` a protected route (UC-ACC-006): an anonymous visit
 * now redirects to `/login`, so the canary asserts the SPA mounted by checking
 * the rendered login page. It stays read-only and self-contained.
 */
test('loads the built SPA: anonymous / redirects to the rendered login page', async ({
  page,
}) => {
  const response = await page.goto('/');

  expect(response?.status()).toBe(200);

  // The root layout chrome renders …
  await expect(page.getByText('Settle Up')).toBeVisible();
  // … the SPA's protected-route guard redirected an anonymous visitor to
  // `/login` (client-served; index.html ships an empty #root) …
  await expect(page).toHaveURL('/login');
  await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
  // … and the client router mounted the route's content into #root.
  await expect(page.locator('#root')).not.toBeEmpty();
});
