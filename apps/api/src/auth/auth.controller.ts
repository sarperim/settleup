/**
 * Auth controller (TKT-accounts-001 / TKT-accounts-002; 03-api-design.md §2).
 *
 * `POST /api/auth/register` (public, 201 `{ user }` + session cookie) and
 * `POST /api/auth/login` (public, throttled, 200 `{ user }` + session cookie)
 * are the only unauthenticated routes; `POST /api/auth/logout` and
 * `GET /api/auth/me` are protected by the global `AuthGuard` (FR-ACC-005/009).
 */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import type { RequestWithContext } from '../common/http/request-context';
import { Public } from './public.decorator';
import { AuthService, type UserProfile } from './auth.service';
import { readSessionToken, setSessionCookie } from './session-cookie';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Register a new account and open a session (FR-ACC-001/002/010). */
  @Public()
  @Post('register')
  @HttpCode(201)
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ user: UserProfile }> {
    const result = await this.auth.register(dto);
    setSessionCookie(response, result.token, this.config.cookieSecure);
    return { user: result.user };
  }

  /** Authenticate and open a session (FR-ACC-003/004); throttled per §8.2. */
  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Req() request: RequestWithContext,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ user: UserProfile }> {
    const result = await this.auth.login(dto, request.ip ?? '');
    setSessionCookie(response, result.token, this.config.cookieSecure);
    return { user: result.user };
  }

  /** End the current session (FR-ACC-005): deletes the session row, `204`. */
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() request: RequestWithContext): Promise<void> {
    const token = readSessionToken(request);
    if (token !== undefined) {
      await this.auth.logout(token);
    }
  }

  /** The acting user's own profile (FR-ACC-009 read side). */
  @Get('me')
  async me(@Req() request: RequestWithContext): Promise<{ user: UserProfile }> {
    const userId = request.user?.id;
    if (userId === undefined) {
      // Unreachable: the global AuthGuard rejects anonymous calls first.
      throw new Error('auth/me reached without an acting user');
    }
    return { user: await this.auth.getProfile(userId) };
  }
}
