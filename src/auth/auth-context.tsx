import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import {
  getMeAuthMeGetQueryKey,
  loginAuthLoginPost,
  useMeAuthMeGet,
} from '@/api/generated/endpoints/auth/auth';
import type { UserMe } from '@/api/generated/models';
import { isNetworkError } from '@/api/errors';
import { getInstanceUrl, setInstanceUrl } from '@/api/instance';
import { persistToken, useAccessToken } from '@/auth/session';

/**
 * Session state.
 *
 * `unreachable` is the one deliberate divergence from the web client. There,
 * `isAuthenticated = Boolean(token) && Boolean(meQuery.data)`
 * (`frontend/src/auth/AuthContext.tsx:97`), so a server that cannot be reached
 * is indistinguishable from being signed out. On a desktop that is harmless. On
 * a phone -- offline, VPN down, the self-hosted box asleep -- it would silently
 * destroy a working session and demand the server link, email and password
 * again. So a network failure keeps the token and surfaces a retry instead.
 */
export type SessionStatus = 'loading' | 'signedOut' | 'signedIn' | 'unreachable';

type AuthContextValue = {
  user: UserMe | null;
  status: SessionStatus;
  isAuthenticated: boolean;
  /** The instance the session belongs to, for display. */
  instanceUrl: string | null;
  signIn: (instance: string, email: string, password: string) => Promise<void>;
  /**
   * Adopt a token the server just issued.
   *
   * `POST /auth/me/password` and `POST /auth/me/sign-out-everywhere` bump
   * `token_version`, invalidating every existing token including this device's,
   * and hand back a replacement. Without adopting it the user would be signed
   * out of the account they just secured -- the web keeps `setSession` public
   * for exactly this reason (`frontend/src/auth/AuthContext.tsx:30-38`).
   */
  setSession: (token: string, user: UserMe) => void;
  signOut: () => void;
  retry: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const token = useAccessToken();
  const queryClient = useQueryClient();
  const instanceUrl = getInstanceUrl();

  const meQuery = useMeAuthMeGet({
    query: {
      // Retrying a 401 is pointless with no refresh flow, exactly as on web.
      retry: false,
      enabled: Boolean(token) && Boolean(instanceUrl),
    },
  });

  const setSession = useCallback(
    (nextToken: string, user: UserMe) => {
      void persistToken(nextToken);
      // Seed the cache from the login response's embedded `user` rather than
      // making a second round trip to /auth/me.
      queryClient.setQueryData(getMeAuthMeGetQueryKey(), user);
    },
    [queryClient],
  );

  const signIn = useCallback(
    async (instance: string, email: string, password: string) => {
      await setInstanceUrl(instance);
      // The OAuth2 `username` field carries the email: the backend resolves it
      // with find_user_by_email and has no username lookup
      // (`backend/lib_identity/identity.py:170`).
      const result = await loginAuthLoginPost({ username: email, password });
      setSession(result.access_token, result.user);
    },
    [setSession],
  );

  const signOut = useCallback(() => {
    void persistToken(null);
    queryClient.clear();
    // The instance URL deliberately survives: making someone retype their
    // server address because they signed out is hostile. Issue #15's explicit
    // "switch instance" is how it changes.
  }, [queryClient]);

  const retry = useCallback(() => {
    void meQuery.refetch();
  }, [meQuery]);

  const status: SessionStatus = !token || !instanceUrl
    ? 'signedOut'
    : meQuery.data
      ? 'signedIn'
      : meQuery.isPending
        ? 'loading'
        : isNetworkError(meQuery.error)
          ? 'unreachable'
          : 'signedOut';

  const value = useMemo<AuthContextValue>(
    () => ({
      user: meQuery.data ?? null,
      status,
      isAuthenticated: status === 'signedIn',
      instanceUrl,
      signIn,
      setSession,
      signOut,
      retry,
    }),
    [meQuery.data, status, instanceUrl, signIn, setSession, signOut, retry],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside an AuthProvider');
  return value;
}
