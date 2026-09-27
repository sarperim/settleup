import { expect, test } from '@playwright/test';

import { e2eIdentity, login, logout, register } from './helpers/auth';
import { SPA_ROUTES } from '../../src/routes';

/**
 * Auth UI e2e — TC-ACC-023…026 (testing/accounts-access.md §2).
 *
 * Conventions: fresh e2e database per run; every case is self-contained with
 * its own unique fixed identity registered through the UI, so no case depends
 * on another (order-independent; Gate 2 F3). Identities are namespaced by
 * `e2eIdentity` — see the helper for why (system-phase collision, CI retries).
 */

test('TC-ACC-023 — register through the UI lands the user in the app', async ({ page }) => {
  await register(page, e2eIdentity('alice', 'Alice', 'password-1'));

  // The SPA landed on the groups overview with no login step in between …
  await expect(page).toHaveURL('/');
  // … Alice's display name (never her email) is visible in the shell …
  await expect(page.getByText('Alice')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();
  // … and no email-verification step of any kind appears (BR-ACC-008).
  await expect(page.getByText(/verif/i)).toHaveCount(0);
});

test('TC-ACC-024 — login through the UI reaches the groups overview', async ({ page }) => {
  // Self-contained in-test setup: register bob through the UI, then log out.
  const bob = e2eIdentity('bob', 'Bob', 'password-1');
  await register(page, bob);
  await logout(page);
  await expect(page).toHaveURL('/login');

  await login(page, bob.email, bob.password);

  await expect(page).toHaveURL('/');
  await expect(page.getByText('Bob')).toBeVisible();
});

test('TC-ACC-025 — logout ends the UI session; protected routes redirect anonymous visitors', async ({
  page,
}) => {
  // Self-contained in-test setup: register carol through the UI, landing in the app.
  await register(page, e2eIdentity('carol', 'Carol', 'password-1'));
  await expect(page).toHaveURL('/');

  // NOTE (flagged, TKT-accounts-005): the accounts plan's precondition also has
  // the test create a group "Trip" from the groups overview to obtain a real
  // `:groupId`. That overview/create-group UI (and the groups API it would call)
  // is TKT-groups-004's deliverable and does not exist in this worktree, so the
  // protected deep link below uses a placeholder id. The redirect guard fires
  // before any group data is requested, so the ticket-owned assertions —
  // logout ends the session and anonymous protected access redirects to
  // `/login` with no group/expense/balance data rendered — are fully exercised.

  // Step 1: trigger logout from the UI -> browser is at /login.
  await logout(page);
  await expect(page).toHaveURL('/login');
  await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();

  // Step 2: navigate to a protected deep link while anonymous -> redirected to /login.
  await page.goto(SPA_ROUTES.groupView('trip-placeholder'));
  await expect(page).toHaveURL('/login');
  await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
  // No group, expense, or balance surface is rendered.
  await expect(page.getByRole('heading', { name: 'Group' })).toHaveCount(0);
});

test('TC-ACC-026 — change password through the UI', async ({ page }) => {
  // Self-contained in-test setup: register dave with password-1.
  const dave = e2eIdentity('dave', 'Dave', 'password-1');
  await register(page, dave);

  await page.goto(SPA_ROUTES.changePassword);
  await page.getByLabel('Current password').fill(dave.password);
  await page.getByLabel('New password').fill('password-2');
  await page.getByRole('button', { name: 'Change password' }).click();

  // Change confirmed in the UI (the acting session survives — D-ARCH-002).
  await expect(page.getByText('Password changed')).toBeVisible();

  // The new password logs in …
  await logout(page);
  await login(page, dave.email, 'password-2');
  await expect(page).toHaveURL('/');

  // … and the old password is rejected on /login (error shown, stays there).
  await logout(page);
  await expect(page).toHaveURL('/login');
  await page.getByLabel('Email').fill(dave.email);
  await page.getByLabel('Password', { exact: true }).fill(dave.password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL('/login');
  await expect(page.getByRole('alert')).toBeVisible();
});
