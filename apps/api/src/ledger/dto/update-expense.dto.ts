/**
 * Update-expense DTO (TKT-exp-004; 03-api-design.md §3b PATCH row, §1 field
 * limits, §4 validation contract; 02-data-model.md §5.4/§8).
 *
 * PATCH is **partial** (UC-EXP-002 step 2 lets the logger change any of the
 * fields): every property is optional and an omitted property keeps its stored
 * value. Each supplied property is validated with exactly the create rules
 * (`validation as create`), so `amountKurus` bounds, the description length,
 * the split-type enum and the EXACT `exactAmounts` range fence all still apply.
 * There is **no date field** here either (BR-EXP-008).
 *
 * The `NOT_LOGGER` authorization is not a DTO concern: it runs as a guard
 * (`ExpenseLoggerGuard`) *before* this pipe, so a non-logger submitting an
 * invalid body still receives `403 NOT_LOGGER` (03 §4 amended 2026-09-25,
 * "authorization first — guard order").
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
import {
  EXPENSE_AMOUNT_MAX_KURUS,
  EXPENSE_DESCRIPTION_MAX_LENGTH,
  EXPENSE_DESCRIPTION_MIN_LENGTH,
  SPLIT_TYPES,
} from './create-expense.dto';
import type { SplitType } from '../engine/split-engine';

/**
 * EXACT-split input fence for edits (same intent as the create DTO's constraint,
 * relaxed for partial input): every supplied `exactAmounts` value must be an
 * integer kuruş `≥ 0` (and `≤ amountKurus` when the amount is supplied), and
 * when `participantIds` is supplied every key must name one of them. Without it,
 * a negative or oversized share that happens to sum to the effective amount
 * could be persisted against the frozen `expense_shares.shareKurus ≥ 0`
 * constraint (02-data-model.md §5.4, §9). A failure is the standard
 * `400 VALIDATION_FAILED` with `details.fields`, never a `500`.
 */
const EXACT_AMOUNTS_MESSAGE =
  'exactAmounts values must be integer kuruş ≥ 0, keyed by a participant id.';

@ValidatorConstraint({ name: 'updateExactAmountsRange', async: false })
class UpdateExactAmountsRangeConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    const dto = args.object as UpdateExpenseDto;
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return false;
    }
    const ids = Array.isArray(dto.participantIds)
      ? new Set(dto.participantIds)
      : null;
    for (const [participantId, share] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (ids !== null && !ids.has(participantId)) {
        return false;
      }
      if (
        typeof share !== 'number' ||
        !Number.isInteger(share) ||
        share < 0
      ) {
        return false;
      }
      if (typeof dto.amountKurus === 'number' && share > dto.amountKurus) {
        return false;
      }
    }
    return true;
  }

  defaultMessage(): string {
    return EXACT_AMOUNTS_MESSAGE;
  }
}

export class UpdateExpenseDto {
  @IsOptional()
  @IsString()
  @MinLength(EXPENSE_DESCRIPTION_MIN_LENGTH)
  @MaxLength(EXPENSE_DESCRIPTION_MAX_LENGTH)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(EXPENSE_AMOUNT_MAX_KURUS)
  amountKurus?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  payerId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayUnique()
  participantIds?: string[];

  @IsOptional()
  @IsIn(SPLIT_TYPES)
  splitType?: SplitType;

  @IsOptional()
  @IsObject()
  @Validate(UpdateExactAmountsRangeConstraint)
  exactAmounts?: Record<string, number>;
}
