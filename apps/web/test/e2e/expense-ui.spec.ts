import { expect, test, type Request } from '@playwright/test';

import { e2eIdentity } from './helpers/auth';
import { addApprovedMember, createGroupViaUi } from './helpers/group-setup';

/**
 * Expense UI e2e — TC-EXP-028 and TC-EXP-031 (testing/expense-tracking.md §2).
 *
 * Conventions: the e2e database is recreated per run; every case is
 * self-contained — it registers its own unique identities through the UI as
 * in-test setup and depends on no other case (order-independent). Identities
 * are namespaced by `e2eIdentity` (see `helpers/auth.ts`): the plan's local
 * parts, display names and passwords are preserved.
 *
 * Timing follows 00-test-strategy.md §3 (T4): median of 3 with one retry on a
 * breach of the SC budget (30 s); the submit→visible sub-budget is measured,
 * logged and CI-enforced at 3× the 500 ms sub-budget (generous runner bound).
 */

const JOURNEY_BUDGET_MS = 30_000;
const SUBMIT_VISIBLE_BUDGET_MS = 500 * 3;

function median(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

test('TC-EXP-028 — add-expense journey through the UI within 30 seconds', async ({
  page,
  browser,
}) => {
  const sara = e2eIdentity('sara', 'Sara', 'password-1');
  const tomas = e2eIdentity('tomas', 'Tomás', 'password-1');
  const { groupUrl, code } = await createGroupViaUi(page, sara, 'Trip');
  await addApprovedMember(browser, page, groupUrl, code, tomas);

  // Precondition: browser authenticated as sara on the group page.
  await page.goto(groupUrl);
  await expect(page.getByRole('heading', { name: 'Trip' })).toBeVisible();

  /**
   * One timed journey: from the group view, reach the single-screen form,
   * assert the deterministic enablers (preselected participants, acting-user
   * payer), prove client-side validation makes no round-trip, then submit and
   * wait for the expense to be visible in the ledger.
   */
  async function runJourney(): Promise<{ journeyMs: number; submitToVisibleMs: number }> {
    const items = page.getByTestId('expense-item');
    const before = await items.count();

    const start = Date.now();

    // Step 1: reach the add-expense form; count the interactions.
    let interactions = 0;
    await page.getByTestId('add-expense-link').click();
    interactions += 1;
    await expect(page).toHaveURL(/\/groups\/[^/]+\/expenses\/new$/);
    expect(interactions, 'interactions to reach the form').toBeLessThanOrEqual(2);

    // Step 2: initial state — single screen, participants = all members
    // (preselected), payer = the acting user (sara).
    await expect(page.getByRole('heading', { name: 'Add expense' })).toBeVisible();
    const checkboxes = page.getByTestId('participant-checkbox');
    await expect(checkboxes).toHaveCount(2);
    for (const box of await checkboxes.all()) {
      await expect(box).toBeChecked();
    }
    await expect(page.getByLabel('Payer').locator('option:checked')).toHaveText('Sara');
    await expect(page.getByLabel('Description')).toBeVisible();
    await expect(page.getByLabel('Amount')).toBeVisible();
    await expect(page.getByLabel('Payer')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save expense' })).toBeVisible();

    // Step 3: an invalid amount shows an inline error with no round-trip.
    const expensePosts: string[] = [];
    const capture = (request: Request): void => {
      if (request.method() === 'POST' && request.url().includes('/expenses')) {
        expensePosts.push(request.url());
      }
    };
    page.on('request', capture);
    await page.getByLabel('Amount').fill('abc');
    await page.getByRole('button', { name: 'Save expense' }).click();
    await expect(page.getByTestId('amount-error')).toBeVisible();
    expect(expensePosts, 'no POST /expenses before a valid submit').toEqual([]);
    page.off('request', capture);

    // Step 4: valid input → submit → expense visible in the ledger.
    await page.getByLabel('Description').fill('Dinner');
    await page.getByLabel('Amount').fill('120.50');
    const submittedAt = Date.now();
    await page.getByRole('button', { name: 'Save expense' }).click();
    await expect(items).toHaveCount(before + 1);
    const created = items.first();
    await expect(created).toContainText('Dinner');
    await expect(created).toContainText('120.50');
    const visibleAt = Date.now();

    return { journeyMs: visibleAt - start, submitToVisibleMs: visibleAt - submittedAt };
  }

  const runs: Array<{ journeyMs: number; submitToVisibleMs: number }> = [];
  for (let i = 0; i < 3; i += 1) {
    runs.push(await runJourney());
  }
  let journeyMedian = median(runs.map((run) => run.journeyMs));
  let submitMedian = median(runs.map((run) => run.submitToVisibleMs));

  // T4: one retry of the whole median on a hard-gate breach.
  if (journeyMedian > JOURNEY_BUDGET_MS) {
    const retry: Array<{ journeyMs: number; submitToVisibleMs: number }> = [];
    for (let i = 0; i < 3; i += 1) {
      retry.push(await runJourney());
    }
    journeyMedian = median(retry.map((run) => run.journeyMs));
    submitMedian = median(retry.map((run) => run.submitToVisibleMs));
  }

  test.info().annotations.push({
    type: 'timing',
    description: `add-expense journey median ${journeyMedian}ms; submit→visible median ${submitMedian}ms`,
  });
  expect(journeyMedian, 'median add-expense journey (ms)').toBeLessThanOrEqual(JOURNEY_BUDGET_MS);
  expect(submitMedian, 'median submit→visible (ms)').toBeLessThanOrEqual(SUBMIT_VISIBLE_BUDGET_MS);
});

test('TC-EXP-031 — expense list UI renders identities by display name', async ({
  page,
  browser,
}) => {
  const yara = e2eIdentity('yara', 'Yara', 'password-1');
  const zane = e2eIdentity('zane', 'Zane', 'password-1');
  const { groupUrl, code } = await createGroupViaUi(page, yara, 'Trip');
  await addApprovedMember(browser, page, groupUrl, code, zane);

  await page.goto(groupUrl);
  await expect(page.getByRole('heading', { name: 'Trip' })).toBeVisible();

  // yara logs an expense paid by zane, splitting both members (BR-EXP-001:
  // any member may log; the payer need not be the logger).
  await page.getByTestId('add-expense-link').click();
  await expect(page.getByRole('heading', { name: 'Add expense' })).toBeVisible();
  await page.getByLabel('Description').fill('Dinner');
  await page.getByLabel('Amount').fill('20.00');
  await page.getByLabel('Payer').selectOption({ label: 'Zane' });
  await page.getByRole('button', { name: 'Save expense' }).click();

  // The ledger entry shows description, amount and the payer by display name.
  await expect(page.getByTestId('expense-item')).toHaveCount(1);
  const item = page.getByTestId('expense-item').first();
  await expect(item).toContainText('Dinner');
  await expect(item).toContainText('20.00');
  await expect(item).toContainText('Zane');
  await expect(item).toContainText('Yara');

  // FR-ACC-008: the rendered ledger carries display names only — never email.
  const ledgerText = (await page.getByTestId('expense-list').textContent()) ?? '';
  expect(ledgerText).not.toContain(yara.email);
  expect(ledgerText).not.toContain(zane.email);
  expect(ledgerText).not.toContain('@');
  const bodyText = await page.locator('body').innerText();
  expect(bodyText).not.toContain(yara.email);
  expect(bodyText).not.toContain(zane.email);
});
