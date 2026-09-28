import { expect, test, type Page } from '@playwright/test';

import { e2eIdentity, login, logout, register, type Credentials } from './helpers/auth';
import { PAGE_LOAD_BUDGET_MS, measureMedianPageLoad } from './helpers/timing';

/**
 * Join-flow UI e2e — TC-GRP-027…031 (testing/groups-membership.md §2).
 *
 * Conventions: the e2e database is recreated per run; every case is
 * self-contained — it registers its own unique identities through the UI as
 * in-test setup and depends on no other case (order-independent). Identities
 * are namespaced by `e2eIdentity` (see `helpers/auth.ts`): the plan's local
 * parts, display names and passwords are preserved.
 *
 * The join-request handling view lives inside the group view (`/groups/:id`)
 * as a creator-only "Join requests" section — it is a page region, not a §6
 * tab, so TC-GRP-031 measures it at the group-view URL's `#join-requests`
 * anchor.
 */

interface GroupSetup {
  groupUrl: string;
  code: string;
}

/** Register `creator`, create a group through the UI, return its URL and code. */
async function createGroupViaUi(page: Page, creator: Credentials, name: string): Promise<GroupSetup> {
  await register(page, creator);
  await page.getByRole('button', { name: 'Create group', exact: true }).click();
  await page.getByLabel('Group name').fill(name);
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page).toHaveURL(/\/groups\/[^/]+$/);
  const groupUrl = page.url();
  const code = ((await page.getByTestId('join-code').textContent()) ?? '').trim();
  expect(code).toMatch(/^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{8}$/);
  return { groupUrl, code };
}

/** Open `/join/<code>`, confirm the request, and wait for the pending status. */
async function requestToJoin(page: Page, code: string): Promise<void> {
  await page.goto(`/join/${code}`);
  await expect(page.getByTestId('join-group-name')).toBeVisible();
  await page.getByRole('button', { name: 'Request to join' }).click();
  await expect(page.getByTestId('join-request-pending')).toBeVisible();
}

test('TC-GRP-027 — join a group by code through the UI', async ({ page, browser }) => {
  const hank = e2eIdentity('hank', 'Hank', 'password-1');
  const iris = e2eIdentity('iris', 'Iris', 'password-1');
  const { groupUrl, code } = await createGroupViaUi(page, hank, 'Trip');

  const irisContext = await browser.newContext();
  const irisPage = await irisContext.newPage();
  await register(irisPage, iris);

  // Step 1: open `/join/<code>` — the group's name is shown before confirming.
  await irisPage.goto(`/join/${code}`);
  await expect(irisPage.getByTestId('join-group-name')).toHaveText('Trip');

  // Step 2: confirm — the request is placed and no membership exists yet.
  await irisPage.getByRole('button', { name: 'Request to join' }).click();
  await expect(irisPage.getByTestId('join-request-pending')).toBeVisible();
  await irisPage.goto('/');
  await expect(irisPage.getByText('You are not a member of any groups yet.')).toBeVisible();
  await expect(irisPage.getByRole('link', { name: 'Trip' })).toHaveCount(0);

  // Step 3: as hank (separate context), the handling view shows the one
  // pending request identified by iris's display name (never email).
  await page.goto(groupUrl);
  const request = page.getByTestId('join-request-item');
  await expect(request).toHaveCount(1);
  await expect(request).toContainText('Iris');

  await irisContext.close();
});

test('TC-GRP-028 — approve a join request through the UI', async ({ page, browser }) => {
  const jack = e2eIdentity('jack', 'Jack', 'password-1');
  const kate = e2eIdentity('kate', 'Kate', 'password-1');
  const { groupUrl, code } = await createGroupViaUi(page, jack, 'Trip');

  const kateContext = await browser.newContext();
  const katePage = await kateContext.newPage();
  await register(katePage, kate);
  await requestToJoin(katePage, code);

  // As jack, approve the pending request from the handling view.
  await page.goto(groupUrl);
  const request = page.getByTestId('join-request-item');
  await expect(request).toHaveCount(1);
  await request.getByRole('button', { name: 'Approve' }).click();
  await expect(request).toHaveCount(0);

  // The member list now shows both members by display name (FR-ACC-008).
  await page.getByRole('button', { name: 'Members', exact: true }).click();
  const memberList = page.getByTestId('member-list');
  await expect(memberList.getByTestId('member-item')).toHaveCount(2);
  await expect(memberList).toContainText('Jack');
  await expect(memberList).toContainText('Kate');

  // PR #17 R-1 (routed to this ticket): a non-creator never sees the join
  // code in the UI — the code is a creator-held secret (FR-GRP-002).
  await katePage.goto(groupUrl);
  await expect(katePage.getByRole('heading', { name: 'Trip' })).toBeVisible();
  await expect(katePage.getByTestId('join-code')).toHaveCount(0);

  await kateContext.close();
});

