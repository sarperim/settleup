/**
 * `/change-password` page — change own password (UC-ACC-004; FR-ACC-006/007,
 * D-ARCH-002). Protected route (UC-ACC-006): only reachable with a session.
 *
 * Posts `POST /api/auth/password`; on success shows a confirmation (the acting
 * session survives — D-ARCH-002). Wrong current password / policy violations
 * render the §4 envelope's `message` and keep the form on screen.
 *
 * Structure is frozen by PG-004; the TKT-ui-014 restyle only regroups the fields
 * into the reference's label/control rhythm. No labels, roles, testids or copy
 * change (the frozen `<h1>Change password</h1>`, the two labels, the submit and
 * the success string are kept; the reference's card subtitle and new-password
 * hint are routed back rather than silently adopted).
 */

import { useState, type FormEvent } from 'react';
import { FIELD_LIMITS } from 'shared';

import './ChangePasswordPage.css';
import { api } from '../api/client';
import { ApiError } from '../api/errors';

export function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      newPassword.length < FIELD_LIMITS.password.minLength ||
      newPassword.length > FIELD_LIMITS.password.maxLength
    ) {
      setError(
        `New password must be ${FIELD_LIMITS.password.minLength}–${FIELD_LIMITS.password.maxLength} characters.`,
      );
      return;
    }
    setSubmitting(true);
    setError(null);
    setChanged(false);
    try {
      await api.post('/auth/password', { currentPassword, newPassword });
      setChanged(true);
      setCurrentPassword('');
      setNewPassword('');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="change-password-page">
      <div className="card change-password-card">
        <h1>Change password</h1>
        {changed && (
          <p className="alert alert--success" role="status">
            Password changed.
          </p>
        )}
        {error !== null && <p role="alert">{error}</p>}
        <form onSubmit={onSubmit} noValidate>
          <div className="change-password-field">
            <label htmlFor="change-current-password">Current password</label>
            <input
              id="change-current-password"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => {
                setCurrentPassword(event.target.value);
              }}
            />
          </div>

          <div className="change-password-field">
            <label htmlFor="change-new-password">New password</label>
            <input
              id="change-new-password"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={FIELD_LIMITS.password.minLength}
              maxLength={FIELD_LIMITS.password.maxLength}
              value={newPassword}
              onChange={(event) => {
                setNewPassword(event.target.value);
              }}
            />
          </div>

          <button type="submit" disabled={submitting}>
            Change password
          </button>
        </form>
      </div>
    </section>
  );
}
