/**
 * Auth service (TKT-accounts-001; 03-api-design.md §2 register/login/me rows,
 * §4 error contract; 02-data-model.md §4).
 *
 * Owns the account-creation and credential-verification logic. The acting-user
 * session plumbing lives in {@link SessionService}; password hashing in
 * {@link PasswordHasher}.
 */
import { Injectable } from '@nestjs/common';
import { Prisma, type User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppError } from '../common/errors/app-error';
import { DEFAULT_MESSAGES } from '../common/errors/error-contract';
import { PasswordHasher } from './password-hasher.service';
import { SessionService } from './session.service';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';

/** The authenticated user's own profile (03 §2; `UserDto` in `shared`). */
export interface UserProfile {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly createdAt: string;
}

/** Result of an operation that opens a session. */
export interface AuthenticatedResult {
  readonly user: UserProfile;
  /** Raw session token — set as the `settleup_session` cookie value. */
  readonly token: string;
}

/** Normalize an email to its stored/login form (03 §1: lowercase). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Project a persisted user to the API profile shape (never the hash). */
export function toUserProfile(user: User): UserProfile {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt.toISOString(),
  };
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hasher: PasswordHasher,
    private readonly sessions: SessionService,
  ) {}

  /**
   * Register a new account and open a session (FR-ACC-001/002/010).
   *
   * DTO validation has already run (the pipe rejects malformed input with
   * `400 VALIDATION_FAILED` before this method is reached — 03 §4 error
   * precedence), so only the service-level duplicate check remains: a taken
   * email → `409 EMAIL_TAKEN` with `details.field = "email"`.
   */
  async register(dto: RegisterDto): Promise<AuthenticatedResult> {
    const email = normalizeEmail(dto.email);
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing !== null) {
      throw emailTaken();
    }

    const passwordHash = await this.hasher.hash(dto.password);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { email, passwordHash, displayName: dto.displayName },
        });
        const { token } = await this.sessions.issue(user.id, tx);
        return { user: toUserProfile(user), token };
      });
    } catch (error: unknown) {
      // A concurrent registration of the same email loses the unique-index
      // race; surface the same contract as the pre-check.
      if (isUniqueConstraintViolation(error)) {
        throw emailTaken();
      }
      throw error;
    }
  }

  /**
   * Authenticate and open a session (FR-ACC-003/004). The response for an
   * unknown email and a wrong password is identical — no enumeration on login.
   */
  async login(dto: LoginDto): Promise<AuthenticatedResult> {
    const email = normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email } });
    const valid =
      user !== null && (await this.hasher.verify(user.passwordHash, dto.password));
    if (!valid) {
      throw new AppError(
        401,
        'INVALID_CREDENTIALS',
        DEFAULT_MESSAGES.INVALID_CREDENTIALS,
      );
    }
    const { token } = await this.sessions.issue(user.id);
    return { user: toUserProfile(user), token };
  }

  /**
   * Load the acting user's profile (FR-ACC-009 read side). The guard has
   * already validated the session; a vanished user is treated as
   * unauthenticated.
   */
  async getProfile(userId: string): Promise<UserProfile> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user === null) {
      throw new AppError(
        401,
        'UNAUTHENTICATED',
        DEFAULT_MESSAGES.UNAUTHENTICATED,
      );
    }
    return toUserProfile(user);
  }
}

function emailTaken(): AppError {
  return new AppError(
    409,
    'EMAIL_TAKEN',
    DEFAULT_MESSAGES.EMAIL_TAKEN,
    { field: 'email' },
  );
}
