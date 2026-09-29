import { expect, type Browser, type Locator, type Page } from '@playwright/test';

import { addApprovedMember, createGroupViaUi } from './group-setup';
import type { Credentials } from './auth';

/**
 * Balances & settle-up UI helpers (TKT-bal-006).
 *
 * Every e2e spec is self-contained: these helpers only compose user-visible
 * actions through the real SPA (add an exact-split expense, open a tab) — they
 * never call the API directly, so the journey (not a seed) is what the test
 * proves (00-test-strategy.md §5). Exact splits are deterministic (no random
 * remainder draw), which is what lets TC-BAL-021…024 assert concrete amounts
 * (strategy T5).
 */

export interface ExactExpenseInput {
  description: string;
  /** Total amount text, e.g. `"90.00"`. */
  amount: string;
  /** Payer display name; omit to keep the acting-user default. */
  payerLabel?: string;
  /** Participant display name → exact share text (must sum to `amount`). */
  exacts: Record<string, string>;
}

/**
 * Log an exact-split expense through the single-screen add-expense form
 * (UC-EXP-001) and wait for the ledger entry. Participants default to all
 * members; the exact inputs are keyed by the participant's display name within
 * the "Exact amounts" fieldset.
 */
export async function logExactExpense(page: Page, input: ExactExpenseInput): Promise<void> {
  await page.getByTestId('add-expense-link').click();
  await expect(page.getByRole('heading', { name: 'Add expense' })).toBeVisible();
  await page.getByLabel('Description').fill(input.description);
  await page.getByLabel('Amount').fill(input.amount);
  if (input.payerLabel !== undefined) {
    await page.getByLabel('Payer').selectOption({ label: input.payerLabel });
  }
  await page.getByRole('radio', { name: 'Exact', exact: true }).check();
  const exactGroup = page.getByRole('group', { name: 'Exact amounts' });
  await expect(exactGroup).toBeVisible();
  for (const [displayName, amount] of Object.entries(input.exacts)) {
    await exactGroup.getByLabel(displayName).fill(amount);
  }
  await page.getByRole('button', { name: 'Save expense' }).click();
  await expect(page).toHaveURL(/\/groups\/[^/]+$/);
  await expect(page.getByTestId('expense-item')).toHaveCount(1);
}

export interface TwoMemberGroup {
  groupUrl: string;
  code: string;
  groupPath: string;
}

/**
 * Register `creator`, create `groupName`, add + approve `member`, and log one
 * exact-split expense via the UI. Leaves the creator's page on the group view.
 */
export async function setupGroupWithExactExpense(
  page: Page,
  browser: Browser,
  input: {
    creator: Credentials;
    member: Credentials;
    groupName: string;
    expense: ExactExpenseInput;
  },
): Promise<TwoMemberGroup> {
  const { groupUrl, code } = await createGroupViaUi(page, input.creator, input.groupName);
  await addApprovedMember(browser, page, groupUrl, code, input.member);
  await page.goto(groupUrl);
  await expect(page.getByRole('heading', { name: input.groupName })).toBeVisible();
  await logExactExpense(page, input.expense);
  return { groupUrl, code, groupPath: new URL(groupUrl).pathname };
}

/** Open the group view's Balances tab and wait for the rendered list. */
export async function openBalancesTab(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Balances', exact: true }).click();
  const list = page.getByTestId('balance-list');
  await expect(list).toBeVisible();
  return list;
}

/**
 * Open the group view's Settle-up tab and wait for the outstanding surface
 * (the list when suggestions exist, the empty note otherwise).
 */
export async function openSettleUpTab(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Settle-up', exact: true }).click();
  await expect(
    page.getByTestId('outstanding-list').or(page.getByTestId('outstanding-empty')),
  ).toBeVisible();
}

/** The `balance-item` row for `displayName` (members are rendered by name). */
export function balanceItemFor(page: Page, displayName: string): Locator {
  return page.getByTestId('balance-item').filter({ hasText: displayName });
}
