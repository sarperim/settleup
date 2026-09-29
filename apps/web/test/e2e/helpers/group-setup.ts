import { expect, type Browser, type Page } from '@playwright/test';

import { register, type Credentials } from './auth';

/**
 * Shared group-shaping UI helpers (promoted from the per-spec copies by
 * TKT-exp-006, review exp-005 C-3).
 *
 * Every e2e spec is self-contained: these helpers only compose user-visible
 * actions through the real SPA (register, create group, join by code, approve)
 * — they never call the API directly, so the journey (not a seed) is what the
 * test proves (00-test-strategy.md §5). The caller registers the `creator`
 * first; `createGroupViaUi` drives the create-group flow and returns the group
 * URL, join code and id.
 */

export interface GroupSetup {
  groupUrl: string;
  code: string;
  groupId: string;
}

/** Register `creator`, create a group through the UI, return its URL/code/id. */
export async function createGroupViaUi(
  page: Page,
  creator: Credentials,
  name: string,
): Promise<GroupSetup> {
  await register(page, creator);
  await page.getByRole('button', { name: 'Create group', exact: true }).click();
  await page.getByLabel('Group name').fill(name);
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page).toHaveURL(/\/groups\/[^/]+$/);
  const groupUrl = page.url();
  const code = ((await page.getByTestId('join-code').textContent()) ?? '').trim();
  expect(code).toMatch(/^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{8}$/);
  const groupId = new URL(groupUrl).pathname.split('/').filter(Boolean).pop() ?? '';
  return { groupUrl, code, groupId };
}

/** Open `/join/<code>`, confirm the request, and wait for the pending status. */
export async function requestToJoin(page: Page, code: string): Promise<void> {
  await page.goto(`/join/${code}`);
  await expect(page.getByTestId('join-group-name')).toBeVisible();
  await page.getByRole('button', { name: 'Request to join' }).click();
  await expect(page.getByTestId('join-request-pending')).toBeVisible();
}

/**
 * Register `member` in a fresh browser context, place a join request and have
 * the creator approve it from their handling view. The member's context is
 * closed; the creator page is left on the group view.
 */
export async function addApprovedMember(
  browser: Browser,
  creatorPage: Page,
  groupUrl: string,
  code: string,
  member: Credentials,
): Promise<void> {
  const memberContext = await browser.newContext();
  const memberPage = await memberContext.newPage();
  await register(memberPage, member);
  await requestToJoin(memberPage, code);

  await creatorPage.goto(groupUrl);
  const request = creatorPage.getByTestId('join-request-item');
  await expect(request).toHaveCount(1);
  await request.getByRole('button', { name: 'Approve' }).click();
  await expect(creatorPage.getByTestId('join-request-item')).toHaveCount(0);

  await memberContext.close();
}
