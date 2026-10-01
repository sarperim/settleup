/**
 * `/login` page — authenticate (UC-ACC-002; FR-ACC-003/004).
 *
 * Wires the form to `POST /api/auth/login`. A failure keeps the user on the
 * page and renders the §4 envelope's `message` (INVALID_CREDENTIALS or the
 * login throttle's 429 TOO_MANY_ATTEMPTS) — never navigating on a 401.
 * Success lands on the groups overview (UC-ACC-002 step 3).
 */

import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { UserResponseDto } from 'shared';

import './LoginPage.css';
import { api } from '../api/client';
import { ApiError } from '../api/errors';
import { useAuth } from '../auth/AuthContext';
import { SPA_ROUTES } from '../routes';

export function LoginPage() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const { user } = await api.post<UserResponseDto>('/auth/login', { email, password });
      signIn(user);
      navigate(SPA_ROUTES.groupsOverview, { replace: true });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <section className="login-page">
      <div className="card login-card">
        <h1>Log in</h1>
        {error !== null && <p role="alert">{error}</p>}
        <form onSubmit={onSubmit} noValidate>
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
            }}
          />

          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
            }}
          />

          <button type="submit" disabled={submitting}>
            Log in
          </button>
        </form>
        <p className="login-switch muted">
          Need an account? <Link to={SPA_ROUTES.register}>Create account</Link>
        </p>
      </div>
    </section>
  );
}
