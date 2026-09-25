# Groups & Membership Analysis

## 1. Overview

Groups & Membership delivers the private shared-expense circles at the heart of Settle Up. Any registered user creates a group and becomes its creator; the system issues a join code/link that the creator shares; registered users holding the code request to join; membership takes effect only when the creator approves. A user can belong to multiple groups at once, and groups persist indefinitely.

Business value: the group is the container in which the friend group's shared expenses live — the adoption target of **OBJ-001**. This domain owns the membership record, which is the single source of truth for the **OBJ-005** privacy boundary: only approved members may see a group's expenses, balances, and members (verified by SC-006).

## 2. Actors

| Actor | Goal | Frequency |
|---|---|---|
| Group creator (any registered user who creates a group) | Create the group, share its join code, approve or reject join requests | Creation: once per group. Approvals: occasional. |
| Joiner (registered, non-member) | Join a group using a received join code | Occasional (new groups, new friends) |
| Group member | See the group's member list; via downstream domains, its expenses and balances | Every visit |
| Non-member (anonymous or registered) | Must be denied all access to group data | Adversarial (SC-006) |
| Downstream domains (system actors) | Consult the membership record to authorize group-scoped data (expenses, balances) | Every group-scoped request |

## 3. Business Rules

- **BR-GRP-001** — Any registered user may create a group and thereby becomes its creator. Source: brief §5. Enforced: system.
- **BR-GRP-002** — Each group has exactly one join code/link, generated at creation and held by the creator. Source: brief §5. Enforced: system.
- **BR-GRP-003** — A registered user must present the group's join code to place a join request; without the code, no request is possible. Source: brief §5. Enforced: system.
- **BR-GRP-004** — Membership takes effect only when the creator approves the join request; the creator may instead reject it. Source: brief §5. Enforced: system.
- **BR-GRP-005** — The creator is a member of the group from the moment of creation. Source: brief §10 (glossary: "Group creator — the member who created the group"). Enforced: system.
- **BR-GRP-006** — A user may hold memberships in multiple groups simultaneously. Source: brief §5. Enforced: system.
- **BR-GRP-007** — Groups persist indefinitely; there is no group deletion or archiving (Won't — this release). Source: brief §5, §6. Enforced: system (feature intentionally absent).
- **BR-GRP-008** — Once a member, always a member; there is no member removal (Won't — this release). Source: brief §6. Enforced: system (feature intentionally absent).
- **BR-GRP-009** — Only members of a group may see its expenses, balances, and member list; everyone else — anonymous or registered — is denied. Source: brief §3 (OBJ-005), §9 (SC-006). Enforced: system (authorization on every group-scoped view and operation).
- **BR-GRP-010** — A user whose join request was rejected may submit a new join request. Source: user decision at report gate, 2026-09-25 (brief silent). Enforced: system.

## 4. Use Cases

### UC-GRP-001 — Create a group
- Primary actor: registered user
- Preconditions: authenticated session
- Main success scenario:
  1. User chooses to create a group and provides a group name/label.
  2. System creates the group with the user as creator and first member (BR-GRP-005).
  3. System generates the group's join code/link and shows it to the creator.
- Alternate flows: —
- Error flows:
  - E1: Missing/invalid group name → system rejects; no group is created.
- Postconditions: the group exists; the creator is a member; a join code exists and is visible to the creator.

### UC-GRP-002 — Request to join a group
- Primary actor: registered user (non-member)
- Preconditions: authenticated session; user holds the group's join code/link
- Main success scenario:
  1. User submits the join code (by opening the link or entering the code).
  2. System resolves the code to the group.
  3. User confirms the join request.
  4. System records the join request as pending and makes it visible to the group's creator.
- Alternate flows:
  - A1: User is already a member of the group → system informs them; no request is created.
  - A2: User already has a pending request for the group → system informs them; no duplicate request is created.
- Error flows:
  - E1: Code matches no group → system rejects; no request is created.
- Postconditions: a pending join request exists for (user, group), visible to the creator.

### UC-GRP-003 — Approve a join request
- Primary actor: group creator
- Preconditions: a pending join request exists for the group
- Main success scenario:
  1. Creator opens the group's pending join requests.
  2. Creator approves a request.
  3. System establishes the requester's membership and closes the request.
- Alternate flows: —
- Error flows: —
- Postconditions: the requester is a member of the group; the request is no longer pending.

### UC-GRP-004 — Reject a join request
- Primary actor: group creator
- Preconditions: a pending join request exists for the group
- Main success scenario:
  1. Creator opens the group's pending join requests.
  2. Creator rejects a request.
  3. System closes the request without establishing membership.
- Alternate flows: —
- Error flows: —
- Postconditions: the requester is not a member; the requester may submit a new request later (BR-GRP-010). The requester learns the outcome out-of-band — there are no notifications this release (brief §6).

### UC-GRP-005 — View a group's members
- Primary actor: group member
- Preconditions: authenticated session; membership in the group
- Main success scenario:
  1. Member opens the group's member list.
  2. System shows all members, identified by display names (FR-ACC-008).
- Alternate flows: —
- Error flows: —
- Postconditions: read-only; no data changes.

### UC-GRP-006 — Access group data as a non-member (negative case)
- Primary actor: any non-member (anonymous or registered)
- Preconditions: actor is not a member of the target group
- Main success scenario:
  1. Non-member attempts to open or modify the group's expenses, balances, or member list.
  2. System denies access and discloses none of the group's data.
- Alternate flows: —
- Error flows: —
- Postconditions: no group data is disclosed or changed.

## 5. Functional Requirements

- **FR-GRP-001** — The system shall allow any authenticated user to create a group, becoming its creator and first member. Traces to: UC-GRP-001. MoSCoW: **Must**.
- **FR-GRP-002** — The system shall generate a unique join code for each group at creation and display it to the group's creator whenever they view the group. Traces to: UC-GRP-001, BR-GRP-002. MoSCoW: **Must**.
- **FR-GRP-003** — The system shall allow an authenticated user who presents a valid join code to place a join request for the matching group. Traces to: UC-GRP-002. MoSCoW: **Must**.
- **FR-GRP-004** — The system shall reject a join attempt whose code matches no group. Traces to: UC-GRP-002 (E1). MoSCoW: **Must**.
- **FR-GRP-005** — The system shall present a group's pending join requests to that group's creator. Traces to: UC-GRP-003, UC-GRP-004. MoSCoW: **Must**.
- **FR-GRP-006** — The system shall, on the creator's approval of a join request, establish the requester's membership in the group. Traces to: UC-GRP-003. MoSCoW: **Must**.
- **FR-GRP-007** — The system shall, on the creator's rejection of a join request, close the request without establishing membership. Traces to: UC-GRP-004. MoSCoW: **Must**.
- **FR-GRP-008** — The system shall deny every attempt by a non-member — anonymous or registered — to read or modify a group's expenses, balances, or member list. Traces to: UC-GRP-006, BR-GRP-009. MoSCoW: **Must**.
- **FR-GRP-009** — The system shall support a user holding memberships in multiple groups simultaneously. Traces to: BR-GRP-006. MoSCoW: **Must**.
- **FR-GRP-010** — The system shall display a group's member list, showing each member's display name, to any member of that group. Traces to: UC-GRP-005. MoSCoW: **Must**.
- **FR-GRP-011** — The system shall allow a user whose join request was rejected to submit a new join request for the same group. Traces to: UC-GRP-004, BR-GRP-010. MoSCoW: **Must**.
- **FR-GRP-012** — The system shall not create a second pending join request from the same user for the same group. Traces to: UC-GRP-002 (A2). MoSCoW: **Must**.
- **FR-GRP-013** — The system shall not accept a join request to a group from a user who is already a member of that group. Traces to: UC-GRP-002 (A1). MoSCoW: **Must**.

**UC coverage:** UC-GRP-001 → FR-GRP-001/002 · UC-GRP-002 → FR-GRP-003/004/012/013 · UC-GRP-003 → FR-GRP-005/006 · UC-GRP-004 → FR-GRP-005/007/011 · UC-GRP-005 → FR-GRP-010 · UC-GRP-006 → FR-GRP-008.

## 6. Non-Functional Requirements

- **NFR-GRP-001** — Authorization denial shall be the default for non-members on every group-scoped view and operation, and this shall be verified by authorization tests (SC-006). Source: brief §3 (OBJ-005), §9.
- **NFR-GRP-002** — Groups, memberships, and join requests shall be retained for the life of the application; no deletion or archiving (Won't — this release). Source: brief §5, §6.
- **NFR-GRP-003** — Group-related pages (group list, group view, join-request handling) shall meet the ≤ 2-second page-load target on a normal connection (OBJ-003, SC-004).
- **NFR-GRP-004** — The system shall support up to ~5 concurrent groups with ≤ 8 members each without dedicated operations (brief §7).
- **NFR-GRP-005** — Join codes shall function as shared secrets: unguessable in practice, so that presenting a code requires having received it from the creator. (Exact code format/entropy is an architecture decision.) Source: brief §5 (code gates join requests); BR-GRP-003.

## 7. Data Entities

- **Group** — attributes: name/label (derived — the brief requires distinguishing up to ~5 concurrent groups but names no fields; see OQ-GRP-003), join code (secret capability, unique), creator reference. Owned by this domain.
- **Join Request** — attributes: requesting user, group, status (pending / approved / rejected). Lifecycle: pending → approved | rejected. Owned by this domain.
- **Membership** — attributes: user, group, creator flag. Permanent once established (BR-GRP-008). Owned by this domain.
- Cardinality: Group 1 — 0..* Join Request · User 1 — 0..* Join Request (across groups) · Group 1 — 1..* Membership (creator plus approved members) · User 1 — 0..* Membership · at most one Membership per (user, group) pair.

## 8. Dependencies

- **Accounts & Access:** registered users, authenticated identity, display names shown in member lists (FR-ACC-008); the authentication gate (FR-ACC-009) precedes every group operation.
- **Downstream consumers:** Expense Tracking and Balances & Settlement rely on the membership record and FR-GRP-008 to authorize all group-scoped data — their reports restate the privacy rule for their own views.
- **External systems:** none.

## 9. Open Questions & Risks

- **OQ-GRP-001 — Decided 2026-09-25 (user, at report gate): yes — rejected users may re-request.** Implemented as BR-GRP-010 and FR-GRP-011.
- **OQ-GRP-002** — Join-code rotation (regenerating a code after it leaks) is assumed **Won't — this release**: not in the brief, and the approval gate (BR-GRP-004) already prevents unwanted joins even when a code leaks — the creator simply rejects. Impact of absence: nuisance rejections at worst. Recorded as a non-goal, not a defect.
- **OQ-GRP-003** — Group name/label is a derived attribute: the brief never lists group fields, but members must distinguish up to ~5 concurrent groups in the UI. Impact if wrong: trivial (rename or drop the field at design time).
- **R-GRP-001** — The creator is the sole approver; an inactive creator stalls all pending joiners. Mitigation: 8-person friend group, creator directly reachable; no creator transfer/step-down exists this release (not in brief).
- **R-GRP-002** — No member removal means a permanently departed friend remains visible as a member and in historical data. Accepted by the brief's scope-out; privacy impact is contained (the group is private among friends).
