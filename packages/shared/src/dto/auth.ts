/**
 * Auth DTOs — Accounts & Access (03-api-design.md §2, C2).
 *
 * Endpoints: `POST /api/auth/register` (201 `{ user }` + session cookie),
 * `POST /api/auth/login` (200 `{ user }` + session cookie),
 * `POST /api/auth/logout` (204 — no body), `GET /api/auth/me`
 * (200 `{ user }`), `POST /api/auth/password` (204 — no body).
 */

/** `POST /api/auth/register` request body. */
export interface RegisterRequestDto {
  email: string;
  password: string;
  displayName: string;
}

/** `POST /api/auth/login` request body (email lowercased before lookup — §1). */
export interface LoginRequestDto {
  email: string;
  password: string;
}

/** `POST /api/auth/password` request body — deletes all other sessions (D-ARCH-002). */
export interface ChangePasswordRequestDto {
  currentPassword: string;
  newPassword: string;
}

/**
 * The authenticated user's own profile — the `{ user }` of register, login
 * and `GET /api/auth/me`. Not a group-scoped payload, so the user's own
 * email is included. Passwords and password hashes never appear in any
 * response.
 */
export interface UserDto {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

/** Success body of register, login and `GET /api/auth/me`. */
export interface UserResponseDto {
  user: UserDto;
}
