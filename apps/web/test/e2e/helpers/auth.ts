import { expect, test, type Page } from '@playwright/test';

/**
 * Shared UI helpers for the auth e2e specs (TKT-accounts-005).
 *
 * Every spec is self-contained and order-independent (testing/accounts-access.md
 * e2e conventions): each drives the real browser through the built SPA against
 * the e2e database. The helpers below only compose user-visible actions — they
 * never call the API directly, so the journey (not a seed) is what the test
 * proves (00-test-strategy.md §5).
 *
 * Identity isolation (flagged, TKT-accounts-005 — C-4 reality): the accounts
 * plan pins the e2e identities as `alice@test.local` etc., but the e2e phase
 * runs the system suite (`TC-ACC-028`, `pnpm test:e2e` → `pnpm test:system`)
 * **before** Playwright, and that spec leaves `alice@test.local` in the shared
 * e2e database. Fixed raw identities would therefore collide on the very first
 * Playwright run (and again on a CI retry, which reuses the same database).
 * `e2eIdentity` keeps the identities fixed and deterministic — display names
 * unchanged — but namespaces the email (`<base>-e2e@test.local`) and adds the
 * deterministic Playwright retry index, so the same test is reproducible on a
 * fresh database, on a re-run, and on a retry.
 */

export interface Credentials {
  displayName: string;
  email: string;
  password: string;
}

/**
 * A fixed, collision-free e2e identity. `base` is the plan's local part
 * (`alice`, `bob`, …); the display name and password stay as the plan states.
 */
export function e2eIdentity(base: string, displayName: string, password: string): Credentials {
  const retry = test.info().retry;
  const suffix = retry > 0 ? `.retry${retry}` : '';
  return { displayName, email: `${base}-e2e${suffix}@test.local`, password };
}

/** Register through `/register` and submit (UC-ACC-001). Leaves navigation pending. */
export async function submitRegistration(page: Page, user: Credentials): Promise<void> {
  await page.goto('/register');
  await page.getByLabel('Display name').fill(user.displayName);
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Create account' }).click();
}

/** Register and wait for the post-registration landing (groups overview, `/`). */
export async function register(page: Page, user: Credentials): Promise<void> {
  await submitRegistration(page, user);
  await expect(page).toHaveURL('/');
}

/** Log in through `/login` and submit (UC-ACC-002). Leaves navigation pending. */
export async function submitLogin(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
}

/** Log in and wait for the post-login landing (groups overview, `/`). */
export async function login(page: Page, email: string, password: string): Promise<void> {
  await submitLogin(page, email, password);
  await expect(page).toHaveURL('/');
}

/** Trigger logout from the shell navigation and wait for the login page (UC-ACC-003). */
export async function logout(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL('/login');
}
