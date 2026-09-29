import { expect, test, type Locator, type Page } from '@playwright/test';

import { e2eIdentity, login } from './helpers/auth';
import {
  balanceItemFor,
  openBalancesTab,
  openSettleUpTab,
  setupGroupWithExactExpense,
} from './helpers/settlement-setup';
import { PAGE_LOAD_BUDGET_MS } from './helpers/timing';

/**
 * Balances & settle-up UI e2e — TC-BAL-021, TC-BAL-022, TC-BAL-023, TC-BAL-024
 * and TC-BAL-026 (testing/balances-settlement.md §2).
 *
 * Conventions (plan §2 + 00-test-strategy.md §5): the e2e database is recreated
 * per run; every case is self-contained — it registers its own unique
 * identities through the UI as in-test setup and depends on no other case
 * (order-independent). Identities are namespaced by `e2eIdentity`
 * (helpers/auth.ts): the plan's local parts, display names and passwords are
 * preserved. Scenario data (group, membership, expense) is created through the
 * UI, never seeded behind the API, so the journey is what the test proves.
 * Exact splits are used so amounts are deterministic (strategy T5).
 *
 * TC-BAL-026's page-load timing follows 00-test-strategy.md §3 (T4): median of
 * 3 measurements, one retry on a breach of the SC budget (2.0 s for
 * NFR-BAL-004). Since the balances and settle-up surfaces are tabs of the
 * group view (03-api-design.md §6, one route), a sample is measured as the
 * time from navigating to the group route until the tab's data is rendered.
 */
function median(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

/** Open `tab` on the group route and wait for `ready`; median of 3, one retry on breach. */
async function measureTabMedian(
  page: Page,
  groupPath: string,
  tab: 'Balances' | 'Settle-up',
  ready: Locator,
): Promise<number> {
  async function medianOfThree(): Promise<number> {
    const samples: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      const started = Date.now();
      await page.goto(groupPath, { waitUntil: 'load' });
      await expect(page.getByRole('heading', { name: 'Trip' })).toBeVisible();
      await page.getByRole('button', { name: tab, exact: true }).click();
      await expect(ready).toBeVisible();
      samples.push(Date.now() - started);
    }
    return median(samples);
  }
  let measured = await medianOfThree();
  if (measured > PAGE_LOAD_BUDGET_MS) {
    measured = await medianOfThree();
  }
  return measured;
}

test('TC-BAL-021 — balances view through the UI', async ({ page, browser }) => {
  test.setTimeout(60_000);
  const dana = e2eIdentity('dana', 'Dana', 'password-1');
  const emre = e2eIdentity('emre', 'Emre', 'password-1');

  // In-test setup: dana creates the group, emre joins via approval; dana logs
  // 90.00 paid by dana, exact split {dana: 30.00, emre: 60.00}.
  const { groupUrl } = await setupGroupWithExactExpense(page, browser, {
    creator: dana,
    member: emre,
    groupName: 'Trip',
    expense: {
      description: 'Dinner',
      amount: '90.00',
      exacts: { Dana: '30.00', Emre: '60.00' },
    },
  });

  // Browser authenticated as emre (a member, not the logger).
  const emreContext = await browser.newContext();
  const emrePage = await emreContext.newPage();
  await login(emrePage, emre.email, emre.password);
  await emrePage.goto(groupUrl);
  await openBalancesTab(emrePage);

  // Expected: both members are shown by display name with their derived
  // balances, which visibly sum to zero.
  await expect(emrePage.getByTestId('balance-item')).toHaveCount(2);
  await expect(balanceItemFor(emrePage, 'Dana').getByTestId('balance-amount')).toHaveText('+60.00');
  await expect(balanceItemFor(emrePage, 'Emre').getByTestId('balance-amount')).toHaveText('-60.00');
  await expect(emrePage.getByTestId('balance-sum')).toHaveText('Total: 0.00');

  // FR-ACC-008: no email in the balances surface.
  const bodyText = await emrePage.locator('body').innerText();
  expect(bodyText).not.toContain(dana.email);
  expect(bodyText).not.toContain(emre.email);

  await emreContext.close();
});

