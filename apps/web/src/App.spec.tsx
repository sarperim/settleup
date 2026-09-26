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

// Each case asserts page-unique placeholder text — never a root-layout nav
// label ('Groups', 'Change password') or a substring of one. Asserting nav
// labels masked broken route wiring: the chrome rendered them regardless of
// the page (review round 1, F-1).
const CASES: ReadonlyArray<{ path: string; content: string }> = [
  { path: '/register', content: 'Registration form placeholder.' },
  { path: '/login', content: 'Login form placeholder.' },
  { path: '/', content: 'Groups overview placeholder.' },
  { path: '/groups/g1', content: 'Group ledger placeholder.' },
  { path: '/groups/g1/expenses/new', content: 'Add-expense form placeholder.' },
  { path: '/groups/g1/expenses/e2/edit', content: 'Edit-expense form placeholder.' },
  { path: '/join/ABC123', content: 'Join confirmation placeholder.' },
  { path: '/change-password', content: 'Change-password form placeholder.' },
];

function render(path: string): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe('SPA shell rendering', () => {
  it.each(CASES)('renders the $path placeholder', ({ path, content }) => {
    const html = render(path);
    expect(html).toContain(content);
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
