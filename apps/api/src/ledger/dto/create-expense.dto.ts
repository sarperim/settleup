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
  ArrayUnique,
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
  Validate,
  ValidatorConstraint,
  type ValidationArguments,
  type ValidatorConstraintInterface,
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

/**
 * EXACT-split input fence (S-1a/S-1b/K-1/K-3). Every `exactAmounts` value must
 * be an integer kuruş in `[0, amountKurus]` and every key must name a
 * participant. Without it, values that happen to sum to the amount but include
 * a negative or oversized share pass the pure engine and are **persisted** as
 * `shareKurus < 0` — violating the frozen `expense_shares.shareKurus ≥ 0`
 * constraint (02-data-model.md §5.4) and the Σ-share invariant enforced by
 * `LedgerService` (§9) — while fractional values are silently truncated on the
 * `Int` write. Unknown keys are rejected so the accepted shape is
 * deterministic (review C-4); missing participant keys remain valid, the engine
 * treats them as `0` (BR-EXP-006). A format/value failure here yields the
 * standard `400 VALIDATION_FAILED` with `details.fields`, never a `500`.
 */
const EXACT_AMOUNTS_MESSAGE =
  'exactAmounts values must be integer kuruş in [0, amountKurus], keyed by a participant id.';

@ValidatorConstraint({ name: 'exactAmountsRange', async: false })
class ExactAmountsRangeConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    const dto = args.object as CreateExpenseDto;
    // `exactAmounts` is only consumed by EXACT splits (BR-EXP-006).
    if (dto.splitType !== 'EXACT') {
      return true;
    }
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return false;
    }
    // A bad `amountKurus` reports its own failure; avoid masking it here.
    if (typeof dto.amountKurus !== 'number') {
      return true;
    }
    // Defensive: `@Validate` runs even after `@IsArray` on `participantIds`
    // fails, so a non-array value must not reach `new Set()` (that would throw
    // a raw TypeError → unhandled 500, contradicting the "never a 500" contract
    // below). A non-array yields only the `@IsArray` DTO errors → 400.
    const ids = Array.isArray(dto.participantIds) ? dto.participantIds : [];
    const participantIds = new Set(ids);
    for (const [participantId, share] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (!participantIds.has(participantId)) {
        return false;
      }
      if (
        typeof share !== 'number' ||
        !Number.isInteger(share) ||
        share < 0 ||
        share > dto.amountKurus
      ) {
        return false;
      }
    }
    return true;
  }

  defaultMessage(): string {
    return EXACT_AMOUNTS_MESSAGE;
  }
}

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
  @ArrayUnique()
  participantIds!: string[];

  @IsIn(SPLIT_TYPES)
  splitType!: SplitType;

  /** Per-participant kuruş for EXACT splits (BR-EXP-006). */
  @IsOptional()
  @IsObject()
  @Validate(ExactAmountsRangeConstraint)
  exactAmounts?: Record<string, number>;
}
