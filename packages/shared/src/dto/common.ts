/**
 * Shared DTO primitives — Settle Up (TKT-foundation-003).
 *
 * Common response shapes referenced by the domain DTO modules of
 * 03-api-design.md §2/§3/§3b/§3c.
 */

/**
 * A user reference as it may appear in group-scoped payloads: `{ id,
 * displayName }` only — never email (FR-ACC-008; 03-api-design.md §1
 * "Identity exposure"). The authenticated user's own profile (which does
 * include email) is `UserDto` in `./auth`.
 */
export interface UserRefDto {
  id: string;
  displayName: string;
}
