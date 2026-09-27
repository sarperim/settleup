/**
 * Auth module — C2 (TKT-accounts-001; 01-system-architecture.md §2 C2, §8.1).
 *
 * Owns `users`/`sessions`, provides the global `AuthGuard` (layer 1
 * authorization) and the acting-user request context, and exports
 * `UsersService` — the `{ id, displayName }` read API C3/C4/C5 consume for
 * group-scoped read models (arch. §3 rule 1; FR-ACC-008 mechanism).
 */
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { PasswordHasher } from './password-hasher.service';
import { SessionService } from './session.service';
import { UsersService } from './users.service';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionService,
    PasswordHasher,
    UsersService,
    // Layer 1 authorization: protects every route not marked @Public()
    // (arch. §8.1).
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [UsersService, SessionService],
})
export class AuthModule {}
