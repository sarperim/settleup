/**
 * Placeholder page: `/join/:code` — join-by-code confirmation
 * (UC-GRP-002; resolves via `GET /api/join-info` then
 * `POST /api/join-requests` — implemented by the Groups UI tickets).
 */

import { useParams } from 'react-router-dom';

export function JoinPage() {
  const { code } = useParams<{ code: string }>();

  return (
    <section>
      <h1>Join group</h1>
      <p>Join code: {code}</p>
      <p>Join confirmation placeholder.</p>
    </section>
  );
}
