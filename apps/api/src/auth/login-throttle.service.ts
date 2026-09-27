/**
 * Login-throttle service (TKT-accounts-002; 01-system-architecture.md §8.2,
 * 07 NFR-ACC-001 row, 03-api-design.md §4).
 *
 * In-memory counter keyed by (lowercased submitted email, client IP) for
 * `POST /api/auth/login` only (single-instance C2 — no cross-process state).
 * The fixed 15-minute window is anchored at the first counted failure; only
 * credential-verification failures count; the counter and window are cleared on
 * a successful login or when the window expires. See the class body for the
 * exact semantics.
 */
import { Injectable } from '@nestjs/common';
import {
  LOGIN_THROTTLE_MAX_FAILURES,
  LOGIN_THROTTLE_WINDOW_MS,
} from './auth.constants';

/** One (email, IP) pair's fixed-window counter. */
interface ThrottleEntry {
  /** Counted credential-verification failures in the current window. */
  failures: number;
  /** Epoch ms of the failure that opened the current window. */
  windowStartedAt: number;
}

/**
 * Key a pair by the lowercased submitted email and the client IP. The email is
 * normalized here too (not only by the caller) so the keying rule holds for
 * every entry point; `\n` cannot appear in either component, so it is a safe
 * separator.
 */
export function throttleKey(email: string, clientIp: string): string {
  return `${email.trim().toLowerCase()}\n${clientIp}`;
}

@Injectable()
export class LoginThrottleService {
  private readonly entries = new Map<string, ThrottleEntry>();

  /**
   * Whether the pair is currently throttled. An expired window is dropped
   * lazily (the entry is removed and the pair is unblocked) — arch. §8.2.
   */
  isBlocked(email: string, clientIp: string, now = Date.now()): boolean {
    const key = throttleKey(email, clientIp);
    const entry = this.entries.get(key);
    if (entry === undefined) {
      return false;
    }
    if (now - entry.windowStartedAt >= LOGIN_THROTTLE_WINDOW_MS) {
      this.entries.delete(key);
      return false;
    }
    return entry.failures >= LOGIN_THROTTLE_MAX_FAILURES;
  }

  /**
   * Record a credential-verification failure. The first failure in a window
   * (or the first after expiry) opens a fresh fixed window; later failures
   * increment the counter. Throttled attempts must not call this.
   */
  recordFailure(email: string, clientIp: string, now = Date.now()): void {
    const key = throttleKey(email, clientIp);
    const entry = this.entries.get(key);
    if (entry === undefined || now - entry.windowStartedAt >= LOGIN_THROTTLE_WINDOW_MS) {
      this.entries.set(key, { failures: 1, windowStartedAt: now });
      return;
    }
    entry.failures += 1;
  }

  /** Clear the pair's counter and window on a successful login (arch. §8.2). */
  recordSuccess(email: string, clientIp: string): void {
    this.entries.delete(throttleKey(email, clientIp));
  }

  /**
   * Testability hook (accounts-access.md §2 conventions): drop every in-memory
   * counter so integration tests do not couple through shared (email, IP) keys.
   */
  reset(): void {
    this.entries.clear();
  }
}
