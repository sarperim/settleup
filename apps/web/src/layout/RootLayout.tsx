/**
 * Root layout + navigation shell (TKT-foundation-005; TKT-accounts-005;
 * iteration-3 1:1 chrome TKT-ui-011).
 *
 * Chrome around every route. When a session exists it renders the user's
 * **display name** (never an email — arch 01 §2 C1, FR-ACC-008) and the logout
 * control; logout calls `POST /api/auth/logout` and returns to `/login`
 * (UC-ACC-003). On public routes (no session provider) it shows the
 * login/register links instead.
 *
 * Structure is frozen by PG-001; the TKT-ui-011 restyle reproduces the "Top
 * bar" frames of the Figma references (file `XzY4HLCoW70yfI9NgeLXqC`) — the
 * brand mark + app name, the acting user's display name, the nav links and the
 * logout pill. No nav target, role, label or copy changes: the marker spans
 * (`app-brand-mark`) are decorative (`aria-hidden`), and the existing
 * `Main navigation` landmark, links and the `Log out` button are unchanged.
 */

import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import './RootLayout.css';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { SPA_ROUTES } from '../routes';

export function RootLayout() {
  const { status, user, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await api.post('/auth/logout');
    } catch {
      // The session may already be gone; local sign-out is unconditional.
    }
    signOut();
    navigate(SPA_ROUTES.login, { replace: true });
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-brand">
          <span className="app-brand-mark" aria-hidden="true" />
          <span className="app-brand-name">Settle Up</span>
        </div>
        {status === 'authenticated' && user !== null ? (
          <>
            {/* On mobile the reference puts the acting user's name on the brand
             * row (top-right), above the link row; on desktop it sits at the
             * start of the right-hand nav group. */}
            <span className="app-user" data-testid="current-user">
              {user.displayName}
            </span>
            <nav className="app-nav" aria-label="Main navigation">
              <NavLink to={SPA_ROUTES.groupsOverview}>Groups</NavLink>
              <NavLink to={SPA_ROUTES.changePassword} className="app-nav__quiet">
                Change password
              </NavLink>
              <button
                type="button"
                onClick={() => {
                  void handleLogout();
                }}
              >
                Log out
              </button>
            </nav>
          </>
        ) : (
          <nav className="app-nav app-nav--anonymous" aria-label="Main navigation">
            <NavLink to={SPA_ROUTES.login}>Log in</NavLink>
            <NavLink to={SPA_ROUTES.register}>Create account</NavLink>
          </nav>
        )}
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
