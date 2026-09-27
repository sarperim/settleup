/**
 * Shell routing & session guard (TKT-foundation-005; reworked by
 * TKT-accounts-005).
 *
 * Every §6 route is static-rendered (react-dom/server, no DOM needed) with an
 * injected `AuthContext` so each session state can be exercised. The public
 * auth routes render their real pages; protected routes render their page only
 * for an authenticated session, a loading status while the session is
 * unresolved, and nothing (the `<Navigate>` redirect) when anonymous.
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { UserDto } from 'shared';

import { AppRoutes } from './App';
import { AuthContext, type AuthState } from './auth/AuthContext';
import { RequireAuth, guardOutcome } from './auth/RequireAuth';

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

const USER: UserDto = {
  id: 'u1',
  email: 'alice@test.local',
  displayName: 'Alice',
  createdAt: '2026-09-27T00:00:00.000Z',
};

function authState(status: AuthState['status'], user: UserDto | null): AuthState {
  return { status, user, refresh: async () => undefined, signIn: () => undefined, signOut: () => undefined };
}

function render(path: string, state?: AuthState): string {
  const routes = (
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>
  );
  return renderToStaticMarkup(
    state === undefined ? routes : <AuthContext.Provider value={state}>{routes}</AuthContext.Provider>,
  );
}

describe('SPA shell routing', () => {
  it.each([
    ['/register', 'Create account'],
    ['/login', 'Log in'],
  ])('renders the public auth page at %s', (path, heading) => {
    const html = render(path);
    expect(html).toContain(`<h1>${heading}</h1>`);
    expect(html).toContain('app-shell');
  });

  it('renders no email address in the shell chrome', () => {
    const html = render('/login');
    expect(html).not.toMatch(EMAIL_RE);
  });

  it('renders a protected page for an authenticated session', () => {
    const groupView = render('/groups/g1', authState('authenticated', USER));
    for (const label of ['Expenses', 'Balances', 'Settle-up', 'Members']) {
      expect(groupView).toContain(label);
    }
    const changePassword = render('/change-password', authState('authenticated', USER));
    expect(changePassword).toContain('<h1>Change password</h1>');
    // The shell shows the display name, never the email (FR-ACC-008).
    expect(changePassword).toContain('Alice');
    expect(changePassword).not.toMatch(EMAIL_RE);
  });

  it.each(['/', '/groups/g1', '/change-password', '/groups/g1/expenses/new', '/join/ABC123'])(
    'shows the session-loading state on the protected route %s',
    (path) => {
      const html = render(path, authState('loading', null));
      expect(html).toContain('Loading');
      expect(html).not.toContain('Group ledger placeholder.');
    },
  );

  it('renders no protected content for an anonymous session', () => {
    // `<Navigate>` renders nothing during a static render; the browser landing
    // URL is covered by the e2e suite (TC-ACC-025).
    const html = render('/groups/g1', authState('anonymous', null));
    expect(html).not.toContain('Group ledger placeholder.');
  });
});

describe('RequireAuth guard (UC-ACC-006)', () => {
  function renderGuard(state: AuthState): string {
    return renderToStaticMarkup(
      <MemoryRouter initialEntries={['/secret']}>
        <AuthContext.Provider value={state}>
          <Routes>
            <Route
              path="/secret"
              element={
                <RequireAuth>
                  <p>Secret surface</p>
                </RequireAuth>
              }
            />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>,
    );
  }

  it('renders children for an authenticated session', () => {
    expect(renderGuard(authState('authenticated', USER))).toContain('Secret surface');
  });

  it('renders nothing for an anonymous session (the redirect target is the browser URL)', () => {
    expect(renderGuard(authState('anonymous', null))).not.toContain('Secret surface');
  });

  it('renders a loading state while the session is unresolved', () => {
    const html = renderGuard(authState('loading', null));
    expect(html).toContain('Loading');
    expect(html).not.toContain('Secret surface');
  });

  it('decides the redirect for an anonymous session', () => {
    expect(guardOutcome('anonymous')).toBe('redirect');
    expect(guardOutcome('loading')).toBe('loading');
    expect(guardOutcome('authenticated')).toBe('render');
  });
});
