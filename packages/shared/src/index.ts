/**
 * `shared` (the workspace package name) — the frozen contract package
 * (TKT-foundation-003).
 *
 * Pure code, no I/O, no runtime dependencies (arch 01-system-architecture.md
 * §2 C6); imported by `apps/api` and `apps/web`. Single source of truth for:
 *
 * - **Money** (ASM-002; 02-data-model.md §8): the branded `Kurus` type,
 *   `parseKurus` (UI text → integer kuruş, the only decimal boundary) and
 *   `formatKurus` (kuruş → "123.45" TRY text).
 * - **Constants**: field limits (03-api-design.md §1) and the kuruş storage
 *   bound (02 §8).
 * - **DTO types**: the complete request/response surface of 03-api-design.md
 *   §2 (auth), §3 (groups & membership), §3b (expenses), §3c (balances &
 *   settlement) — the contract every later backend/frontend pair builds
 *   against.
 * - **Error contract** (03 §4): the `ErrorEnvelopeDto` and the `ErrorCode`
 *   union (exactly the §4 table plus `LIST_TOO_LARGE` from §3b).
 */

export * from './constants';
export * from './money';
export * from './errors';
export * from './dto/common';
export * from './dto/auth';
export * from './dto/groups';
export * from './dto/expenses';
export * from './dto/settlements';
