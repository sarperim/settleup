import { expect, test } from '@playwright/test';

import { e2eIdentity, register } from './helpers/auth';

/**
 * Groups UI e2e — TC-GRP-026 (testing/groups-membership.md §2).
 *
 * Conventions: fresh e2e database per run; the case is self-contained — it
 * registers its own identity through the UI as in-test setup and depends on no
 * other case (order-independent, per the groups plan's e2e conventions). The
 * identity is namespaced by `e2eIdentity` (see `helpers/auth.ts`): the plan's
 * local part is `gina`, the display name and password are as the plan states.
 */
test('TC-GRP-026 — create a group through the UI', async ({ page }) => {
  const gina = e2eIdentity('gina', 'Gina', 'password-1');
  // In-test setup: register gina through the UI; the SPA lands on the groups
  // overview (`/`), browser authenticated as gina.
  await register(page, gina);
  await expect(page).toHaveURL('/');

  // Step: from the groups overview choose create group …
  await page.getByRole('button', { name: 'Create group', exact: true }).click();
  // … enter the name "Trip", and submit.
  await page.getByLabel('Group name').fill('Trip');
  await page.getByRole('button', { name: 'Create', exact: true }).click();

  // Expected: the SPA navigates to the group view for "Trip" …
  await expect(page).toHaveURL(/\/groups\/[^/]+$/);
  await expect(page.getByRole('heading', { name: 'Trip' })).toBeVisible();

  // … the join code is displayed to gina (creator) — an 8-char Crockford
  // base32 code (`0123456789ABCDEFGHJKMNPQRSTVWXYZ`) …
  const joinCode = page.getByTestId('join-code');
  await expect(joinCode).toBeVisible();
  await expect(joinCode).toHaveText(/^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{8}$/);

  // … and the members surface shows gina as the (only) member.
  await page.getByRole('button', { name: 'Members', exact: true }).click();
  const members = page.getByTestId('member-list').getByTestId('member-item');
  await expect(members).toHaveCount(1);
  await expect(members.first()).toContainText('Gina');
  await expect(page.getByTestId('member-creator-badge')).toBeVisible();
});
