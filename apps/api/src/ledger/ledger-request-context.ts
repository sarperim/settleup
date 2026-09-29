/**
 * Ledger-scoped request context (TKT-exp-004; 01-system-architecture.md §8.1
 * layers 2/3).
 *
 * `ExpenseLoggerGuard` resolves the addressed expense (group-scoped) and
 * attaches it here, so the PATCH/DELETE handlers read the already-authorized
 * row instead of re-querying. Kept local to C4, mirroring C3's
 * `GroupScopedRequest` pattern, so the ledger module owns its own request
 * augmentation without editing the shared platform context.
 */
import type { GroupScopedRequest } from '../groups/group-request-context';
import type { LedgerExpenseRow } from './ledger-read.service';

/** A request the expense-logger guard has already run on. */
export type ExpenseScopedRequest = GroupScopedRequest & {
  expense?: LedgerExpenseRow;
};
