/**
 * Group-scoped request context (TKT-groups-001; 01-system-architecture.md §8.1
 * layers 2/3).
 *
 * `GroupMemberGuard` resolves the caller's membership for the route's
 * `:groupId` and attaches it here; handlers (and the downstream
 * `GroupCreatorGuard`) read it instead of re-querying. Kept local to C3 so the
 * groups module owns its own request augmentation without editing the shared
 * platform context.
 */
import type { RequestWithContext } from '../common/http/request-context';

/** The caller's resolved membership for a group-scoped route. */
export interface GroupMembershipContext {
  readonly groupId: string;
  readonly userId: string;
  readonly isCreator: boolean;
}

/** A request the member guard has already run on. */
export type GroupScopedRequest = RequestWithContext & {
  groupMembership?: GroupMembershipContext;
};
