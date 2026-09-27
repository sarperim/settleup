/**
 * Create-group DTO (TKT-groups-001; 03-api-design.md §1 field limits group name
 * 1–100, §3 `POST /api/groups`, §4 validation contract).
 *
 * The literal bounds are inlined (mirroring `packages/shared` `FIELD_LIMITS`)
 * for the same reason `common/errors/error-contract.ts` duplicates the error
 * codes: `shared` exposes only its compiled `dist/`, and `pnpm typecheck` /
 * `pnpm test` run before `pnpm build` in CI. The global validation pipe turns
 * any failure into `400 VALIDATION_FAILED` naming the offending field.
 */
import { IsString, MaxLength, MinLength } from 'class-validator';

export const GROUP_NAME_MIN_LENGTH = 1;
export const GROUP_NAME_MAX_LENGTH = 100;

export class CreateGroupDto {
  @IsString()
  @MinLength(GROUP_NAME_MIN_LENGTH)
  @MaxLength(GROUP_NAME_MAX_LENGTH)
  name!: string;
}
