# Data Model — Settle Up

Status: ready for review · Date: 2026-09-25 · Amended: 2026-09-25 (test-planner G-1 resolution + Gate 2 decisions; BR-GRP-011 reference fix — see §11)
Implements: D-ARCH-004 (fully derived ledger state) · ASM-002 (TRY, 2 decimals) · validates ASM-002 as required by the brief ("API/data-model design review").

## 1. Principles

1. **Facts only.** The database stores events/entities that happened: users, sessions, groups, memberships, join requests, expenses, expense shares, settled payments. Monetary *derived state* (member balances, outstanding suggestions) is computed on demand (D-ARCH-004) — never stored, so it cannot drift (OBJ-004).
2. **Integer kuruş.** Every money column is `Int` kuruş (ASM-002). Decimals exist only at the UI/JSON text boundary, converted by `packages/shared` `parseKurus`/`formatKurus`.
3. **One owning module per table** (01-system-architecture.md §3). Cross-module access via owning module's service.
4. **No deletions of record entities.** Groups, memberships, join requests, settled payments are retained for app life (NFR-GRP-002, NFR-BAL-005). Only expenses/shares have a delete path (BR-EXP-011) — a hard delete.

## 2. Entity catalog (consolidated from all domain reports)

| Entity | Source domain report | Storage | PK | Owning module (C#) |
|---|---|---|---|---|
| User Account | accounts-access §7 | `users` table | `id` | C2 Auth |
| Session | accounts-access §7 | `sessions` table | `id` | C2 Auth |
| Group (incl. join code) | groups-membership §7 | `groups` table | `id` | C3 Groups |
| Join Request | groups-membership §7 | `join_requests` table | `id` | C3 Groups |
| Membership | groups-membership §7 | `memberships` table | `id` | C3 Groups |
| Expense | expense-tracking §7 | `expenses` table | `id` | C4 Ledger |
| Expense Share | expense-tracking §7 | `expense_shares` table | `id` | C4 Ledger |
| Settlement Record (suggested payment) | balances-settlement §7 | `settled_payments` table (facts only — see §5.2) | `id` | C5 Settlement |
| Member Balance | balances-settlement §7 | **not stored** — derived (D-ARCH-004) | (groupId, userId) | C5 Settlement |
| Outstanding suggestion set | balances-settlement §7 (BR-BAL-008) | **not stored** — derived | — | C5 Settlement |

## 3. Entity–relationship diagram

```
users 1───0..* sessions
users 1───0..* memberships *───1 groups 1───1 creator(users)
users 1───0..* join_requests *───1 groups
users 1───0..* expenses(logger)          groups 1───0..* expenses
users 1───0..* expenses(payer)
expenses 1───1..* expense_shares *───1 users(participant)
groups 1───0..* settled_payments *───1 users(payer)
                                  *───1 users(recipient)
memberships: unique (groupId, userId)
join_requests: unique (groupId, userId)
expense_shares: unique (expenseId, participantId)
```

## 4. Reference Prisma schema (`apps/api/prisma/schema.prisma`)

```prisma
generator client { provider = "prisma-client-js" }

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum SplitType        { EQUAL EXACT }
enum JoinRequestStatus { PENDING APPROVED REJECTED }
enum PaymentStatus     { SETTLED UNDONE }

model User {
  id           String   @id @default(cuid())
  email        String   @unique              // lowercased at write; login identifier (login lowercases its input before lookup too — 03 §1)
  passwordHash String                         // Argon2id (m=19456, t=2, p=1)
  displayName  String                         // 1–50 chars; identity shown in groups (FR-ACC-008)
  createdAt    DateTime @default(now())

  sessions             Session[]
  memberships          Membership[]
  joinRequests         JoinRequest[]
  createdGroups        Group[]          @relation("GroupCreator")
  loggedExpenses       Expense[]        @relation("ExpenseLogger")
  paidExpenses         Expense[]        @relation("ExpensePayer")
  expenseShares        ExpenseShare[]
  paymentsMade         SettledPayment[] @relation("PaymentPayer")
  paymentsReceived     SettledPayment[] @relation("PaymentRecipient")
}

model Session {
  id        String   @id @default(cuid())
  tokenHash String   @unique              // SHA-256 of the 256-bit cookie token
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  createdAt DateTime @default(now())
  expiresAt DateTime                      // sliding 30 days

  @@index([userId, expiresAt])
}

model Group {
  id        String   @id @default(cuid())
  name      String                          // 1–100 chars (OQ-GRP-003 resolution)
  joinCode  String   @unique                // 8-char Crockford base32, CSPRNG (NFR-GRP-005)
  creatorId String
  creator   User     @relation("GroupCreator", fields: [creatorId], references: [id])
  createdAt DateTime @default(now())

  memberships     Membership[]
  joinRequests    JoinRequest[]
  expenses        Expense[]
  settledPayments SettledPayment[]
}

model JoinRequest {
  id        String            @id @default(cuid())
  groupId   String
  group     Group             @relation(fields: [groupId], references: [id])
  userId    String
  user      User              @relation(fields: [userId], references: [id])
  status    JoinRequestStatus @default(PENDING)
  createdAt DateTime          @default(now())
  decidedAt DateTime?               // set on approve/reject; cleared on re-request

  @@unique([groupId, userId])        // FR-GRP-012 + re-request semantics (§5.3)
}

model Membership {
  id        String   @id @default(cuid())
  groupId   String
  group     Group    @relation(fields: [groupId], references: [id])
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  isCreator Boolean                       // BR-GRP-005; creator row created with the group
  joinedAt  DateTime @default(now())

  @@unique([groupId, userId])             // BR-GRP-008 permanence: no delete path
}

model Expense {
  id          String    @id @default(cuid())
  groupId     String
  group       Group     @relation(fields: [groupId], references: [id])
  description String                          // 1–200 chars
  amountKurus Int                            // ≥ 0; ≤ 2,147,483,647 (§8)
  payerId     String
  payer       User      @relation("ExpensePayer", fields: [payerId], references: [id])
  splitType   SplitType
  loggerId    String
  logger      User      @relation("ExpenseLogger", fields: [loggerId], references: [id])
  createdAt   DateTime  @default(now())
  editedAt    DateTime?                      // absent until first edit (BR-EXP-008)

  shares ExpenseShare[]

  @@index([groupId, createdAt])              // expense list ordering: newest first
}

model ExpenseShare {
  id            String  @id @default(cuid())
  expenseId     String
  expense       Expense @relation(fields: [expenseId], references: [id], onDelete: Cascade)
  participantId String
  participant   User    @relation(fields: [participantId], references: [id])
  shareKurus    Int                          // ≥ 0; zero-kuruş exact shares allowed (OQ-EXP-003)

  @@unique([expenseId, participantId])
  @@index([participantId])                    // balance aggregation
}

model SettledPayment {
  id          String        @id @default(cuid())
  groupId     String
  group       Group         @relation(fields: [groupId], references: [id])
  payerId     String
  payer       User          @relation("PaymentPayer", fields: [payerId], references: [id])
  recipientId String
  recipient   User          @relation("PaymentRecipient", fields: [recipientId], references: [id])
  amountKurus Int                            // 1..2,147,483,647 (a payment of 0 is meaningless)
  status      PaymentStatus @default(SETTLED)
  paidAt      DateTime      @default(now())
  undoneAt    DateTime?                     // set on undo; row retained forever (NFR-BAL-005)

  @@index([groupId, status])
}
```

## 5. Relationship & lifecycle notes

### 5.1 Cardinalities (from domain reports, verified)

| Relationship | Cardinality | Enforcement |
|---|---|---|
| User — Session | 1 : 0..* | FK `sessions.userId` |
| User — Membership | 1 : 0..* (across groups); exactly ≤ 1 per (user, group) | `@@unique([groupId,userId])` |
| Group — Membership | 1 : 1..* (creator is created atomically with the group, BR-GRP-005) | transactional insert in `GroupsService.create` |
| User — JoinRequest | 1 : 0..* ; ≤ 1 row per (user, group) | `@@unique([groupId,userId])` |
| Group — Expense | 1 : 0..* | FK + index |
| Expense — ExpenseShare | 1 : 1..* (≥ 1 participant, BR-EXP-002; single participant allowed, OQ-EXP-001) | service validation + `@@unique` |
| Group — SettledPayment | 1 : 0..* | FK + index |
| Group — MemberBalance | 1 : 1..* (one per member) | derived, one row per member in the response |

### 5.2 Settlement Record status — resolution of the domain-report enum (D-ARCH-004)

The Balances report defines the Settlement Record conceptually with status `outstanding | settled` and lifecycle `outstanding ↔ settled` (BR-BAL-006). BR-BAL-008 simultaneously states that outstanding suggestions are **a plan regenerated whenever balances change**, and that settled payments are **permanent facts**.

**Resolution:** stored rows are facts only — `status ∈ {SETTLED, UNDONE}`:
- Mark paid (UC-BAL-003) validates the submitted (payer, recipient, amount) against the **current computed suggestion plan** and inserts a `SETTLED` row.
- Undo (UC-BAL-004) sets `status = UNDONE, undoneAt = now()`; the row is retained (NFR-BAL-005) and excluded from balance computation (BR-BAL-002 counts `SETTLED` only).
- "Outstanding" is a property of the **derived plan**, recomputed on every read (BR-BAL-008 is then true by construction). After an undo, balances revert to their pre-payment values, and the deterministic plan (01 §5.3) naturally re-includes the equivalent payment — behaviorally identical to "returned to outstanding" (UC-BAL-004 postcondition).

Rejected alternative: storing outstanding rows and rewriting them on every balance change — matches the literal enum but adds write-path churn, identity instability for "mark this one paid", and races between regeneration and mark-paid, for zero user-visible benefit. **This is a deliberate reading, flagged for the test-planner: tests should treat outstanding suggestions as ephemeral API output, not as stored state.**

### 5.3 Join Request re-request semantics (BR-GRP-010, FR-GRP-011/012)

One row per `(groupId, userId)`:
- `PENDING → APPROVED` (membership created; further requests impossible — user is a member, FR-GRP-013 → 409).
- `PENDING → REJECTED` (decidedAt set).
- `REJECTED → PENDING` on a new request (decidedAt cleared): implements "may submit a new join request" (BR-GRP-010) while the composite unique key structurally guarantees "no second pending request" (FR-GRP-012).

Rejected alternative: append-only request rows + partial unique index `WHERE status='PENDING'` (raw SQL migration) — preserves full decision history; rejected as extra complexity for a friend-group app. **Trade-off (flagged): only the latest decision per (user, group) is retained.** NFR-GRP-002 retention is satisfied (rows never deleted); the *history* of superseded decisions is not kept.

### 5.4 Money fields summary

| Field | Type | Constraints |
|---|---|---|
| `expenses.amountKurus` | Int | ≥ 0 (BR-EXP-010; zero allowed), ≤ 2,147,483,647 (§8) |
| `expense_shares.shareKurus` | Int | ≥ 0 (zero allowed, OQ-EXP-003); Σ per expense = `amountKurus` (service invariant + tests) |
| `settled_payments.amountKurus` | Int | ≥ 1; must exactly match a current suggestion (03 §3.4) |

## 6. Ownership matrix (who writes, who reads)

| Table | Owning module (writes) | Reading modules | Read path |
|---|---|---|---|
| `users` | C2 Auth (create on register; update passwordHash) | C3, C4, C5 | `UsersService` — display names & ids only in group-scoped read models |
| `sessions` | C2 Auth | — (internal) | — |
| `groups` | C3 Groups | C2 (n/a), C4, C5 | via `MembershipService.isMember/groupId resolution` |
| `join_requests` | C3 Groups | C3 (creator views) | internal |
| `memberships` | C3 Groups | C4, C5 (authorization), C1 via API | `GroupMemberGuard`, member lists |
| `expenses` | C4 Ledger | C5 Settlement | `LedgerReadService` (group-scoped reads for balance computation) |
| `expense_shares` | C4 Ledger | C5 Settlement | `LedgerReadService` |
| `settled_payments` | C5 Settlement | C5 (balances, settle-up view) | internal |

**Derived read models (C5):** `balances(group)` and `settlementPlan(group)` — SQL aggregations + engine calls; no table, no migration, no cache.

## 7. Derived balance computation (reference SQL)

```sql
-- balance(member_id, group_id), all integer kuruş; SUM(int) → bigint (exact)
SELECT
  (SELECT COALESCE(SUM(e.amountKurus), 0) FROM expenses e
    WHERE e.group_id = $group AND e.payer_id = $member)
  - (SELECT COALESCE(SUM(s.share_kurus), 0) FROM expense_shares s
     JOIN expenses e ON e.id = s.expense_id
    WHERE e.group_id = $group AND s.participant_id = $member)
  + (SELECT COALESCE(SUM(p.amount_kurus), 0) FROM settled_payments p
    WHERE p.group_id = $group AND p.payer_id = $member AND p.status = 'SETTLED')
  - (SELECT COALESCE(SUM(p.amount_kurus), 0) FROM settled_payments p
    WHERE p.group_id = $group AND p.recipient_id = $member AND p.status = 'SETTLED');
```

Zero-sum proof (per group, integer arithmetic): Σ_members balance = Σ_expenses amount − Σ_shares + Σ_settled(payer) − Σ_settled(recipient) = 0, because Σ_shares = Σ_expense amounts (per-expense invariant) and each settled payment contributes +X and −X. Implemented in one Prisma `queryRaw` per group; results assembled per member and returned by `GET /api/groups/:id/balances` (sums of bigint ≪ 2^53 → exact in JS numbers).

## 8. Money representation (ASM-002 validation)

- **Storage:** `Int` kuruş. Effective per-amount bound: 2,147,483,647 kuruş = **₺21,474,836.47**. `parseKurus` rejects anything above it (technical necessity of integer storage — flagged; rejected alternative `BigInt` columns: exact but BigInt handling infects all TS code for a bound no friend-group expense will approach).
- **Parsing (single source of truth, `packages/shared`):** accepts `"123.45"` / `"123.4"` / `"123"`; rejects `"-1"`, `"1.234"`, `"1,23"`, non-numeric, empty. Zero accepted (BR-EXP-010).
- **Formatting:** `formatKurus(12345) → "123.45"` for display; API payloads carry kuruš integers AND a pre-formatted string where convenient for the UI.
- Aggregations stay in SQL (bigint); JS side stays < 2^53 — no float ever touches a stored money value.

## 9. Invariants and their enforcement

| Invariant | Source | Enforcement |
|---|---|---|
| Shares of an expense sum exactly to its amount | BR-EXP-006, NFR-EXP-003 | `LedgerService` computes/validates before write; expense+shares in one transaction; property tests |
| Group balances sum to 0.00 TRY | OBJ-004, SC-005, BR-BAL-003 | By construction (§7) + integration tests after every op |
| No second pending join request per (user, group) | FR-GRP-012 | `@@unique([groupId,userId])` |
| One membership per (user, group); permanent | BR-GRP-008 | `@@unique` + no delete code path |
| Emails unique | BR-ACC-002 | `@unique` + lowercased at write; login normalizes its input to lowercase before lookup — mixed-case credentials reach the same account (user decision 2026-09-25; 03 §1) |
| Marked-paid payments match a live suggestion | BR-BAL-004/008 context | Validated against current computed plan inside the same DB transaction (03 §3.4) |

Rejected alternative for the zero-sum invariant: Postgres deferred constraint trigger asserting Σ balances = 0 — rejected as overkill when balances are derived and the sum is 0 by construction; SC-005 tests cover regressions.

## 10. Conflicts between domains over entities — resolutions

| # | Conflict / tension | Resolution & why |
|---|---|---|
| 1 | Member Balance: Balances report owns it, but it is defined over Expense Tracking's shares | Derived, not stored (D-ARCH-004 — user decision). C5 owns the *computation*; C4 owns the *inputs*. No entity conflict because there is no row to own. |
| 2 | Settlement Record `outstanding` status vs. BR-BAL-008 regeneration | §5.2 — stored facts only (`SETTLED/UNDONE`); outstanding is derived. Why: a stored plan that must be regenerated on every change is a cache with races, not a fact. |
| 3 | Expense Share ownership (Expense Tracking) vs. Settlement's dependence on it | C4 writes; C5 reads via `LedgerReadService` only. The contract — "shares sum exactly to the expense amount" — is C4's tested obligation (NFR-EXP-003). |
| 4 | User identity: Groups/Ledger/Settlement all need member identity | C2 owns `users`; all group-scoped read models expose `{id, displayName}` only — email never crosses into group responses (FR-ACC-008). |
| 5 | Group name field absent from brief | OQ-GRP-003 resolution: `name` (1–100 chars), required at creation. Why: members must distinguish ~5 concurrent groups in the UI. |
| 6 | Join-request history vs. single-pending guarantee | §5.3 — row reuse, latest decision only. Flagged trade-off. |

## 11. Migration & change management

- Prisma Migrate is the single source of schema truth; one migration history in `apps/api/prisma/migrations`.
- CI applies `prisma migrate deploy` to the ephemeral test database on every run (04-ci-pipeline.md) — migrations are exercised continuously.
- Production: owner runs `prisma migrate deploy` as part of the documented deploy step (01 §10). Schema changes always land via migration; no ad-hoc DDL.
- **Change propagation:** this is the initial data model; no FRs/UCs/TCs/tickets exist yet that trace to entities. If this model changes later, the affected FRs (per 01 §6) and any tests/tickets derived from them must be re-validated by test-planner and planner.

- **2026-09-25 — amendment (test-planner G-1 resolution + Gate 2 user decisions):** email normalization made explicit at both boundaries (§4 schema comment, §9 invariant row) — registration lowercases at write (unchanged), and login lowercases its input before lookup (user decision, 2026-09-25), so mixed-case credentials authenticate to the same account. No entity, key, cardinality, or invariant changed. Related: the login-throttle counter keys on the same normalized email (01 §8.2). Downstream: the accounts-access test plan finalizes **TC-ACC-030** (email normalization); TC-ACC-031 (throttle) and any precedence TCs trace to the 01/03 amendments of the same date.
- **2026-09-25 — amendment (documentation defect — dangling BR-GRP-011 reference):** §5.3's heading cited "(BR-GRP-010/011, FR-GRP-011/012)", but the groups analysis defines only BR-GRP-001…010 — re-request is **BR-GRP-010**; the stray "/011" is removed (FR-GRP-011/012 both exist and remain cited). The section body already cited BR-GRP-010 correctly; 01/02/03 contain no other occurrence of the stray reference (the coverage matrix already noted "BR-GRP-011 does not exist — numbering ends at 010"). No entity, key, cardinality, invariant, or state-machine change — §5.3's semantics are untouched, and its approve/reject surface is specified the same date in 03 §3. Downstream (change propagation): the test-planner must re-validate the affected TCs — **TC-GRP-018/019** (items 1–2 — amended in 03 §3; TC-GRP-019 traces to §5.3, whose citation is now corrected, semantics unchanged), **TC-ACC-028** (item 3 — amended in 01 §10), and the **expense/balances plans' §1 exclusions plus coverage-matrix rows L-4/L-6/L-7** (item 4 — amended in 03 §4). No tickets exist yet (`.pipeline/plan/` not created), so no ticket re-validation is needed.
