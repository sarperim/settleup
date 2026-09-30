import { expect, test } from '@playwright/test';

import { e2eIdentity, register } from './helpers/auth';
import { createGroupViaUi, requestToJoin } from './helpers/group-setup';
import { balanceItemFor, openBalancesTab, openSettleUpTab } from './helpers/settlement-setup';

/**
 * SC-007 full-lifecycle e2e — TC-BAL-025 (testing/balances-settlement.md §2;
 * 04-ci-pipeline.md §2 step 4, §8 traceability SC-007/SC-001).
 *
 * The adoption path in one self-contained journey against the production build:
 * register → create group → join by code + approve → log an expense → settle-up
 * → mark paid → undo → the debt is outstanding again (SC-007's terminal
 * assertion). It is the smoke the CI step-4 E2E phase boots on every push.
 *
 * Conventions (plan §2 + 00-test-strategy.md §5): the e2e database is recreated
 * per run; the case registers its own identities through the UI and depends on
 * no other case (order-independent). Identities are namespaced by `e2eIdentity`
 * (helpers/auth.ts) — the plan's local parts (`lale`, `mert`), display names and
 * passwords are preserved. Every action goes through the real SPA; the two
 * separate browser contexts keep lale's and mert's sessions independent. The
 * EQUAL split of 100.00 over two participants divides evenly (50.00/50.00), so
 * the amounts are deterministic (strategy T5).
 */
test('TC-BAL-025 — SC-007 full lifecycle end-to-end', async ({ page, browser }) => {
  test.setTimeout(90_000);
  const lale = e2eIdentity('lale', 'Lale', 'password-1');
  const mert = e2eIdentity('mert', 'Mert', 'password-1');

  // Step 1 — context 1 (lale): register, create group "Trip".
  const { groupUrl, code } = await createGroupViaUi(page, lale, 'Trip');

  // Step 2 — context 2 (mert): register, join "Trip" via the join code; lale
  // approves. Mert's context stays open for the undo (step 5).
  const mertContext = await browser.newContext();
  const mertPage = await mertContext.newPage();
  await register(mertPage, mert);
  await requestToJoin(mertPage, code);

  await page.goto(groupUrl);
  const joinRequest = page.getByTestId('join-request-item');
  await expect(joinRequest).toHaveCount(1);
  await joinRequest.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByTestId('join-request-item')).toHaveCount(0);

  // Step 3 — lale logs "Dinner" 100.00, payer lale, both participants, EQUAL
  // split (even division → deterministic 50.00/50.00).
  await page.goto(groupUrl);
  await page.getByTestId('add-expense-link').click();
  await expect(page.getByRole('heading', { name: 'Add expense' })).toBeVisible();
  await page.getByLabel('Description').fill('Dinner');
  await page.getByLabel('Amount').fill('100.00');
  await expect(page.getByLabel('Payer').locator('option:checked')).toHaveText('Lale');
  await expect(page.getByRole('radio', { name: 'Equal', exact: true })).toBeChecked();
  await expect(page.getByTestId('participant-checkbox')).toHaveCount(2);
  await page.getByRole('button', { name: 'Save expense' }).click();
  await expect(page).toHaveURL(/\/groups\/[^/]+$/);
  await expect(page.getByTestId('expense-item')).toHaveCount(1);

  // Step 4 — lale (the recipient of the suggestion) opens settle-up and marks
  // the suggested payment paid.
  await openSettleUpTab(page);
  await expect(page.getByTestId('outstanding-item')).toHaveCount(1);
  await expect(page.getByTestId('outstanding-text')).toHaveText('Mert pays Lale ₺50.00');
  await page.getByTestId('mark-paid').click();

  // Expected result 4 — after mark-paid: balances show 0.00 for both members;
  // the settled list contains the payment.
  await expect(page.getByTestId('outstanding-empty')).toBeVisible();
  const laleSettled = page.getByTestId('settled-item');
  await expect(laleSettled).toHaveCount(1);
  await expect(laleSettled).toHaveAttribute('data-status', 'SETTLED');
  await expect(laleSettled.getByTestId('settled-text')).toHaveText('Mert pays Lale ₺50.00');
  await openBalancesTab(page);
  await expect(balanceItemFor(page, 'Lale').getByTestId('balance-amount')).toHaveText('0.00');
  await expect(balanceItemFor(page, 'Mert').getByTestId('balance-amount')).toHaveText('0.00');
  await expect(page.getByTestId('balance-sum')).toHaveText('Total: 0.00');

  // Step 5 — context 2 (mert, the payer) undoes the settlement from the
  // settle-up view.
  await mertPage.goto(groupUrl);
  await openSettleUpTab(mertPage);
  const mertSettled = mertPage.getByTestId('settled-item');
  await expect(mertSettled).toHaveCount(1);
  await expect(mertSettled).toHaveAttribute('data-status', 'SETTLED');
  await mertSettled.getByTestId('undo-settlement').click();

  // Expected result 5 — after undo: the balances revert (lale +50.00,
  // mert −50.00); the payment is retained, listed as undone.
  await expect(mertSettled).toHaveCount(1);
  await expect(mertSettled).toHaveAttribute('data-status', 'UNDONE');
  await expect(mertSettled.getByTestId('settled-undone')).toBeVisible();
  await openBalancesTab(mertPage);
  await expect(balanceItemFor(mertPage, 'Lale').getByTestId('balance-amount')).toHaveText('+50.00');
  await expect(balanceItemFor(mertPage, 'Mert').getByTestId('balance-amount')).toHaveText('-50.00');
  await expect(mertPage.getByTestId('balance-sum')).toHaveText('Total: 0.00');

  // Step 6 / expected result 6 — context 2 opens settle-up and the outstanding
  // suggestion (mert → lale 50.00) is rendered again: the debt is outstanding
  // again (SC-007's terminal assertion).
  await openSettleUpTab(mertPage);
  await expect(mertPage.getByTestId('outstanding-item')).toHaveCount(1);
  await expect(mertPage.getByTestId('outstanding-text')).toHaveText('Mert pays Lale ₺50.00');

  await mertContext.close();
});
