/**
 * Mark-paid DTO (TKT-bal-004; 03-api-design.md §3c mark-paid row, §1 money,
 * §4 validation contract; 02-data-model.md §5.4).
 *
 * The submitted triple names the suggested payment: `payerId`, `recipientId`
 * and `amountKurus`. Format validation precedes every service-level check
 * (03 §4): a malformed body yields `400 VALIDATION_FAILED`, never a
 * `NOT_PAYMENT_PARTY`/`SUGGESTION_STALE`. The amount is integer kuruş ≥ 1
 * (a payment of 0 is meaningless, 02 §5.4) and ≤ 2^31−1 (the `Int` ceiling,
 * 02 §8). The bounds are inlined, mirroring the expense DTO's practice, since
 * `shared` exposes only its compiled `dist/` before CI's build step.
 */
import { IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';

/** 2^31 − 1 — the `Int` storage ceiling (02-data-model.md §8). */
export const SETTLEMENT_AMOUNT_MAX_KURUS = 2_147_483_647;

export class CreateSettlementDto {
  @IsString()
  @IsNotEmpty()
  payerId!: string;

  @IsString()
  @IsNotEmpty()
  recipientId!: string;

  @IsInt()
  @Min(1)
  @Max(SETTLEMENT_AMOUNT_MAX_KURUS)
  amountKurus!: number;
}
