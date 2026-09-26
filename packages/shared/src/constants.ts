/**
 * Shared constants — Settle Up (TKT-foundation-003).
 *
 * Sources:
 * - Field limits: 03-api-design.md §1 ("Field limits")
 * - Kuruş storage bound: 02-data-model.md §8 ("Money representation")
 */

/**
 * Input field length limits enforced at both the API DTO boundary and the
 * SPA forms (03-api-design.md §1). `description` is the expense
 * description — the only description field in the system.
 */
export const FIELD_LIMITS = {
  displayName: { minLength: 1, maxLength: 50 },
  password: { minLength: 8, maxLength: 128 },
  groupName: { minLength: 1, maxLength: 100 },
  description: { minLength: 1, maxLength: 200 },
} as const;

/**
 * 2,147,483,647 kuruş (₺21,474,836.47) — the effective per-amount storage
 * bound: every money column is `Int` kuruş (02-data-model.md §8, ASM-002).
 * `parseKurus` rejects anything above it; the exact ceiling itself is the
 * last accepted value.
 */
export const KURUS_STORAGE_BOUND = 2_147_483_647;
