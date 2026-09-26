/**
 * SPA route tree (TKT-foundation-005).
 *
 * Wires the 03-api-design.md §6 route table to placeholder pages behind the
 * root layout. Deep links work because `main.tsx` mounts a `BrowserRouter`
 * and the Vite dev server / production host serve `index.html` for any
 * path (the production history fallback is TKT-foundation-004's criterion).
 */

import { Navigate, Route, Routes } from 'react-router-dom';
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
 * `MemoryRouter` without a real DOM.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<RootLayout />}>
        <Route path={SPA_ROUTES.register} element={<RegisterPage />} />
        <Route path={SPA_ROUTES.login} element={<LoginPage />} />
        <Route path={SPA_ROUTES.groupsOverview} element={<GroupsOverviewPage />} />
        <Route path={SPA_ROUTE_PARAMS.groupView} element={<GroupViewPage />} />
        <Route path={SPA_ROUTE_PARAMS.addExpense} element={<AddExpensePage />} />
        <Route path={SPA_ROUTE_PARAMS.editExpense} element={<EditExpensePage />} />
        <Route path={SPA_ROUTE_PARAMS.join} element={<JoinPage />} />
        <Route path={SPA_ROUTES.changePassword} element={<ChangePasswordPage />} />
        {/* Catch-all approximation of §6's protected-route row ("any
            protected route while anonymous → redirect to /login",
            UC-ACC-006): §6 defines no public wildcard, so an unknown path
            is handled like an anonymous hit on a protected page. */}
        <Route path="*" element={<Navigate to={SPA_ROUTES.login} replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return <AppRoutes />;
}
