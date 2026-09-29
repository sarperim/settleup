/**
 * Integration test factories (TKT-accounts-001; 00-test-strategy.md §5).
 *
 * Write paths are exercised through the public API. `registerUser` is the
 * first factory and lands with the ticket that owns its route (Accounts &
 * Access).
 */
import type { Server } from 'node:http';
import { api, CSRF_HEADERS } from './app';
import type { PrismaService } from '../../../src/prisma/prisma.service';

/** Fixed fixture identity password prefix (strategy §5). */
export const TEST_PASSWORD = 'password-1';

export interface RegisteredUser {
  readonly id: string;
  readonly email: string;
  /** The `settleup_session=<token>` pair, ready for a `Cookie` header. */
  readonly cookie: string;
}

/**
 * Drive `POST /api/auth/register` and return `{ id, email, cookie }`.
 *
 * The email returned is the normalized (lowercased) stored form, matching the
 * 02-data-model.md §4 write contract.
 */
export async function registerUser(
  server: Server,
  email: string,
  password: string,
  displayName: string,
): Promise<RegisteredUser> {
  const response = await api(server)
    .post('/api/auth/register')
    .set(CSRF_HEADERS)
    .send({ email, password, displayName });

  if (response.status !== 201) {
    throw new Error(
      `registerUser fixture failed: expected 201, got ${response.status} (${JSON.stringify(response.body)})`,
    );
  }

  return {
    id: (response.body as { user: { id: string } }).user.id,
    email: email.trim().toLowerCase(),
    cookie: sessionCookiePair(response.headers['set-cookie']),
  };
}

/**
 * Extract the `settleup_session=<token>` pair from a `Set-Cookie` header.
 * Throws when the cookie is absent so a fixture failure is loud.
 */
export function sessionCookiePair(
  setCookie: string | string[] | undefined,
): string {
  const header = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  if (header === undefined) {
    throw new Error('expected a settleup_session Set-Cookie header, found none');
  }
  const pair = header.split(';', 1)[0];
  if (pair === undefined || !pair.startsWith('settleup_session=')) {
    throw new Error(`unexpected session cookie header: ${header}`);
  }
  return pair;
}

/** Read a raw `Set-Cookie` header value for the given cookie name. */
export function findSetCookie(
  setCookie: string | string[] | undefined,
  name: string,
): string | undefined {
  const headers = Array.isArray(setCookie) ? setCookie : [setCookie];
  return headers.find(
    (header): header is string =>
      typeof header === 'string' && header.startsWith(`${name}=`),
  );
}

/** The creator reference a group read model carries (FR-ACC-008). */
export interface UserRefFixture {
  readonly id: string;
  readonly displayName: string;
}

/** A group as returned by `createGroup` (03-api-design.md §3). */
export interface CreatedGroup {
  readonly id: string;
  readonly name: string;
  readonly creator: UserRefFixture;
  readonly createdAt: string;
  readonly joinCode: string;
}

/**
 * Drive `POST /api/groups` and return the created `{ group }` incl. its join
 * code (strategy §5: `createGroup(creatorCookie, name)`). Lands with
 * TKT-groups-001 — it owns the route.
 */
export async function createGroup(
  server: Server,
  creatorCookie: string,
  name = 'Trip',
): Promise<CreatedGroup> {
  const response = await api(server)
    .post('/api/groups')
    .set(CSRF_HEADERS)
    .set('Cookie', creatorCookie)
    .send({ name });

  if (response.status !== 201) {
    throw new Error(
      `createGroup fixture failed: expected 201, got ${response.status} (${JSON.stringify(response.body)})`,
    );
  }

  return (response.body as { group: CreatedGroup }).group;
}

/** A join request as returned by the join-flow routes (03 §3). */
export interface JoinRequestFixture {
  readonly id: string;
  readonly groupId: string;
  readonly requester: UserRefFixture;
  readonly status: 'PENDING' | 'APPROVED' | 'REJECTED';
  readonly createdAt: string;
  readonly decidedAt?: string;
}

