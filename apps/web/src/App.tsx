/**
 * SPA route tree (TKT-foundation-005; TKT-accounts-005).
 *
 * Wires the 03-api-design.md §6 route table to the pages. `/register` and
 * `/login` are public (UC-ACC-001/002); every other route sits behind the
 * session guard (`RequireAuth`), which redirects anonymous visitors to
 * `/login` (UC-ACC-006, FR-ACC-009). The session state itself lives in the
 * app-level `AuthProvider` (see `App`), so register/login can adopt the
 * returned user without a second round-trip. Deep links work because
 * `main.tsx` mounts a `BrowserRouter` and the production host serves
 * `index.html` for any path.
 */

import { Navigate, Outlet, Route, Routes } from 'react-router-dom';

import { AuthProvider } from './auth/AuthContext';
import { RequireAuth } from './auth/RequireAuth';
import { RootLayout } from './layout/RootLayout';
import { AddExpensePage } from './pages/AddExpensePage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { EditExpensePage } from './pages/EditExpensePage';
import { GroupsOverviewPage } from './pages/GroupsOverviewPage';
import { GroupViewPage } from './pages/GroupViewPage';
import { JoinPage } from './pages/JoinPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { SPA_ROUTE_PARAMS, SPA_ROUTES } from './routes';

/**
 * The route tree, exported separately so tests can render it inside a
 * `MemoryRouter` without a real DOM. In production it is wrapped by the
 * app-level `AuthProvider` (below); tests inject an `AuthContext.Provider`.
 */
export function AppRoutes() {
  return (
    <Routes>
      {/* Public routes (FR-ACC-009 allowlist). */}
      <Route element={<RootLayout />}>
        <Route path={SPA_ROUTES.register} element={<RegisterPage />} />
        <Route path={SPA_ROUTES.login} element={<LoginPage />} />
      </Route>

      {/* Protected routes (UC-ACC-006): the guard redirects to `/login`
          while no session is established. */}
      <Route
        element={
          <RequireAuth>
            <Outlet />
          </RequireAuth>
        }
      >
        <Route element={<RootLayout />}>
          <Route path={SPA_ROUTES.groupsOverview} element={<GroupsOverviewPage />} />
          <Route path={SPA_ROUTE_PARAMS.groupView} element={<GroupViewPage />} />
          <Route path={SPA_ROUTE_PARAMS.addExpense} element={<AddExpensePage />} />
          <Route path={SPA_ROUTE_PARAMS.editExpense} element={<EditExpensePage />} />
          <Route path={SPA_ROUTE_PARAMS.join} element={<JoinPage />} />
          <Route path={SPA_ROUTES.changePassword} element={<ChangePasswordPage />} />
        </Route>
      </Route>

      {/* §6's protected-route row (UC-ACC-006): an unknown path is handled like
          an anonymous hit on a protected page. */}
      <Route path="*" element={<Navigate to={SPA_ROUTES.login} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
