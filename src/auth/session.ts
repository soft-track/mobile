import { useSyncExternalStore } from 'react';

import { TOKEN_KEY } from '@/storage/keys';
import { deleteSecret, readSecret, writeSecret } from '@/storage/secure';

/**
 * The access token, held outside React so the axios interceptor can read it
 * synchronously on every request.
 *
 * The web reads `localStorage` per request (`frontend/src/api/client.ts:10`),
 * which is what makes a sign-out anywhere take effect everywhere. SecureStore is
 * async, so this module keeps an in-memory mirror with the same property: every
 * writer goes through `persistToken`, and the interceptor only ever reads the
 * mirror.
 */
let accessToken: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function getAccessToken(): string | null {
  return accessToken;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Re-renders on every token change, including the interceptor's 401 clear. */
export function useAccessToken(): string | null {
  return useSyncExternalStore(subscribe, getAccessToken, getAccessToken);
}

/** Load the stored token into the mirror. Called once, behind the splash. */
export async function hydrateSession(): Promise<string | null> {
  accessToken = await readSecret(TOKEN_KEY);
  return accessToken;
}

export async function persistToken(token: string | null): Promise<void> {
  accessToken = token;
  emit();
  if (token === null) await deleteSecret(TOKEN_KEY);
  else await writeSecret(TOKEN_KEY, token);
}

/**
 * Called by the response interceptor when a protected route returns 401.
 *
 * Clears the mirror synchronously so no in-flight request can still attach the
 * dead token, then deletes the stored copy in the background. Deliberately does
 * not navigate: the root layout's guard reacts to the token going away, which
 * keeps the router out of the axios module and makes a redirect loop
 * structurally impossible.
 */
export function signalUnauthorized(): void {
  if (accessToken === null) return;
  accessToken = null;
  emit();
  void deleteSecret(TOKEN_KEY);
}
