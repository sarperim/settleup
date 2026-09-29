/**
 * Settlement integration-test helpers (TKT-bal-004; balances-settlement.md
 * §2 conventions, 00-test-strategy.md §5).
 *
 * The settlement lifecycle cases all start from the plan's **standing value
 * fixture**: alice logs an expense of 9000 kuruş (₺90.00), payer alice, EXACT
 * split `{alice: 3000, bob: 3000, carol: 3000}` → balances alice +6000,
 * bob −3000, carol −3000; the deterministic minimum-transaction plan is
 * `bob → alice 3000` and `carol → alice 3000`.
 *
 * `markPaid`/`undoSettlement` drive the real routes and return the created/
 * updated `{ settlement }` fact — the write path is exercised through the API,
 * never by seeding rows (strategy §5).
 */
import type { Server } from 'node:http';
import { api, CSRF_HEADERS } from './app';
import {
  createExpense,
  type RegisteredUser,
  type UserRefFixture,
} from './factories';
import { createStandingGroup, type StandingGroup } from './standing-group';

/** The mark-paid request body (03-api-design.md §3c). */
export interface MarkPaidInput {
  readonly payerId: string;
  readonly recipientId: string;
  readonly amountKurus: number;
}

/** A stored settlement fact as returned by the write routes (03 §3c). */
export interface SettlementFixture {
  readonly id: string;
  readonly payer: UserRefFixture;
  readonly recipient: UserRefFixture;
  readonly amountKurus: number;
  readonly status: 'SETTLED' | 'UNDONE';
  readonly paidAt: string;
  readonly undoneAt?: string;
}

/** The standing group plus its deterministic outstanding plan. */
export interface StandingValueGroup extends StandingGroup {
  /** bob → alice 3000, carol → alice 3000 (deterministic minimum plan). */
  readonly plan: readonly MarkPaidInput[];
}

/** The standing plan for the value fixture (one creditor, exact debts). */
export function standingPlan(alice: RegisteredUser, bob: RegisteredUser, carol: RegisteredUser): MarkPaidInput[] {
  return [
    { payerId: bob.id, recipientId: alice.id, amountKurus: 3000 },
    { payerId: carol.id, recipientId: alice.id, amountKurus: 3000 },
  ];
}

/**
 * Build the standing group and log the standing value expense
 * (balances-settlement.md §2): 9000 kuruş, payer alice, EXACT 3000/3000/3000.
 */
export async function createStandingValueGroup(
  server: Server,
): Promise<StandingValueGroup> {
  const standing = await createStandingGroup(server);

  await createExpense(server, standing.alice.cookie, standing.group.id, {
    description: 'Group dinner',
    amountKurus: 9000,
    payerId: standing.alice.id,
    participantIds: [standing.alice.id, standing.bob.id, standing.carol.id],
    splitType: 'EXACT',
    exactAmounts: {
      [standing.alice.id]: 3000,
      [standing.bob.id]: 3000,
      [standing.carol.id]: 3000,
    },
  });

  return {
    ...standing,
    plan: standingPlan(standing.alice, standing.bob, standing.carol),
  };
}

/**
 * Drive `POST /api/groups/:groupId/settlements` and return the created
 * `{ settlement }`. Throws loudly on a non-201 so a precondition failure is
 * never mistaken for a test outcome.
 */
export async function markPaid(
  server: Server,
  actorCookie: string,
  groupId: string,
  input: MarkPaidInput,
): Promise<SettlementFixture> {
  const response = await api(server)
    .post(`/api/groups/${groupId}/settlements`)
    .set(CSRF_HEADERS)
    .set('Cookie', actorCookie)
    .send(input);

  if (response.status !== 201) {
    throw new Error(
      `markPaid fixture failed: expected 201, got ${response.status} (${JSON.stringify(response.body)})`,
    );
  }

  return (response.body as { settlement: SettlementFixture }).settlement;
}

/**
 * Drive `POST /api/groups/:groupId/settlements/:settlementId/undo` and return
 * the updated `{ settlement }`. Throws loudly on a non-200.
 */
export async function undoSettlement(
  server: Server,
  actorCookie: string,
  groupId: string,
  settlementId: string,
): Promise<SettlementFixture> {
  const response = await api(server)
    .post(`/api/groups/${groupId}/settlements/${settlementId}/undo`)
    .set(CSRF_HEADERS)
    .set('Cookie', actorCookie);

  if (response.status !== 200) {
    throw new Error(
      `undoSettlement fixture failed: expected 200, got ${response.status} (${JSON.stringify(response.body)})`,
    );
  }

  return (response.body as { settlement: SettlementFixture }).settlement;
}

/** Read the group's settle-up view (the derived plan + stored facts). */
export async function readSettlements(
  server: Server,
  memberCookie: string,
  groupId: string,
): Promise<{
  outstanding: Array<{
    payer: UserRefFixture;
    recipient: UserRefFixture;
    amountKurus: number;
  }>;
  settled: SettlementFixture[];
}> {
  const response = await api(server)
    .get(`/api/groups/${groupId}/settlements`)
    .set('Cookie', memberCookie);

  if (response.status !== 200) {
    throw new Error(
      `readSettlements fixture failed: expected 200, got ${response.status} (${JSON.stringify(response.body)})`,
    );
  }

  return response.body as {
    outstanding: Array<{
      payer: UserRefFixture;
      recipient: UserRefFixture;
      amountKurus: number;
    }>;
    settled: SettlementFixture[];
  };
}

/** The error code of a standard error envelope, or `undefined`. */
export function errorCode(body: unknown): string | undefined {
  return (body as { error?: { code?: string } }).error?.code;
}

/** The group's per-member balances keyed by member id. */
export async function readBalances(
  server: Server,
  memberCookie: string,
  groupId: string,
): Promise<Map<string, number>> {
  const response = await api(server)
    .get(`/api/groups/${groupId}/balances`)
    .set('Cookie', memberCookie);

  if (response.status !== 200) {
    throw new Error(
      `readBalances fixture failed: expected 200, got ${response.status} (${JSON.stringify(response.body)})`,
    );
  }

  const balances = (
    response.body as {
      balances: Array<{ member: { id: string }; balanceKurus: number }>;
    }
  ).balances;
  return new Map(balances.map((entry) => [entry.member.id, entry.balanceKurus]));
}
