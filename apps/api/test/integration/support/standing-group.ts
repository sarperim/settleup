/**
 * Standing group fixture (TKT-exp-002; testing/expense-tracking.md
 * §2 conventions).
 *
 * The expense-domain integration cases all start from the same fixture: the
 * group creator `alice@test.local` plus the approved members `bob@test.local`
 * and `carol@test.local` (passwords `password-1`). It is assembled from the
 * strategy §5 factories only — `createGroup` (alice) then `joinAndApprove`
 * (bob, carol) — never from direct membership seeding, so the fixture runs the
 * real join/approve path.
 */
import type { Server } from 'node:http';
import {
  createGroup,
  joinAndApprove,
  registerUser,
  TEST_PASSWORD,
  type CreatedGroup,
  type RegisteredUser,
} from './factories';

/** The standing fixture: alice (creator), bob and carol (approved members). */
export interface StandingGroup {
  readonly alice: RegisteredUser;
  readonly bob: RegisteredUser;
  readonly carol: RegisteredUser;
  readonly group: CreatedGroup;
}

/** Build the standing group through the public API. */
export async function createStandingGroup(
  server: Server,
): Promise<StandingGroup> {
  const alice = await registerUser(
    server,
    'alice@test.local',
    TEST_PASSWORD,
    'Alice',
  );
  const bob = await registerUser(server, 'bob@test.local', TEST_PASSWORD, 'Bob');
  const carol = await registerUser(
    server,
    'carol@test.local',
    TEST_PASSWORD,
    'Carol',
  );

  const group = await createGroup(server, alice.cookie, 'Trip');
  await joinAndApprove(server, alice.cookie, bob.cookie, group.joinCode);
  await joinAndApprove(server, alice.cookie, carol.cookie, group.joinCode);

  return { alice, bob, carol, group };
}

/** A registered non-member (dave) for FR-EXP-003 cases. */
export async function registerNonMember(server: Server): Promise<RegisteredUser> {
  return registerUser(server, 'dave@test.local', TEST_PASSWORD, 'Dave');
}
