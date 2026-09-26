import { describe, expect, it } from 'vitest';

import type {
  BalancesResponseDto,
  ChangePasswordRequestDto,
  CreateExpenseRequestDto,
  CreateGroupRequestDto,
  EditExpenseRequestDto,
  ErrorEnvelopeDto,
  ExpenseDto,
  ExpenseResponseDto,
  ExpenseShareDto,
  ExpensesResponseDto,
  GroupDto,
  GroupResponseDto,
  GroupsResponseDto,
  JoinByCodeRequestDto,
  JoinInfoDto,
  JoinRequestDto,
  JoinRequestResponseDto,
  JoinRequestsResponseDto,
  LoginRequestDto,
  MarkPaidRequestDto,
  MemberBalanceDto,
  MemberDto,
  MembersResponseDto,
  OutstandingSuggestionDto,
  RegisterRequestDto,
  SettlementDto,
  SettlementResponseDto,
  SettleUpViewDto,
  UserDto,
  UserRefDto,
  UserResponseDto,
} from '../../src/index';

/**
 * TKT-foundation-003 — explicit acceptance criterion 1 (ticket file):
 * "The package typechecks and exports every DTO type for the shapes
 * documented in 03 §2/§3/§3b/§3c" plus the §4 error envelope.
 *
 * Each exported DTO type is pinned here twice:
 *
 * 1. **Type level** — every sample below is a fully typed literal of the
 *    exported type, so a field rename/removal in `src/dto/**` breaks these
 *    literals (editor/tsc feedback now; CI-enforced once package
 *    typecheck covers test code — planner item C-3).
 * 2. **Runtime level** — the exact key set of each sample is asserted, so
 *    the documented shape of the frozen contract is executable and fails
 *    `vitest run` on drift.
 *
 * Samples follow the shape assertions of the approved test plans where they
 * exist (e.g. TC-GRP-007's exactly-`{groupId, groupName}` join-info body,
 * TC-EXP-007/022's expense shape, TC-BAL-006/007's balances/settlements
 * shapes).
 */

/** Sorted key set of a sample object (order-insensitive exact key match). */
const keySet = (sample: object): string[] => Object.keys(sample).sort();

/** Sorted expected key set (hand-sorting drifts; sort programmatically). */
const expectedKeys = (...keys: string[]): string[] => [...keys].sort();

/** Shared id fixture style — display names only in group-scoped payloads. */
const alice: UserRefDto = { id: 'usr_alice', displayName: 'Alice' };
const bob: UserRefDto = { id: 'usr_bob', displayName: 'Bob' };
const carol: UserRefDto = { id: 'usr_carol', displayName: 'Carol' };

