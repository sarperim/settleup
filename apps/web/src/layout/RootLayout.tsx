/**
 * Root layout + navigation shell (TKT-foundation-005; arch 01 §2 C1).
 *
 * Minimal chrome around every route. It renders no user identity at all —
 * no email address and no credential ever appears in the shell
 * (acceptance criterion 4; arch 01 §2 C1 "Renders display names, never
 * emails").
 */

import { NavLink, Outlet } from 'react-router-dom';
import { SPA_ROUTES } from '../routes';

export function RootLayout() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="app-brand">Settle Up</span>
        <nav aria-label="Main navigation">
          <NavLink to={SPA_ROUTES.groupsOverview}>Groups</NavLink>
          <NavLink to={SPA_ROUTES.changePassword}>Change password</NavLink>
        </nav>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
