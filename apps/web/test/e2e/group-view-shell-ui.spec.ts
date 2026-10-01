import { expect, test } from '@playwright/test';

import { e2eIdentity, register } from './helpers/auth';
import { createGroupViaUi, requestToJoin } from './helpers/group-setup';

/**
 * TKT-ui-004 — Group view page shell & Expenses section (PG-006).
 *
 * Page-alignment coverage for the shell this ticket owns: the header region
 * (group name + the creator-only join code with its copy affordance), the
 * section navigation, and the Expenses section entry points. The ledger's list
 * rendering, the timed add-expense journey, logger-only edit/delete and the
 * cross-domain lifecycle stay covered by their existing TCs (TC-EXP-028…033,
 * TC-BAL-025) and are intentionally not duplicated here.
 *
 * Conventions match the rest of the e2e suite (00-test-strategy.md §2/§5): the
 * database is recreated per run; the case is self-contained, order-independent
 * and registers its own namespaced identities through the real UI.
 */

test('TKT-ui-004 — group view shell: header, section nav and Expenses section', async ({
  page,
  context,
  browser,
}) => {
  const nora = e2eIdentity('nora', 'Nora', 'password-1');
  // The copy affordance writes to the async Clipboard API.
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);

  const { groupUrl, code } = await createGroupViaUi(page, nora, 'Trip');
  await expect(page).toHaveURL(/\/groups\/[^/]+$/);

  // Header region: group name (PG-006) and, for the creator only, the join
  // code with its copy affordance (FR-GRP-002).
  await expect(page.getByRole('heading', { name: 'Trip' })).toBeVisible();
  const joinCode = page.getByTestId('join-code');
  await expect(joinCode).toHaveText(code);
  const copy = page.getByTestId('copy-join-code');
  await expect(copy).toBeVisible();
  await copy.click();
  await expect(page.getByRole('status')).toHaveText('Copied');
  // The code actually reached the clipboard (async Clipboard API).
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(code);

  // Section navigation: Expenses / Balances / Settle-up / Members, Expenses
  // active by default.
  const nav = page.getByRole('navigation', { name: 'Group sections' });
  for (const label of ['Expenses', 'Balances', 'Settle-up', 'Members']) {
    await expect(nav.getByRole('button', { name: label, exact: true })).toBeVisible();
  }
  await expect(nav.getByRole('button', { name: 'Expenses', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  // Expenses section: its own heading, the add-expense entry (PG-007) and the
  // empty state.
  await expect(page.getByRole('heading', { name: 'Expenses' })).toBeVisible();
  await expect(page.getByTestId('add-expense-link')).toBeVisible();
  await expect(page.getByTestId('expenses-empty')).toBeVisible();

  // Switching sections moves the active marker to the selected tab.
  await nav.getByRole('button', { name: 'Balances', exact: true }).click();
  await expect(nav.getByRole('button', { name: 'Balances', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('heading', { name: 'Balances' })).toBeVisible();

  // A non-creator member sees the group but never the join code or its copy
  // affordance (FR-GRP-002 — the server returns it to the creator only; the UI
  // gates on the same signal).
  const member = e2eIdentity('omar', 'Omar', 'password-1');
  const memberContext = await browser.newContext();
  const memberPage = await memberContext.newPage();
  await register(memberPage, member);
  await requestToJoin(memberPage, code);

  await page.goto(groupUrl);
  const joinRequest = page.getByTestId('join-request-item');
  await expect(joinRequest).toHaveCount(1);
  await joinRequest.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByTestId('join-request-item')).toHaveCount(0);

  await memberPage.goto(groupUrl);
  await expect(memberPage.getByRole('heading', { name: 'Trip' })).toBeVisible();
  await expect(memberPage.getByTestId('join-code')).toHaveCount(0);
  await expect(memberPage.getByTestId('copy-join-code')).toHaveCount(0);
  await memberContext.close();
});
