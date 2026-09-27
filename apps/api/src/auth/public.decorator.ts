/**
 * `@Public()` route marker (TKT-accounts-001; FR-ACC-009).
 *
 * The global `AuthGuard` allows a request through only when its handler (or
 * controller) is marked public. Exactly two routes are public in the whole
 * API: `POST /api/auth/register` and `POST /api/auth/login` — everything else
 * requires a valid session (arch. §8.1 layer 1).
 */
import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from './auth.constants';

export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true);