/**
 * Drive `POST /api/join-requests` and return the created `{ joinRequest }`.
 * The pending-request-precondition helper shared by the approve/reject TCs;
 * lands with TKT-groups-003 alongside `joinAndApprove`.
 */
export async function placeJoinRequest(
  server: Server,
  joinerCookie: string,
  code: string,
): Promise<JoinRequestFixture> {
  const response = await api(server)
    .post('/api/join-requests')
    .set(CSRF_HEADERS)
    .set('Cookie', joinerCookie)
    .send({ code });

  if (response.status !== 201) {
    throw new Error(
      `placeJoinRequest fixture failed: expected 201, got ${response.status} (${JSON.stringify(response.body)})`,
    );
  }

  return (response.body as { joinRequest: JoinRequestFixture }).joinRequest;
}

/**
 * Strategy §5 factory: place a pending request as `joinerCookie`, then have
 * `creatorCookie` approve it → an approved member. Lands with TKT-groups-003,
 * which owns the approve route; returns the decided `{ joinRequest }`.
 */
export async function joinAndApprove(
  server: Server,
  creatorCookie: string,
  joinerCookie: string,
  code: string,
): Promise<JoinRequestFixture> {
  const request = await placeJoinRequest(server, joinerCookie, code);

  const response = await api(server)
    .post(`/api/join-requests/${request.id}/approve`)
    .set(CSRF_HEADERS)
    .set('Cookie', creatorCookie);

  if (response.status !== 200) {
    throw new Error(
      `joinAndApprove fixture failed: expected 200, got ${response.status} (${JSON.stringify(response.body)})`,
    );
  }

  return (response.body as { joinRequest: JoinRequestFixture }).joinRequest;
}

/** The expense request body the `createExpense` factory drives (03 §3b). */
export interface CreateExpenseInput {
  readonly description: string;
  readonly amountKurus: number;
  readonly payerId: string;
  readonly participantIds: readonly string[];
  readonly splitType: 'EQUAL' | 'EXACT';
  readonly exactAmounts?: Readonly<Record<string, number>>;
}

/** One stored share of a created expense (FR-ACC-008 references). */
export interface ExpenseShareFixture {
  readonly participant: UserRefFixture;
  readonly shareKurus: number;
}

/** An expense as returned by the create/detail routes (03 §3b). */
export interface CreatedExpense {
  readonly id: string;
  readonly description: string;
  readonly amountKurus: number;
  readonly splitType: 'EQUAL' | 'EXACT';
  readonly payer: UserRefFixture;
  readonly logger: UserRefFixture;
  readonly shares: ExpenseShareFixture[];
  readonly createdAt: string;
  readonly editedAt?: string;
}

/**
 * Strategy §5 factory: drive `POST /api/groups/:groupId/expenses` and return
 * the created `{ expense }`. Lands with TKT-exp-002, which owns the route.
 */
export async function createExpense(
  server: Server,
  memberCookie: string,
  groupId: string,
  expenseInput: CreateExpenseInput,
): Promise<CreatedExpense> {
  const response = await api(server)
    .post(`/api/groups/${groupId}/expenses`)
    .set(CSRF_HEADERS)
    .set('Cookie', memberCookie)
    .send(expenseInput);

  if (response.status !== 201) {
    throw new Error(
      `createExpense fixture failed: expected 201, got ${response.status} (${JSON.stringify(response.body)})`,
    );
  }

  return (response.body as { expense: CreatedExpense }).expense;
}

/**
 * Seed a membership row directly (strategy §5: direct Prisma seeding is
 * permitted for **read-path fixtures** — member-list/overview/group-detail
 * reads over pre-existing facts). The API-driven `joinAndApprove` factory lands
 * with TKT-groups-003, which owns the approve route; TKT-groups-001/002's
 * read-side TCs need approved members before that route exists, so they seed
 * the fact.
 */
export async function seedMembership(
  prisma: PrismaService,
  groupId: string,
  userId: string,
  isCreator = false,
): Promise<void> {
  await prisma.membership.create({
    data: { groupId, userId, isCreator },
  });
}