test('TC-GRP-029 — reject a join request through the UI; re-request is possible', async ({
  page,
  browser,
}) => {
  const liam = e2eIdentity('liam', 'Liam', 'password-1');
  const mia = e2eIdentity('mia', 'Mia', 'password-1');
  const { groupUrl, code } = await createGroupViaUi(page, liam, 'Trip');

  const miaContext = await browser.newContext();
  const miaPage = await miaContext.newPage();
  await register(miaPage, mia);
  await requestToJoin(miaPage, code);

  // Step 1: as liam, reject — the request leaves the pending list and no
  // membership is established.
  await page.goto(groupUrl);
  const request = page.getByTestId('join-request-item');
  await expect(request).toHaveCount(1);
  await request.getByRole('button', { name: 'Reject' }).click();
  await expect(request).toHaveCount(0);

  await page.getByRole('button', { name: 'Members', exact: true }).click();
  const memberList = page.getByTestId('member-list');
  await expect(memberList.getByTestId('member-item')).toHaveCount(1);
  await expect(memberList).toContainText('Liam');

  // Step 2: mia revisits `/join/<code>` and re-requests — accepted (pending).
  await requestToJoin(miaPage, code);

  // Step 3: liam sees exactly one pending request for Mia (BR-GRP-010).
  await page.reload();
  const requestAfter = page.getByTestId('join-request-item');
  await expect(requestAfter).toHaveCount(1);
  await expect(requestAfter).toContainText('Mia');

  await miaContext.close();
});

test('TC-GRP-030 — member list UI shows display names, never email addresses', async ({
  page,
  browser,
}) => {
  const noah = e2eIdentity('noah', 'Noah', 'password-1');
  const olive = e2eIdentity('olive', 'Olive', 'password-1');
  const { groupUrl, code } = await createGroupViaUi(page, noah, 'Trip');

  const oliveContext = await browser.newContext();
  const olivePage = await oliveContext.newPage();
  await register(olivePage, olive);
  await requestToJoin(olivePage, code);

  await page.goto(groupUrl);
  await expect(page.getByTestId('join-request-item')).toHaveCount(1);
  await page.getByTestId('join-request-item').getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByTestId('join-request-item')).toHaveCount(0);

  // Inspect the rendered member-list DOM.
  await page.getByRole('button', { name: 'Members', exact: true }).click();
  const memberList = page.getByTestId('member-list');
  await expect(memberList).toContainText('Noah');
  await expect(memberList).toContainText('Olive');

  const rendered = (await memberList.textContent()) ?? '';
  expect(rendered).not.toContain(noah.email);
  expect(rendered).not.toContain(olive.email);
  expect(rendered).not.toContain('@');

  await oliveContext.close();
});

test('TC-GRP-031 — group pages meet the page-load budget', async ({ page }) => {
  const peter = e2eIdentity('peter', 'Peter', 'password-1');
  const quinn = e2eIdentity('quinn', 'Quinn', 'password-1');
  const { groupUrl, code } = await createGroupViaUi(page, peter, 'Trip');

  // quinn places a request so peter's join-request handling view has content.
  await logout(page);
  await register(page, quinn);
  await requestToJoin(page, code);
  await logout(page);
  await login(page, peter.email, peter.password);
  await page.goto(groupUrl);
  await expect(page.getByTestId('join-request-item')).toContainText('Quinn');

  const routes = ['/', groupUrl, `${groupUrl}#join-requests`] as const;
  for (const route of routes) {
    const median = await measureMedianPageLoad(page, route);
    expect(median, `median load of ${route} (ms)`).toBeLessThanOrEqual(PAGE_LOAD_BUDGET_MS);
  }
});
