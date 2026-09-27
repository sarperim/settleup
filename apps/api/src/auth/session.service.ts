/**
 * Session service (TKT-accounts-001; 01-system-architecture.md §4/§8.1,
 * 02-data-model.md §4 Session).
 *
 * Sessions are server-side rows (revocable): the cookie carries an opaque
 * 256-bit random token; the database stores only its SHA-256 hash. Expiry is
 * a sliding 30-day window — every authenticated request pushes `expiresAt`
 * forward (arch. §8.1). This service is the only writer/reader of `sessions`.
 */
import { Injectable } from '@nestjs/common';
import { Prisma, type Session } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SESSION_TTL_DAYS } from './auth.constants';

/** 256-bit token, base64url-encoded for cookie transport. */
const TOKEN_BYTES = 32;

/** A newly issued session: the raw token (cookie value) plus the stored row. */
export interface IssuedSession {
  readonly token: string;
  readonly session: Session;
}

/** Prisma client or transaction client — both expose the `session` delegate. */
type PrismaLike = PrismaService | Prisma.TransactionClient;

/** SHA-256 of the raw token, lowercase hex (stored form). */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function expiryFrom(now: Date): Date {
  return new Date(now.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/** Prisma `P2025`: an operation depended on a record that no longer exists. */
function isMissingRecord(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  );
}

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Issue a fresh session for `userId`. `client` lets a caller join the
   * session insert to the user insert inside one transaction.
   */
  async issue(userId: string, client?: PrismaLike): Promise<IssuedSession> {
    const db = client ?? this.prisma;
    const token = randomBytes(TOKEN_BYTES).toString('base64url');
    const session = await db.session.create({
      data: {
        tokenHash: hashSessionToken(token),
        userId,
        expiresAt: expiryFrom(new Date()),
      },
    });
    return { token, session };
  }

  /**
   * Resolve a raw cookie token to its session, or `null` when absent or
   * expired. A valid session has its sliding expiry pushed to +30 days.
   *
   * Concurrency (TKT-accounts-003, review K-2/S-2): between the read and the
   * sliding-expiry write the row can be deleted by a concurrent revoke — logout,
   * a password change, or the owner reset CLI. Prisma raises `P2025` when the
   * `update` targets a row that no longer exists; that is exactly "the session
   * is gone", so it is mapped to `null` (→ `401 UNAUTHENTICATED`) instead of
   * surfacing as `500 INTERNAL`. Fails closed either way; this keeps the
   * observable contract on the revocation race.
   */
  async resolve(token: string): Promise<Session | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashSessionToken(token) },
    });
    if (session === null || session.expiresAt.getTime() <= Date.now()) {
      return null;
    }
    try {
      return await this.prisma.session.update({
        where: { id: session.id },
        data: { expiresAt: expiryFrom(new Date()) },
      });
    } catch (error: unknown) {
      if (isMissingRecord(error)) {
        return null;
      }
      throw error;
    }
  }

  /** Revoke the session addressed by a raw cookie token, if it exists. */
  async revoke(token: string): Promise<void> {
    await this.prisma.session.deleteMany({
      where: { tokenHash: hashSessionToken(token) },
    });
  }
}
