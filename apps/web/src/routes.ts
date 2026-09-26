/**
 * SPA route table (TKT-foundation-005).
 *
 * Mirror of 03-api-design.md §6 ("SPA routes (C1) and use-case coverage").
 * The literal patterns below are the contract the acceptance criterion
 * "all §6 routes render their placeholders" is checked against.
 */

/** The literal §6 route patterns, in table order. */
export const SPA_ROUTE_PATTERNS = [
  '/register',
  '/login',
  '/',
  '/groups/:groupId',
  '/groups/:groupId/expenses/new',
  '/groups/:groupId/expenses/:expenseId/edit',
  '/join/:code',
  '/change-password',
] as const;

export type SpaRoutePattern = (typeof SPA_ROUTE_PATTERNS)[number];

/** Typed path builders — the only place routes are composed. */
export const SPA_ROUTES = {
  register: '/register',
  login: '/login',
  groupsOverview: '/',
  groupView: (groupId: string) => `/groups/${encodeURIComponent(groupId)}`,
  addExpense: (groupId: string) => `/groups/${encodeURIComponent(groupId)}/expenses/new`,
  editExpense: (groupId: string, expenseId: string) =>
    `/groups/${encodeURIComponent(groupId)}/expenses/${encodeURIComponent(expenseId)}/edit`,
  join: (code: string) => `/join/${encodeURIComponent(code)}`,
  changePassword: '/change-password',
} as const;

/** Group-view tabs (03 §6: Expenses / Balances / Settle-up / Members). */
export const GROUP_TABS = ['expenses', 'balances', 'settle-up', 'members'] as const;

export type GroupTab = (typeof GROUP_TABS)[number];

export const GROUP_TAB_LABELS: Record<GroupTab, string> = {
  expenses: 'Expenses',
  balances: 'Balances',
  'settle-up': 'Settle-up',
  members: 'Members',
};
