/**
 * Join-by-code controller (TKT-groups-002; 03-api-design.md §3 join-info +
 * join-requests rows).
 *
 * Both routes are account-scoped (no `:groupId`): the global `AuthGuard`
 * (layer 1) rejects anonymous callers, and the code itself selects the group —
 * there is no membership guard to apply at this point, since placing a request
 * is precisely how a non-member becomes known to a group. The code holder
 * learns only the group's name from `GET /api/join-info` (FR-GRP-004).
 */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { RequestWithContext } from '../common/http/request-context';
import { AppError } from '../common/errors/app-error';
import { DEFAULT_MESSAGES } from '../common/errors/error-contract';
import { JoinByCodeDto } from './dto/join-by-code.dto';
import {
  JoinRequestService,
  type JoinInfoView,
  type JoinRequestView,
} from './join-request.service';

/** The acting user's id, or `UNAUTHENTICATED` if somehow absent. */
function requireUserId(request: RequestWithContext): string {
  const userId = request.user?.id;
  if (userId === undefined) {
    // Unreachable: the global AuthGuard rejects anonymous calls first.
    throw new AppError(
      401,
      'UNAUTHENTICATED',
      DEFAULT_MESSAGES.UNAUTHENTICATED,
    );
  }
  return userId;
}

@Controller()
export class JoinFlowController {
  constructor(private readonly joinRequests: JoinRequestService) {}

  /** Resolve a code to `{ groupId, groupName }` only (FR-GRP-004). */
  @Get('join-info')
  async info(@Query('code') code?: string): Promise<JoinInfoView> {
    // A missing query param is simply a non-matching code — 404, never 400
    // (the code is an opaque exact-match key; TC-GRP-008).
    return this.joinRequests.resolveJoinInfo(code ?? '');
  }

  /** Place a join request by code (FR-GRP-003). */
  @Post('join-requests')
  @HttpCode(201)
  async place(
    @Body() dto: JoinByCodeDto,
    @Req() request: RequestWithContext,
  ): Promise<{ joinRequest: JoinRequestView }> {
    const userId = requireUserId(request);
    return { joinRequest: await this.joinRequests.place(userId, dto.code) };
  }

  /**
   * Approve a pending join request → membership + closure (FR-GRP-006).
   * Account-scoped: the handler applies the guard pattern itself (03 §3 note) —
   * see `JoinRequestService.decide` for the fixed check order.
   */
  @Post('join-requests/:requestId/approve')
  @HttpCode(200)
  async approve(
    @Param('requestId') requestId: string,
    @Req() request: RequestWithContext,
  ): Promise<{ joinRequest: JoinRequestView }> {
    const userId = requireUserId(request);
    return {
      joinRequest: await this.joinRequests.decide(
        requestId,
        userId,
        'APPROVED',
      ),
    };
  }

  /**
   * Reject a pending join request → closed, no membership; re-request later
   * allowed (FR-GRP-007/011).
   */
  @Post('join-requests/:requestId/reject')
  @HttpCode(200)
  async reject(
    @Param('requestId') requestId: string,
    @Req() request: RequestWithContext,
  ): Promise<{ joinRequest: JoinRequestView }> {
    const userId = requireUserId(request);
    return {
      joinRequest: await this.joinRequests.decide(
        requestId,
        userId,
        'REJECTED',
      ),
    };
  }
}
