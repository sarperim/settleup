/**
 * SPA route table (TKT-foundation-005, acceptance criterion 1).
 *
 * The literal 03-api-design.md §6 patterns are contract: this spec pins the
 * table and the typed path builders the UI composes from.
 */

import { describe, expect, it } from 'vitest';

import { GROUP_TABS, SPA_ROUTES, SPA_ROUTE_PATTERNS } from './routes';

describe('SPA route table (§6)', () => {
  it('contains exactly the §6 route patterns', () => {
    expect([...SPA_ROUTE_PATTERNS]).toEqual([
      '/register',
      '/login',
      '/',
      '/groups/:groupId',
      '/groups/:groupId/expenses/new',
      '/groups/:groupId/expenses/:expenseId/edit',
      '/join/:code',
      '/change-password',
    ]);
  });

  it('builds concrete paths for the parameterized routes', () => {
    expect(SPA_ROUTES.groupView('g1')).toBe('/groups/g1');
    expect(SPA_ROUTES.addExpense('g1')).toBe('/groups/g1/expenses/new');
    expect(SPA_ROUTES.editExpense('g1', 'e2')).toBe('/groups/g1/expenses/e2/edit');
    expect(SPA_ROUTES.join('ABC123')).toBe('/join/ABC123');
  });

  it('keeps static paths in sync with the §6 patterns', () => {
    expect(SPA_ROUTE_PATTERNS).toContain(SPA_ROUTES.register);
    expect(SPA_ROUTE_PATTERNS).toContain(SPA_ROUTES.login);
    expect(SPA_ROUTE_PATTERNS).toContain(SPA_ROUTES.groupsOverview);
    expect(SPA_ROUTE_PATTERNS).toContain(SPA_ROUTES.changePassword);
  });

  it('defines the four §6 group tabs', () => {
    expect([...GROUP_TABS]).toEqual(['expenses', 'balances', 'settle-up', 'members']);
  });
});