describe('TKT-foundation-003 criterion 1 — DTO shape freeze (03 §2/§3/§3b/§3c/§4)', () => {
  it('§2 — auth DTOs', () => {
    const registerRequest: RegisterRequestDto = {
      email: 'alice@test.local',
      password: 'password-1',
      displayName: 'Alice',
    };
    const loginRequest: LoginRequestDto = {
      email: 'alice@test.local',
      password: 'password-1',
    };
    const changePasswordRequest: ChangePasswordRequestDto = {
      currentPassword: 'password-1',
      newPassword: 'password-2',
    };
    const user: UserDto = {
      id: 'usr_alice',
      email: 'alice@test.local',
      displayName: 'Alice',
      createdAt: '2026-09-26T09:00:00.000Z',
    };
    const userResponse: UserResponseDto = { user };

    expect(keySet(registerRequest)).toEqual(
      expectedKeys('displayName', 'email', 'password'),
    );
    expect(keySet(loginRequest)).toEqual(expectedKeys('email', 'password'));
    expect(keySet(changePasswordRequest)).toEqual(
      expectedKeys('currentPassword', 'newPassword'),
    );
    expect(keySet(user)).toEqual(
      expectedKeys('createdAt', 'displayName', 'email', 'id'),
    );
    expect(keySet(userResponse)).toEqual(expectedKeys('user'));
    // POST /api/auth/logout and POST /api/auth/password return 204 — no body.
  });

  it('§3 — groups & membership DTOs', () => {
    const createGroupRequest: CreateGroupRequestDto = { name: 'Trip' };
    const joinByCodeRequest: JoinByCodeRequestDto = { code: 'AAAAAAAA' };
    const group: GroupDto = {
      id: 'grp_trip',
      name: 'Trip',
      creator: alice,
      createdAt: '2026-09-26T09:00:00.000Z',
      joinCode: 'AAAAAAAA',
    };
    const groupResponse: GroupResponseDto = { group };
    const groupsResponse: GroupsResponseDto = { groups: [group] };
    const member: MemberDto = {
      id: 'usr_alice',
      displayName: 'Alice',
      isCreator: true,
      joinedAt: '2026-09-26T09:00:00.000Z',
    };
    const membersResponse: MembersResponseDto = { members: [member] };
    const joinInfo: JoinInfoDto = { groupId: 'grp_trip', groupName: 'Trip' };
    const joinRequest: JoinRequestDto = {
      id: 'jnr_bob',
      groupId: 'grp_trip',
      requester: bob,
      status: 'PENDING',
      createdAt: '2026-09-26T09:05:00.000Z',
      decidedAt: '2026-09-26T09:10:00.000Z',
    };
    const joinRequestResponse: JoinRequestResponseDto = { joinRequest };
    const joinRequestsResponse: JoinRequestsResponseDto = {
      requests: [joinRequest],
    };

    expect(keySet(createGroupRequest)).toEqual(expectedKeys('name'));
    expect(keySet(joinByCodeRequest)).toEqual(expectedKeys('code'));
    expect(keySet(group)).toEqual(
      expectedKeys('createdAt', 'creator', 'id', 'joinCode', 'name'),
    );
    expect(keySet(groupResponse)).toEqual(expectedKeys('group'));
    expect(keySet(groupsResponse)).toEqual(expectedKeys('groups'));
    expect(keySet(member)).toEqual(
      expectedKeys('displayName', 'id', 'isCreator', 'joinedAt'),
    );
    expect(keySet(membersResponse)).toEqual(expectedKeys('members'));
    expect(keySet(joinInfo)).toEqual(expectedKeys('groupId', 'groupName'));
    expect(keySet(joinRequest)).toEqual(
      expectedKeys(
        'createdAt',
        'decidedAt',
        'groupId',
        'id',
        'requester',
        'status',
      ),
    );
    expect(keySet(joinRequestResponse)).toEqual(expectedKeys('joinRequest'));
    expect(keySet(joinRequestsResponse)).toEqual(expectedKeys('requests'));
  });

  it('§3b — expense DTOs (no date field anywhere — BR-EXP-008)', () => {
    const createRequest: CreateExpenseRequestDto = {
      description: 'Dinner',
      amountKurus: 9000,
      payerId: 'usr_alice',
      participantIds: ['usr_alice', 'usr_bob', 'usr_carol'],
      splitType: 'EQUAL',
    };
    const createExactRequest: CreateExpenseRequestDto = {
      description: 'Tickets',
      amountKurus: 5000,
      payerId: 'usr_bob',
      participantIds: ['usr_alice', 'usr_bob', 'usr_carol'],
      splitType: 'EXACT',
      exactAmounts: { usr_alice: 0, usr_bob: 2500, usr_carol: 2500 },
    };
    const editRequest: EditExpenseRequestDto = {
      description: 'Dinner 2',
      amountKurus: 12000,
      payerId: 'usr_bob',
      participantIds: ['usr_alice', 'usr_bob'],
      splitType: 'EXACT',
      exactAmounts: { usr_alice: 6000, usr_bob: 6000 },
    };
    const share: ExpenseShareDto = { participant: bob, shareKurus: 3000 };
    const expense: ExpenseDto = {
      id: 'exp_dinner',
      description: 'Dinner',
      amountKurus: 9000,
      splitType: 'EQUAL',
      payer: alice,
      logger: alice,
      shares: [
        { participant: alice, shareKurus: 3000 },
        share,
        { participant: carol, shareKurus: 3000 },
      ],
      createdAt: '2026-09-26T10:00:00.000Z',
      editedAt: '2026-09-26T11:00:00.000Z',
    };
    const expenseResponse: ExpenseResponseDto = { expense };
    const expensesResponse: ExpensesResponseDto = { expenses: [expense] };

    expect(keySet(createRequest)).toEqual(
      expectedKeys(
        'amountKurus',
        'description',
        'payerId',
        'participantIds',
        'splitType',
      ),
    );
    expect(keySet(createExactRequest)).toEqual(
      expectedKeys(
        'amountKurus',
        'description',
        'exactAmounts',
        'payerId',
        'participantIds',
        'splitType',
      ),
    );
    expect(keySet(editRequest)).toEqual(
      expectedKeys(
        'amountKurus',
        'description',
        'exactAmounts',
        'payerId',
        'participantIds',
        'splitType',
      ),
    );
    expect(keySet(share)).toEqual(expectedKeys('participant', 'shareKurus'));
    expect(keySet(expense)).toEqual(
      expectedKeys(
        'amountKurus',
        'createdAt',
        'description',
        'editedAt',
        'id',
        'logger',
        'payer',
        'shares',
        'splitType',
      ),
    );
    expect(keySet(expenseResponse)).toEqual(expectedKeys('expense'));
    expect(keySet(expensesResponse)).toEqual(expectedKeys('expenses'));
  });

  it('§3c — balances & settlement DTOs', () => {
    const memberBalance: MemberBalanceDto = {
      member: bob,
      balanceKurus: -3000,
    };
    const balancesResponse: BalancesResponseDto = {
      balances: [
        { member: alice, balanceKurus: 6000 },
        memberBalance,
        { member: carol, balanceKurus: -3000 },
      ],
      sumKurus: 0,
    };
    const outstanding: OutstandingSuggestionDto = {
      payer: bob,
      recipient: alice,
      amountKurus: 3000,
    };
    const settlement: SettlementDto = {
      id: 'stm_bob_alice',
      payer: bob,
      recipient: alice,
      amountKurus: 3000,
      status: 'SETTLED',
      paidAt: '2026-09-26T12:00:00.000Z',
      undoneAt: '2026-09-26T13:00:00.000Z',
    };
    const settleUpView: SettleUpViewDto = {
      outstanding: [outstanding],
      settled: [settlement],
    };
    const markPaidRequest: MarkPaidRequestDto = {
      payerId: 'usr_bob',
      recipientId: 'usr_alice',
      amountKurus: 3000,
    };
    const settlementResponse: SettlementResponseDto = { settlement };

    expect(keySet(memberBalance)).toEqual(
      expectedKeys('balanceKurus', 'member'),
    );
    expect(keySet(balancesResponse)).toEqual(
      expectedKeys('balances', 'sumKurus'),
    );
    expect(keySet(outstanding)).toEqual(
      expectedKeys('amountKurus', 'payer', 'recipient'),
    );
    expect(keySet(settlement)).toEqual(
      expectedKeys(
        'amountKurus',
        'id',
        'paidAt',
        'payer',
        'recipient',
        'status',
        'undoneAt',
      ),
    );
    expect(keySet(settleUpView)).toEqual(expectedKeys('outstanding', 'settled'));
    expect(keySet(markPaidRequest)).toEqual(
      expectedKeys('amountKurus', 'payerId', 'recipientId'),
    );
    expect(keySet(settlementResponse)).toEqual(expectedKeys('settlement'));
  });

  it('§4 — error envelope (exactly { code, message, details? })', () => {
    const envelope: ErrorEnvelopeDto = {
      error: {
        code: 'EMAIL_TAKEN',
        message: 'An account with this email already exists.',
        details: { field: 'email' },
      },
    };

    expect(keySet(envelope)).toEqual(expectedKeys('error'));
    expect(keySet(envelope.error)).toEqual(expectedKeys('code', 'details', 'message'));
  });
});
