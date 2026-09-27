/**
 * Protected-route guard (TKT-accounts-005; UC-ACC-006).
 *
 * While the shell is establishing the session it renders a loading status;
 * once the session resolves to anonymous it redirects to `/login`. Authenticated
 * children render normally. This is the UI half of FR-ACC-009: every route
 * except `/register` and `/login` requires a session.
 */

import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

import { SPA_ROUTES } from '../routes';
import { useAuth, type AuthStatus } from './AuthContext';

/** The three decisions the guard can make for a given session status. */
export type GuardOutcome = 'loading' | 'redirect' | 'render';

/**
 * Pure mapping from session status to guard decision — extracted so the
 * redirect decision is unit-testable without a DOM (the `<Navigate>` itself
 * only takes effect in a browser, where the e2e TC-ACC-025 covers it).
 */
export function guardOutcome(status: AuthStatus): GuardOutcome {
  if (status === 'loading') {
    return 'loading';
  }
  if (status === 'anonymous') {
    return 'redirect';
  }
  return 'render';
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();

  switch (guardOutcome(status)) {
    case 'loading':
      return <p role="status">Loading…</p>;
    case 'redirect':
      return <Navigate to={SPA_ROUTES.login} replace />;
    case 'render':
      return <>{children}</>;
  }
}
