import { expect, test, type Page } from '@playwright/test';

import { e2eIdentity, login } from './helpers/auth';
import { addApprovedMember, createGroupViaUi } from './helpers/group-setup';
import { findGroupExpenses, findUserIdsByEmails, seedEqualExpenses } from './helpers/seed';
import { PAGE_LOAD_BUDGET_MS, measureMedianPageLoad } from './helpers/timing';

/**
 * Expense edit/delete UI e2e — TC-EXP-029, TC-EXP-030, TC-EXP-032 and
 * TC-EXP-033 (testing/expense-tracking.md §2).
 *
 * Conventions: the e2e database is recreated per run; every case is
 * self-contained — it registers its own unique identities through the UI as
 * in-test setup and depends on no other case (order-independent). Identities
 * are namespaced by `e2eIdentity` (see `helpers/auth.ts`). Page-load timing
 * follows 00-test-strategy.md §3 (T4): median of 3 with one retry on a breach
 * of the SC budget (2.0 s for NFR-EXP-002/004). TC-EXP-033 seeds its
 * 50-expense scale fixture via direct Prisma (strategy §5; `helpers/seed.ts`)
 * and asserts the seed's share-sum invariant.
 */

/** Register `creator`, create "Trip", log one "Dinner" expense; leave on the ledger. */
async function setupGroupWithExpense(
  page: Page,
  amountText: string,
): Promise<{ groupUrl: string; editPath: string }> {
  await page.getByTestId('add-expense-link').click();
  await expect(page.getByRole('heading', { name: 'Add expense' })).toBeVisible();
  await page.getByLabel('Description').fill('Dinner');
  await page.getByLabel('Amount').fill(amountText);
  await page.getByRole('button', { name: 'Save expense' }).click();
  await expect(page.getByTestId('expense-item')).toHaveCount(1);

  const editPath = await page.getByTestId('edit-expense-link').getAttribute('href');
  expect(editPath, 'the logger sees the edit affordance').not.toBeNull();
  return { groupUrl: page.url(), editPath: editPath ?? '' };
}

