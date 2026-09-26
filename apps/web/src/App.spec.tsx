/**
 * Shell rendering (TKT-foundation-005, acceptance criteria 1 and 4).
 *
 * Every §6 route is static-rendered (react-dom/server, no DOM needed) and
 * must show its placeholder behind the root layout. The rendered markup must
 * contain no email address and no credential input/value — the shell never
 * exposes identity (arch 01 §2 C1 "Renders display names, never emails").
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { AppRoutes } from './App';

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

const CASES: ReadonlyArray<{ path: string; heading: string }> = [
  { path: '/register', heading: 'Create account' },
  { path: '/login', heading: 'Log in' },
  { path: '/', heading: 'Groups' },
  { path: '/groups/g1', heading: 'Group' },
  { path: '/groups/g1/expenses/new', heading: 'Add expense' },
  { path: '/groups/g1/expenses/e2/edit', heading: 'Edit expense' },
  { path: '/join/ABC123', heading: 'Join group' },
  { path: '/change-password', heading: 'Change password' },
];

function render(path: string): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe('SPA shell rendering', () => {
  it.each(CASES)('renders the $path placeholder', ({ path, heading }) => {
    const html = render(path);
    expect(html).toContain(heading);
    // Root layout chrome wraps every route.
    expect(html).toContain('app-shell');
  });

  it('renders all four group-view tabs at /groups/:groupId', () => {
    const html = render('/groups/g1');
    for (const label of ['Expenses', 'Balances', 'Settle-up', 'Members']) {
      expect(html).toContain(label);
    }
  });

  it.each(CASES)('renders no email address or credential input on $path', ({ path }) => {
    const html = render(path);
    expect(html).not.toMatch(EMAIL_RE);
    expect(html).not.toContain('<input');
  });
});
