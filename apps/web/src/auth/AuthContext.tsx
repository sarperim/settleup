/**
 * Session state for the SPA shell (TKT-accounts-005; UC-ACC-006, arch §8.2).
 *
 * The shell establishes the acting user's session by asking the API
 * (`GET /api/auth/me`). A `401 UNAUTHENTICATED` — the shell's 401 handling —
 * resolves to the anonymous state; the protected-route guard then redirects to
 * `/login`. The bootstrap deliberately uses a client whose 401 handler is a
 * no-op rather than the app-wide redirect: the React guard owns the
 * navigation, so a hard `window.location.assign` would double-navigate.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { UserDto, UserResponseDto } from 'shared';

import { createApiClient, type ApiClient } from '../api/client';

/** The shell's session state machine. */
export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

export interface AuthState {
  status: AuthStatus;
  user: UserDto | null;
  /** Re-read the session from the API (`GET /api/auth/me`). */
  refresh(): Promise<void>;
  /** Adopt a user returned by register/login. */
  signIn(user: UserDto): void;
  /** Clear local session state after logout. */
  signOut(): void;
}

/** Anonymous default so static renders and public pages need no provider. */
export const AuthContext = createContext<AuthState>({
  status: 'anonymous',
  user: null,
  refresh: async () => undefined,
  signIn: () => undefined,
  signOut: () => undefined,
});

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

export interface AuthProviderProps {
  children: ReactNode;
  /** Injectable bootstrap client (tests); defaults to a non-redirecting client. */
  client?: ApiClient;
}

export function AuthProvider({ children, client }: AuthProviderProps) {
  const [state, setState] = useState<{ status: AuthStatus; user: UserDto | null }>({
    status: 'loading',
    user: null,
  });

  const bootstrapClient = useMemo(
    () => client ?? createApiClient({ onUnauthenticated: () => undefined }),
    [client],
  );

  const refresh = useCallback(async () => {
    try {
      const { user } = await bootstrapClient.get<UserResponseDto>('/auth/me');
      setState({ status: 'authenticated', user });
    } catch {
      // A `401 UNAUTHENTICATED` (the shell's 401 handling) — or any other
      // failure — means there is no usable session. The guard decides what to
      // render; the provider never inspects raw statuses or login failures.
      setState({ status: 'anonymous', user: null });
    }
  }, [bootstrapClient]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<AuthState>(
    () => ({
      status: state.status,
      user: state.user,
      refresh,
      signIn: (user: UserDto) => {
        setState({ status: 'authenticated', user });
      },
      signOut: () => {
        setState({ status: 'anonymous', user: null });
      },
    }),
    [state, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
