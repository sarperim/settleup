/**
 * Create-expense DTO (TKT-exp-002; 03-api-design.md §3b create row, §1 field
 * limits, §4 validation contract; 02-data-model.md §5.4/§8).
 *
 * The literal bounds are inlined (mirroring `packages/shared` `FIELD_LIMITS`)
 * for the same reason `common/errors/error-contract.ts` duplicates the error
 * codes: `shared` exposes only its compiled `dist/`, and `pnpm typecheck` /
 * `pnpm test` run before `pnpm build` in CI (FLAG-1). There is **no date field**
 * anywhere in this DTO (BR-EXP-008) — timestamps are server-set.
 *
 * `splitType` is typed against the split engine's own `SplitType` and the
 * `SPLIT_TYPE_VALUES` record below must list every member of that union: this
 * is the DTO→engine drift guard (review C-1) — extending the engine union
 * without teaching the DTO here is a compile-time error at this seam.
 */
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type { SplitType } from '../engine/split-engine';

export const EXPENSE_DESCRIPTION_MIN_LENGTH = 1;
export const EXPENSE_DESCRIPTION_MAX_LENGTH = 200;
/** 2^31 − 1 — the `Int` storage ceiling (02-data-model.md §8). */
export const EXPENSE_AMOUNT_MAX_KURUS = 2_147_483_647;

/** Exhaustive over the engine's `SplitType` — see the header note. */
const SPLIT_TYPE_VALUES: Record<SplitType, true> = { EQUAL: true, EXACT: true };
export const SPLIT_TYPES: SplitType[] = Object.keys(
  SPLIT_TYPE_VALUES,
) as SplitType[];

export class CreateExpenseDto {
  @IsString()
  @MinLength(EXPENSE_DESCRIPTION_MIN_LENGTH)
  @MaxLength(EXPENSE_DESCRIPTION_MAX_LENGTH)
  description!: string;

  @IsInt()
  @Min(0)
  @Max(EXPENSE_AMOUNT_MAX_KURUS)
  amountKurus!: number;

  @IsString()
  @IsNotEmpty()
  payerId!: string;

  /**
   * Participant ids; **an empty array is shape-valid** and is rejected by the
   * service with `400 NO_PARTICIPANTS` (API §4 service-level precedence).
   */
  @IsArray()
  @IsString({ each: true })
  participantIds!: string[];

  @IsIn(SPLIT_TYPES)
  splitType!: SplitType;

  /** Per-participant kuruş for EXACT splits (BR-EXP-006). */
  @IsOptional()
  @IsObject()
  exactAmounts?: Record<string, number>;
}
