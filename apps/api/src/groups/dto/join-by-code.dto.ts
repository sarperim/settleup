/**
 * Join-by-code DTO (TKT-groups-002; 03-api-design.md §3 `POST /api/join-requests`,
 * §4 validation precedence).
 *
 * Only the field's **presence and type** are validated here — the code is an
 * opaque exact-match key, not a format-validated value. A well-formed-but-
 * unknown, wrong-length, or wrong-alphabet code must fall through to the
 * service's code resolution and yield `404 CODE_NOT_FOUND` (FR-GRP-004,
 * TC-GRP-008/010), so validating its shape in the DTO would wrongly turn those
 * into `400 VALIDATION_FAILED`. A missing/empty `code` is the only DTO-level
 * failure and precedes every service-level check (§4 error precedence).
 */
import { IsNotEmpty, IsString } from 'class-validator';

export class JoinByCodeDto {
  @IsString()
  @IsNotEmpty()
  code!: string;
}
