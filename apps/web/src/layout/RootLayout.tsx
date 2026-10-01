/**
 * Root layout + navigation shell (TKT-foundation-005; TKT-accounts-005).
 *
 * Chrome around every route. When a session exists it renders the user's
 * **display name** (never an email — arch 01 §2 C1, FR-ACC-008) and the logout
 * control; logout calls `POST /api/auth/logout` and returns to `/login`
 * (UC-ACC-003). On public routes (no session provider) it shows the
 * login/register links instead.
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
        <span className="app-brand">Settle Up</span>
        {status === 'authenticated' && user !== null ? (
          <nav className="app-nav" aria-label="Main navigation">
            <NavLink to={SPA_ROUTES.groupsOverview}>Groups</NavLink>
            <NavLink to={SPA_ROUTES.changePassword}>Change password</NavLink>
            <span className="app-user" data-testid="current-user">
              {user.displayName}
            </span>
            <button
              type="button"
              onClick={() => {
                void handleLogout();
              }}
            >
              Log out
            </button>
          </nav>
        ) : (
          <nav className="app-nav" aria-label="Main navigation">
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
