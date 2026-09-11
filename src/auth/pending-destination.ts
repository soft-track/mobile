/**
 * Where a deep link was trying to go before the auth gate intervened.
 *
 * The web carries this in the URL -- `/login?next=/invite/abc` -- and
 * `signInDestination` sanitises it on the way out
 * (`frontend/src/auth/redirect.ts`). Here the router redirects declaratively
 * via `Stack.Protected`, which does not preserve the attempted route, so it is
 * captured on the way in and replayed after sign-in.
 *
 * Module-level rather than React state so the capture can happen from a
 * Linking subscription before any screen has mounted.
 */
let pending: string | null = null;

/** Paths the gate would never bounce off, so recording them would be a loop. */
const NEVER_PENDING = ['/login', '/register'];

/**
 * Record where the user was heading, if it is somewhere worth returning to.
 *
 * Only same-app absolute paths are kept. The web refuses `//host` and `/\host`
 * for open-redirect reasons; the same shapes are refused here so a crafted deep
 * link cannot aim the post-sign-in navigation somewhere unexpected.
 */
export function rememberDestination(path: string | null | undefined): void {
  if (!path) return;
  if (!path.startsWith('/')) return;
  if (path.startsWith('//') || path.startsWith('/\\')) return;
  if (NEVER_PENDING.some((p) => path === p || path.startsWith(`${p}?`))) return;
  pending = path;
}

export function peekDestination(): string | null {
  return pending;
}

/** Read and clear -- a destination is only ever replayed once. */
export function takeDestination(): string | null {
  const value = pending;
  pending = null;
  return value;
}

export function clearDestination(): void {
  pending = null;
}

/**
 * The path and query of a deep link, or null if it carries none.
 *
 * Handles both shapes the app can receive: the custom scheme
 * (`softtrack://invite/abc`) and an https link (`https://host/invite/abc`).
 * The custom scheme puts the first segment in the host position, which is why
 * this cannot just read `pathname`.
 */
export function deepLinkPath(url: string): string | null {
  const separator = url.indexOf('://');
  if (separator === -1) return null;

  const scheme = url.slice(0, separator).toLowerCase();
  const rest = url.slice(separator + 3);
  if (!rest) return null;

  if (scheme === 'http' || scheme === 'https') {
    // Real URL: everything from the first slash after the authority.
    const slash = rest.search(/[/?#]/);
    return slash === -1 ? '/' : rest.slice(slash);
  }

  // Custom scheme: `softtrack://invite/abc` has "invite" where a host goes.
  return `/${rest}`;
}
