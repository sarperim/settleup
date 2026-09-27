/**
 * Users read API (TKT-accounts-001; 01-system-architecture.md §3 rule 1,
 * 03-api-design.md §1 identity exposure, 02-data-model.md §6 ownership).
 *
 * C2 owns the `users` table; C3/C4/C5 consume this exported service for
 * group-scoped read models. The exposed shape is `{ id, displayName }` only —
 * email never crosses into a group-scoped response (FR-ACC-008).
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** The display-name-only user reference group-scoped read models carry. */
export interface UserRef {
  readonly id: string;
  readonly displayName: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Resolve one user to its `{ id, displayName }` reference, or `null`. */
  async getUserRef(id: string): Promise<UserRef | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, displayName: true },
    });
  }

  /**
   * Resolve many users at once, keyed by id. Missing ids are simply absent
   * from the map — useful for assembling member lists without N+1 queries.
   */
  async getUserRefs(ids: readonly string[]): Promise<Map<string, UserRef>> {
    if (ids.length === 0) {
      return new Map();
    }
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...ids] } },
      select: { id: true, displayName: true },
    });
    return new Map(users.map((user) => [user.id, user]));
  }
}