test('TC-BAL-022 — settle-up view incl. the sub-lira suggestion', async ({ page, browser }) => {
  test.setTimeout(60_000);
  const ferit = e2eIdentity('ferit', 'Ferit', 'password-1');
  const gokce = e2eIdentity('gokce', 'Gökçe', 'password-1');

  // In-test setup: ferit logs 0.01 paid by ferit, exact split
  // {ferit: 0.00, gokce: 0.01} — deterministic, no remainder draw.
  const { groupUrl } = await setupGroupWithExactExpense(page, browser, {
    creator: ferit,
    member: gokce,
    groupName: 'Trip',
    expense: {
      description: 'Sub-lira',
      amount: '0.01',
      exacts: { Ferit: '0.00', Gökçe: '0.01' },
    },
  });

  const gokceContext = await browser.newContext();
  const gokcePage = await gokceContext.newPage();
  await login(gokcePage, gokce.email, gokce.password);
  await gokcePage.goto(groupUrl);
  await openSettleUpTab(gokcePage);

  // Expected: exactly one outstanding suggestion, sub-lira rendered exactly
  // (never rounded); the settled list is empty.
  await expect(gokcePage.getByTestId('outstanding-item')).toHaveCount(1);
  await expect(gokcePage.getByTestId('outstanding-text')).toHaveText('Gökçe pays Ferit ₺0.01');
  await expect(gokcePage.getByTestId('settled-empty')).toBeVisible();

  await gokceContext.close();
});

test('TC-BAL-023 — mark a payment as paid through the UI', async ({ page, browser }) => {
  test.setTimeout(60_000);
  const hale = e2eIdentity('hale', 'Hale', 'password-1');
  const ilhan = e2eIdentity('ilhan', 'Ilhan', 'password-1');

  // In-test setup: ilhan owes hale 60.00 after hale's exact-split expense.
  const { groupUrl } = await setupGroupWithExactExpense(page, browser, {
    creator: hale,
    member: ilhan,
    groupName: 'Trip',
    expense: {
      description: 'Dinner',
      amount: '90.00',
      exacts: { Hale: '30.00', Ilhan: '60.00' },
    },
  });

  // Step: as ilhan (the payer), open settle-up and mark the payment paid.
  const ilhanContext = await browser.newContext();
  const ilhanPage = await ilhanContext.newPage();
  await login(ilhanPage, ilhan.email, ilhan.password);
  await ilhanPage.goto(groupUrl);
  await openSettleUpTab(ilhanPage);
  await expect(ilhanPage.getByTestId('outstanding-text')).toHaveText('Ilhan pays Hale ₺60.00');
  await ilhanPage.getByTestId('mark-paid').click();

  // Expected: the suggestion leaves outstanding; the settled list shows it.
  await expect(ilhanPage.getByTestId('outstanding-empty')).toBeVisible();
  const settled = ilhanPage.getByTestId('settled-item');
  await expect(settled).toHaveCount(1);
  await expect(settled).toHaveAttribute('data-status', 'SETTLED');
  await expect(settled.getByTestId('settled-text')).toHaveText('Ilhan pays Hale ₺60.00');

  // …and the balances view shows 0.00 for both members (nothing owed).
  await openBalancesTab(ilhanPage);
  await expect(balanceItemFor(ilhanPage, 'Hale').getByTestId('balance-amount')).toHaveText('0.00');
  await expect(balanceItemFor(ilhanPage, 'Ilhan').getByTestId('balance-amount')).toHaveText('0.00');
  await expect(ilhanPage.getByTestId('balance-sum')).toHaveText('Total: 0.00');

  await ilhanContext.close();
});

