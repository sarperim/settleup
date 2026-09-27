/**
 * Injectable Argon2id hasher (TKT-accounts-001).
 *
 * Bridges the validated `APP_CONFIG` Argon2 parameters (arch. §4/§8.5) to the
 * pure helpers in `password.ts`, so no domain code reads `process.env`.
 */
import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import { hashPassword, verifyPassword } from './password';

@Injectable()
export class PasswordHasher {
  private readonly params: AppConfig['argon2'];

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.params = config.argon2;
  }

  /** Hash a plaintext password with the configured Argon2id parameters. */
  hash(password: string): Promise<string> {
    return hashPassword(password, this.params);
  }

  /** Verify a plaintext password against a stored encoded hash. */
  verify(hash: string, password: string): Promise<boolean> {
    return verifyPassword(hash, password);
  }
}
