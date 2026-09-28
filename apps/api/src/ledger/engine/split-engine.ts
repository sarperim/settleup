/**
 * Split engine (C4 — Ledger) — TKT-exp-001.
 *
 * A pure decision function: `(amount, participants, split type, RNG stream)`
 * → per-participant shares. No DB, no Nest wiring (arch.
 * 01-system-architecture.md §3 rule 3 + §5.1; those land with TKT-exp-002).
 *
 * - **Equal** (ASM-001 / BR-EXP-004/005): `base = floor(amount / n)`;
 *   `remainder r = amount − n·base` (`0 ≤ r < n`). A CSPRNG Fisher–Yates
 *   shuffle picks `r` **distinct** participants; each receives `base + 1`,
 *   the rest `base`. By construction: shares sum exactly to the amount, no
 *   participant gets more than one extra kuruş (SC-002), and when `r = 0` no
 *   randomness is consumed at all.
 * - **Exact** (BR-EXP-006 / FR-EXP-007): the per-participant kuruş are
 *   accepted iff they sum exactly to the amount; zero-kuruş shares are valid
 *   and preserved (OQ-EXP-003). Arithmetic only — no randomness.
 *
 * Randomness is never drawn from `node:crypto` directly: the caller injects a
 * `RandomSource` (the same abstraction C3's join-code generator uses — see
 * `groups/random-source.ts`), so unit tests inject a seeded PRNG (strategy
 * §3 T5, the one sanctioned double) while production wires the CSPRNG.
 */
import type { SplitType } from 'shared';
import type { RandomSource } from '../../groups/random-source';

/** One participant's share of an expense, in integer kuruş. */
export interface SplitShare {
  participantId: string;
  shareKurus: number;
}

/** Engine input for a single expense split. */
export interface SplitExpenseInput {
  amountKurus: number;
  participantIds: readonly string[];
  splitType: SplitType;
  /** Per-participant kuruş; required in practice for `EXACT` splits. */
  exactAmounts?: Readonly<Record<string, number>> | undefined;
}

/** The only engine-level failure: an exact split whose parts do not sum. */
export type SplitFailureReason = 'SPLIT_SUM_MISMATCH';

export type SplitResult =
  | { readonly ok: true; readonly shares: SplitShare[] }
  | { readonly ok: false; readonly reason: SplitFailureReason };

/** 2^32 — the `RandomSource` draw range, used for unbiased range reduction. */
const UINT32_RANGE = 0x1_0000_0000;

/**
 * Uniform integer in `[0, bound)` from `random.nextUint32()`, rejection-
 * sampled so the modulo carries no bias. `bound === 1` needs no draw.
 */
function randomIntBelow(random: RandomSource, bound: number): number {
  if (bound <= 1) {
    return 0;
  }
  // Largest multiple of `bound` that fits in a 32-bit draw; draws at or above
  // it are rejected and re-drawn (each accepted value is equally likely).
  const limit = Math.floor(UINT32_RANGE / bound) * bound;
  let draw = random.nextUint32();
  while (draw >= limit) {
    draw = random.nextUint32();
  }
  return draw % bound;
}

/**
 * Pick `count` distinct participants with a partial Fisher–Yates shuffle:
 * each step swaps the current position with a uniformly chosen later one, so
 * every `count`-subset is equally likely. Consumes no draw when `count = 0`.
 */
function selectRemainderRecipients(
  participantIds: readonly string[],
  count: number,
  random: RandomSource,
): string[] {
  const pool = [...participantIds];
  for (let i = 0; i < count; i += 1) {
    const j = i + randomIntBelow(random, pool.length - i);
    const tmp = pool[i]!;
    pool[i] = pool[j]!;
    pool[j] = tmp;
  }
  return pool.slice(0, count);
}

/**
 * Equal split (ASM-001): floor base share plus a random-spread remainder,
 * one extra kuruş to each of `r` distinct participants.
 *
 * Returns one share per participant, in input order. Requires at least one
 * participant (BR-EXP-002; the service rejects `NO_PARTICIPANTS` before the
 * engine is reached) — an empty list is a programming error.
 */
export function equalSplit(
  amountKurus: number,
  participantIds: readonly string[],
  random: RandomSource,
): SplitShare[] {
  const n = participantIds.length;
  if (n === 0) {
    throw new RangeError('equalSplit: at least one participant is required');
  }

  const base = Math.floor(amountKurus / n);
  const remainder = amountKurus - n * base; // 0 <= remainder < n

  const recipients = new Set(
    selectRemainderRecipients(participantIds, remainder, random),
  );

  return participantIds.map((participantId) => ({
    participantId,
    shareKurus: recipients.has(participantId) ? base + 1 : base,
  }));
}

/**
 * Exact split (BR-EXP-006): accept the per-participant kuruş iff they sum
 * exactly to `amountKurus`; zero shares are valid and preserved
 * (OQ-EXP-003). A participant absent from `exactAmounts` contributes `0`.
 */
export function exactSplit(
  amountKurus: number,
  participantIds: readonly string[],
  exactAmounts: Readonly<Record<string, number>>,
): SplitResult {
  let sum = 0;
  const shares: SplitShare[] = participantIds.map((participantId) => {
    const shareKurus = exactAmounts[participantId] ?? 0;
    sum += shareKurus;
    return { participantId, shareKurus };
  });

  if (sum !== amountKurus) {
    return { ok: false, reason: 'SPLIT_SUM_MISMATCH' };
  }
  return { ok: true, shares };
}

/**
 * Split an expense by its type. Equal splits draw from `random`; exact
 * splits are pure arithmetic. On an exact-sum mismatch the caller surfaces
 * `400 SPLIT_SUM_MISMATCH` (03-api-design.md §4).
 */
export function splitExpense(
  input: SplitExpenseInput,
  random: RandomSource,
): SplitResult {
  switch (input.splitType) {
    case 'EQUAL':
      return {
        ok: true,
        shares: equalSplit(input.amountKurus, input.participantIds, random),
      };
    case 'EXACT':
      return exactSplit(
        input.amountKurus,
        input.participantIds,
        input.exactAmounts ?? {},
      );
    default: {
      // `SplitType` is exactly `'EQUAL' | 'EXACT'` (BR-EXP-003): this arm is
      // unreachable, and assigning to `never` makes widening the union
      // without teaching the engine here a compile-time error.
      const unsupported: never = input.splitType;
      throw new Error(
        `splitExpense: unsupported split type ${String(unsupported)}`,
      );
    }
  }
}
