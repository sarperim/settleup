/**
 * Login DTO (TKT-accounts-001 / TKT-accounts-002; 03-api-design.md §2 login
 * row).
 *
 * Both fields are required; the submitted email is lowercased before lookup
 * (03 §1). Password length is not re-checked here — a legacy password outside
 * the current policy must still be able to log in; the policy governs the
 * register/password-change boundaries only.
 */
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}
