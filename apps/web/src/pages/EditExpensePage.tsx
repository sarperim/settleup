/**
 * Placeholder page: `/groups/:groupId/expenses/:expenseId/edit` — edit
 * expense (UC-EXP-002, logger only).
 */

import { useParams } from 'react-router-dom';

export function EditExpensePage() {
  const { groupId, expenseId } = useParams<{ groupId: string; expenseId: string }>();

  return (
    <section>
      <h1>Edit expense</h1>
      <p>Group ID: {groupId}</p>
      <p>Expense ID: {expenseId}</p>
      <p>Edit-expense form placeholder.</p>
    </section>
  );
}