test('TC-BAL-024 — undo a settlement through the UI', async ({ page, browser }) => {
  test.setTimeout(60_000);
  const jale = e2eIdentity('jale', 'Jale', 'password-1');
  const kaan = e2eIdentity('kaan', 'Kaan', 'password-1');

  const { groupUrl } = await setupGroupWithExactExpense(page, browser, {
    creator: jale,
    member: kaan,
    groupName: 'Trip',
    expense: {
      description: 'Dinner',
      amount: '90.00',
      exacts: { Jale: '30.00', Kaan: '60.00' },
    },
  });

  // Precondition completed through the UI: kaan settles the payment.
  const kaanContext = await browser.newContext();
  const kaanPage = await kaanContext.newPage();
  await login(kaanPage, kaan.email, kaan.password);
  await kaanPage.goto(groupUrl);
  await openSettleUpTab(kaanPage);
  await kaanPage.getByTestId('mark-paid').click();
  await expect(kaanPage.getByTestId('outstanding-empty')).toBeVisible();
  const settled = kaanPage.getByTestId('settled-item');
  await expect(settled).toHaveAttribute('data-status', 'SETTLED');

  // Step: as kaan (either party), undo the settled payment.
  await settled.getByTestId('undo-settlement').click();

  // Expected: the equivalent suggestion returns to outstanding; the settled
  // list retains the entry, marked undone; balances revert.
  await expect(kaanPage.getByTestId('outstanding-item')).toHaveCount(1);
  await expect(kaanPage.getByTestId('outstanding-text')).toHaveText('Kaan pays Jale ₺60.00');
  await expect(settled).toHaveCount(1);
  await expect(settled).toHaveAttribute('data-status', 'UNDONE');
  await expect(settled.getByTestId('settled-undone')).toBeVisible();

  await openBalancesTab(kaanPage);
  await expect(balanceItemFor(kaanPage, 'Jale').getByTestId('balance-amount')).toHaveText('+60.00');
  await expect(balanceItemFor(kaanPage, 'Kaan').getByTestId('balance-amount')).toHaveText('-60.00');
  await expect(kaanPage.getByTestId('balance-sum')).toHaveText('Total: 0.00');

  await kaanContext.close();
});

test('TC-BAL-026 — balance and settle-up tabs meet the page-load budget', async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  const nadia = e2eIdentity('nadia', 'Nadia', 'password-1');
  const ozan = e2eIdentity('ozan', 'Ozan', 'password-1');

  // Self-contained setup: one group with an expense and one outstanding
  // suggestion (Ozan owes Nadia 30.00).
  const { groupUrl, groupPath } = await setupGroupWithExactExpense(page, browser, {
    creator: nadia,
    member: ozan,
    groupName: 'Trip',
    expense: {
      description: 'Dinner',
      amount: '60.00',
      exacts: { Nadia: '30.00', Ozan: '30.00' },
    },
  });
  // Defensive: the setup must indeed leave an outstanding suggestion.
  await page.goto(groupUrl);
  await openSettleUpTab(page);
  await expect(page.getByTestId('outstanding-item')).toHaveCount(1);
  await openBalancesTab(page);
  await expect(page.getByTestId('balance-item')).toHaveCount(2);

  // Measure both tabs per T4; each page's median must be ≤ 2.0 s.
  const balancesMedian = await measureTabMedian(
    page,
    groupPath,
    'Balances',
    page.getByTestId('balance-list'),
  );
  const settleUpMedian = await measureTabMedian(
    page,
    groupPath,
    'Settle-up',
    page.getByTestId('outstanding-list'),
  );

  test.info().annotations.push({
    type: 'timing',
    description: `balances tab median ${balancesMedian}ms; settle-up tab median ${settleUpMedian}ms`,
  });
  expect(balancesMedian, 'median balances tab load (ms)').toBeLessThanOrEqual(PAGE_LOAD_BUDGET_MS);
  expect(settleUpMedian, 'median settle-up tab load (ms)').toBeLessThanOrEqual(PAGE_LOAD_BUDGET_MS);
});
