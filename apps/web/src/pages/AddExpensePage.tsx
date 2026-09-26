/**
 * Placeholder page: `/groups/:groupId/expenses/new` — add-expense form
 * (UC-EXP-001; single screen per NFR-EXP-001 — implemented by the Expense
 * Tracking UI tickets).
 */

import { useParams } from 'react-router-dom';

export function AddExpensePage() {
  const { groupId } = useParams<{ groupId: string }>();

  return (
    <section>
      <h1>Add expense</h1>
      <p>Group ID: {groupId}</p>
      <p>Add-expense form placeholder.</p>
    </section>
  );
}
