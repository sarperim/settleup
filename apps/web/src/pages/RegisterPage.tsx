/**
 * `/register` page — create an account (UC-ACC-001; FR-ACC-001/002/010).
 *
 * Wires the form to `POST /api/auth/register` through the shell's API client.
 * Field limits come from the frozen `shared` contract (03-api-design.md §1;
 * D-ARCH-003), so the client rejects invalid input before any network call.
 * Errors are shown from the typed §4 envelope; success navigates straight to
 * the groups overview — registration establishes the session (FR-ACC-010), so
 * there is no separate login or email-verification step.
 */

import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FIELD_LIMITS, type UserResponseDto } from 'shared';

import './RegisterPage.css';
import { api } from '../api/client';
import { ApiError } from '../api/errors';
import { useAuth } from '../auth/AuthContext';
import { SPA_ROUTES } from '../routes';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FieldErrors {
  displayName?: string;
  email?: string;
  password?: string;
}

function validate(displayName: string, email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (
    displayName.length < FIELD_LIMITS.displayName.minLength ||
    displayName.length > FIELD_LIMITS.displayName.maxLength
  ) {
    errors.displayName = `Display name must be ${FIELD_LIMITS.displayName.minLength}–${FIELD_LIMITS.displayName.maxLength} characters.`;
  }
  if (!EMAIL_PATTERN.test(email)) {
    errors.email = 'Enter a valid email address.';
  }
  if (
    password.length < FIELD_LIMITS.password.minLength ||
    password.length > FIELD_LIMITS.password.maxLength
  ) {
    errors.password = `Password must be ${FIELD_LIMITS.password.minLength}–${FIELD_LIMITS.password.maxLength} characters.`;
  }
  return errors;
}

export function RegisterPage() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = validate(displayName, email, password);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { user } = await api.post<UserResponseDto>('/auth/register', {
        email,
        password,
        displayName,
      });
      // Registration establishes the session (FR-ACC-010) — adopt it so the
      // protected shell renders without a second `/auth/me` round-trip.
      signIn(user);
      navigate(SPA_ROUTES.groupsOverview, { replace: true });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <section className="register-page">
      <div className="card register-card">
        <h1>Create account</h1>
        {error !== null && <p role="alert">{error}</p>}
        <form onSubmit={onSubmit} noValidate>
          <label htmlFor="register-display-name">Display name</label>
          <input
            id="register-display-name"
            name="displayName"
            type="text"
            minLength={FIELD_LIMITS.displayName.minLength}
            maxLength={FIELD_LIMITS.displayName.maxLength}
            value={displayName}
            onChange={(event) => {
              setDisplayName(event.target.value);
            }}
            aria-invalid={fieldErrors.displayName !== undefined}
          />
          {fieldErrors.displayName !== undefined && <p role="alert">{fieldErrors.displayName}</p>}

          <label htmlFor="register-email">Email</label>
          <input
            id="register-email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
            }}
            aria-invalid={fieldErrors.email !== undefined}
          />
          {fieldErrors.email !== undefined && <p role="alert">{fieldErrors.email}</p>}

          <label htmlFor="register-password">Password</label>
          <input
            id="register-password"
            name="password"
            type="password"
            minLength={FIELD_LIMITS.password.minLength}
            maxLength={FIELD_LIMITS.password.maxLength}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
            }}
            aria-invalid={fieldErrors.password !== undefined}
          />
          {fieldErrors.password !== undefined && <p role="alert">{fieldErrors.password}</p>}

          <button type="submit" disabled={submitting}>
            Create account
          </button>
        </form>
        <p className="register-switch muted">
          Already have an account? <Link to={SPA_ROUTES.login}>Log in</Link>
        </p>
      </div>
    </section>
  );
}
