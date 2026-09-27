/**
 * Change-password DTO (TKT-accounts-003; 03-api-design.md §2 password row,
 * §4 validation/policy precedence).
 *
 * `currentPassword` is only required (non-empty): the current password may
 * predate the policy, so its strength is never re-checked. `newPassword`
 * carries the same 8–128 policy as registration (D-ARCH-003) and is validated
 * here, **before** the service verifies `currentPassword` — a request that is
 * both policy-violating and wrong-current returns `400 VALIDATION_FAILED`
 * (TC-ACC-035, 03 §4 error precedence).
 *
 * The bounds are imported from `register.dto.ts` so the two write boundaries
 * share one source (the validation pipe turns any failure into
 * `400 VALIDATION_FAILED` with `details.fields`).
 */
import { IsString, MaxLength, MinLength } from 'class-validator';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from './register.dto';

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  newPassword!: string;
}
