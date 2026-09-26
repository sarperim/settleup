/**
 * Placeholder page: `/login` (UC-ACC-002; also the anonymous redirect
 * target, UC-ACC-006 / arch §6 last row).
 *
 * The login form lands with the Accounts & Access UI tickets; this shell
 * renders only the page frame. It deliberately renders no credential value
 * (acceptance criterion 4).
 */

export function LoginPage() {
  return (
    <section>
      <h1>Log in</h1>
      <p>Login form placeholder.</p>
    </section>
  );
}
