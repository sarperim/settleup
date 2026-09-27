/**
 * Register DTO (TKT-accounts-001; 03-api-design.md §1 field limits, §2
 * register row, §4 validation contract).
 *
 * Validation rules mirror the frozen `packages/shared` contract
 * (`FIELD_LIMITS`, `RegisterRequestDto`):
 *   - email: valid email address (lowercased at write);
 *   - password: 8–128 characters, no composition rules (D-ARCH-003);
 *   - displayName: 1–50 characters.
 *
 * The literal bounds are inlined (not imported from `shared`) for the same
 * reason `common/errors/error-contract.ts` duplicates the error codes: the
 * `shared` package only exposes its compiled `dist/`, and `pnpm typecheck` /
 * `pnpm test` run before `pnpm build` in CI (TKT-foundation-004 FLAG).
 *
 * The global validation pipe turns any failure into
 * `400 VALIDATION_FAILED` with `details.fields` naming the offending paths.
 */
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

/** 03-api-design.md §1 field limits (mirrors `FIELD_LIMITS`). */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const DISPLAY_NAME_MIN_LENGTH = 1;
export const DISPLAY_NAME_MAX_LENGTH = 50;

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  password!: string;

  @IsString()
  @MinLength(DISPLAY_NAME_MIN_LENGTH)
  @MaxLength(DISPLAY_NAME_MAX_LENGTH)
  displayName!: string;
}
