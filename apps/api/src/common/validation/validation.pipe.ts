/**
 * Global validation wiring (TKT-foundation-004; 03-api-design.md §4).
 *
 * The mechanism domain DTOs hook into: a failing `class-validator` DTO yields
 * `400 VALIDATION_FAILED`, with `details.fields` listing the offending field
 * paths. DTO validation precedes every service-level check (03 §4 error
 * precedence).
 */
import { ValidationPipe, type ValidationError } from '@nestjs/common';
import { AppError } from '../errors/app-error';
import { DEFAULT_MESSAGES } from '../errors/error-contract';

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    transform: true,
    exceptionFactory: (errors: ValidationError[]) =>
      new AppError(
        400,
        'VALIDATION_FAILED',
        DEFAULT_MESSAGES.VALIDATION_FAILED,
        { fields: collectFields(errors) },
      ),
  });
}

/** Flatten `ValidationError` trees to the offending leaf property paths. */
function collectFields(
  errors: readonly ValidationError[],
  prefix = '',
): string[] {
  const fields: string[] = [];
  for (const error of errors) {
    const path = prefix ? `${prefix}.${error.property}` : error.property;
    if (error.children && error.children.length > 0) {
      fields.push(...collectFields(error.children, path));
    } else {
      fields.push(path);
    }
  }
  return fields;
}