test('TC-EXP-029 — edit an expense through the UI (logger only)', async ({ page, browser }) => {
  test.setTimeout(60_000);
  const uma = e2eIdentity('uma', 'Uma', 'password-1');
  const vic = e2eIdentity('vic', 'Vic', 'password-1');
  const { groupUrl, code } = await createGroupViaUi(page, uma, 'Trip');
  await addApprovedMember(browser, page, groupUrl, code, vic);

  // Precondition: uma has logged an expense via the UI.
  await page.goto(groupUrl);
  await expect(page.getByRole('heading', { name: 'Trip' })).toBeVisible();
  await setupGroupWithExpense(page, '30.00');

  // Step 1: as vic (member, not logger), the expense is visible but carries
  // no edit affordance (BR-EXP-007's UI aspect).
  const vicContext = await browser.newContext();
  const vicPage = await vicContext.newPage();
  await login(vicPage, vic.email, vic.password);
  await vicPage.goto(groupUrl);
  await expect(vicPage.getByTestId('expense-item')).toHaveCount(1);
  await expect(vicPage.getByTestId('expense-item')).toContainText('Dinner');
  await expect(vicPage.getByTestId('edit-expense-link')).toHaveCount(0);
  await vicContext.close();

  // Step 2: as uma, open the edit form, change the amount, save.
  await page.getByTestId('edit-expense-link').click();
  await expect(page.getByRole('heading', { name: 'Edit expense' })).toBeVisible();

  // The edit form is a single screen: every field is visible at once, and it
  // is prefilled from the expense detail.
  await expect(page.getByLabel('Description')).toBeVisible();
  await expect(page.getByLabel('Amount')).toBeVisible();
  await expect(page.getByLabel('Payer')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeVisible();
  await expect(page.getByLabel('Description')).toHaveValue('Dinner');
  await expect(page.getByLabel('Amount')).toHaveValue('30.00');
  await expect(page.getByLabel('Payer').locator('option:checked')).toHaveText('Uma');

  await page.getByLabel('Amount').fill('45.00');
  await page.getByRole('button', { name: 'Save changes' }).click();

  // Expected: the updated amount appears in the ledger.
  await expect(page).toHaveURL(/\/groups\/[^/]+$/);
  await expect(page.getByTestId('expense-item')).toHaveCount(1);
  await expect(page.getByTestId('expense-item').first()).toContainText('45.00');
});

test('TC-EXP-030 — delete an expense through the UI (logger only)', async ({ page, browser }) => {
  test.setTimeout(60_000);
  const wren = e2eIdentity('wren', 'Wren', 'password-1');
  const xavi = e2eIdentity('xavi', 'Xavi', 'password-1');
  const { groupUrl, code } = await createGroupViaUi(page, wren, 'Trip');
  await addApprovedMember(browser, page, groupUrl, code, xavi);

  // Precondition: wren has logged an expense via the UI.
  await page.goto(groupUrl);
  await expect(page.getByRole('heading', { name: 'Trip' })).toBeVisible();
  await setupGroupWithExpense(page, '30.00');

  // xavi (member, not logger) never sees a delete affordance.
  const xaviContext = await browser.newContext();
  const xaviPage = await xaviContext.newPage();
  await login(xaviPage, xavi.email, xavi.password);
  await xaviPage.goto(groupUrl);
  await expect(xaviPage.getByTestId('expense-item')).toHaveCount(1);
  await expect(xaviPage.getByTestId('delete-expense')).toHaveCount(0);
  await xaviContext.close();

  // As wren, delete the expense from the ledger.
  await page.getByTestId('delete-expense').click();
  await expect(page.getByTestId('expense-item')).toHaveCount(0);
  await expect(page.getByTestId('expenses-empty')).toBeVisible();
});

test('TC-EXP-032 — expense pages meet the page-load budget', async ({ page }) => {
  test.setTimeout(120_000);
  const abel = e2eIdentity('abel', 'Abel', 'password-1');
  const { groupUrl } = await createGroupViaUi(page, abel, 'Trip');

  // Self-contained setup: one group with ≥ 1 expense (so the ledger has
  // content) and a concrete edit route.
  await page.goto(groupUrl);
  await expect(page.getByRole('heading', { name: 'Trip' })).toBeVisible();
  const { editPath } = await setupGroupWithExpense(page, '20.00');

  const groupPath = new URL(groupUrl).pathname;
  const routes = [groupPath, `${groupPath}/expenses/new`, editPath] as const;
  for (const route of routes) {
    const median = await measureMedianPageLoad(page, route);
    expect(median, `median load of ${route} (ms)`).toBeLessThanOrEqual(PAGE_LOAD_BUDGET_MS);
  }
});

test('TC-EXP-033 — 50-expense ledger page within the page budget', async ({ page, browser }) => {
  test.setTimeout(120_000);
  const bella = e2eIdentity('bella', 'Bella', 'password-1');
  const cedric = e2eIdentity('cedric', 'Cedric', 'password-1');
  const { groupUrl, code, groupId } = await createGroupViaUi(page, bella, 'Trip');
  await addApprovedMember(browser, page, groupUrl, code, cedric);

  // Scenario data through the UI: bella (creator) and cedric (approved member).
  await page.goto(groupUrl);
  await expect(page.getByRole('heading', { name: 'Trip' })).toBeVisible();
  const userIds = await findUserIdsByEmails([bella.email, cedric.email]);
  const bellaId = userIds[bella.email];
  const cedricId = userIds[cedric.email];
  expect(bellaId, 'bella is registered').toBeDefined();
  expect(cedricId, 'cedric is registered').toBeDefined();

  // Scale fixture: 50 expenses seeded via direct Prisma (strategy §5).
  await seedEqualExpenses({
    groupId,
    payerId: bellaId as string,
    participantIds: [bellaId as string, cedricId as string],
    count: 50,
    amountKurus: 1000,
    descriptionPrefix: 'Seed expense',
  });

  // Seed validity: every seeded expense's shares sum exactly to its amount.
  const seeded = await findGroupExpenses(groupId);
  expect(seeded).toHaveLength(50);
  for (const expense of seeded) {
    const sum = expense.shares.reduce((total, share) => total + share.shareKurus, 0);
    expect(sum, `seeded expense ${expense.id} shares sum`).toBe(expense.amountKurus);
  }

  // Measure the ledger page (T4) with all 50 entries rendered.
  const median = await measureMedianPageLoad(page, new URL(groupUrl).pathname);
  await expect(page.getByTestId('expense-item')).toHaveCount(50);
  expect(median, 'median group ledger load (ms)').toBeLessThanOrEqual(PAGE_LOAD_BUDGET_MS);
});
