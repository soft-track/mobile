import { useSyncExternalStore } from 'react';

import Axios from 'axios';

import { INSTANCE_KEY } from '@/storage/keys';
import { readPref, removePref, writePref } from '@/storage/prefs';

/**
 * The SoftTrack instance this app is talking to.
 *
 * Unlike the web client -- which bakes `VITE_API_BASE_URL` in at build time
 * (`frontend/src/api/client.ts:6`) -- a mobile build has to reach whichever
 * self-hosted instance the user types in. The value is held in a module-level
 * mirror so the axios request interceptor can read it synchronously.
 *
 * It is also an external store, for the same reason the token is: sign-in sets
 * the instance and the session together, and a component that decides whether
 * you are signed in has to see both change. Reading the mirror non-reactively
 * meant the auth gate could render once with the instance still absent and never
 * re-render to notice it had arrived -- signing in, storing a token, and then
 * sitting on the login screen anyway.
 */
let instanceUrl: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function getInstanceUrl(): string | null {
  return instanceUrl;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Re-renders on every instance change, so the auth gate reacts to sign-in. */
export function useInstanceUrl(): string | null {
  return useSyncExternalStore(subscribe, getInstanceUrl, getInstanceUrl);
}

export async function hydrateInstanceUrl(): Promise<string | null> {
  instanceUrl = await readPref(INSTANCE_KEY);
  emit();
  return instanceUrl;
}

export async function setInstanceUrl(url: string | null): Promise<void> {
  instanceUrl = url;
  emit();
  if (url === null) await removePref(INSTANCE_KEY);
  else await writePref(INSTANCE_KEY, url);
}

const SCHEME = /^([a-z][a-z0-9+.-]*):\/\//i;
/** Control and zero-width characters, which survive a paste from a chat app. */
const INVISIBLE = /[\u0000-\u001f\u007f\u200b-\u200d\ufeff]/g;

/**
 * Turn what someone typed into a base URL, or `null` if it cannot be one.
 *
 * Deliberately hand-rolled rather than built on `new URL()`: React Native's URL
 * is a regex approximation (`react-native/Libraries/Blob/URL.js`) that does not
 * throw on malformed input and does not normalise case, so the usual
 * "construct it and catch" idiom silently accepts junk here.
 */
export function normalizeInstanceUrl(raw: string): string | null {
  let value = raw.replace(INVISIBLE, '').trim();
  if (!value) return null;

  const scheme = value.match(SCHEME);
  if (!scheme) {
    // Bare `track.company.com` is what people actually type. Assume TLS.
    value = `https://${value}`;
  } else if (!/^https?$/i.test(scheme[1])) {
    // Anything else -- javascript:, file:, softtrack: -- is not a server.
    return null;
  }

  const separator = value.indexOf('://');
  const protocol = value.slice(0, separator).toLowerCase();
  const afterScheme = value.slice(separator + 3);
  if (!afterScheme) return null;

  // Split the authority off first, so a `?` or `#` inside a path cannot be
  // mistaken for the end of the host.
  const pathStart = afterScheme.search(/[/?#]/);
  const authority = pathStart === -1 ? afterScheme : afterScheme.slice(0, pathStart);
  const rest = pathStart === -1 ? '' : afterScheme.slice(pathStart);

  // `user:pass@host` is a phishing shape, and the API never needs it.
  if (authority.includes('@')) return null;
  if (!authority || /\s/.test(authority)) return null;

  const [host, port, ...extra] = authority.split(':');
  if (extra.length > 0) return null;
  if (!host || !/^[a-z0-9.-]+$/i.test(host)) return null;
  if (port !== undefined && !/^\d+$/.test(port)) return null;

  // Query and fragment are never meaningful in a base URL. Drop rather than
  // reject -- a trailing `?` from a copied address bar should not be fatal.
  // Keep any sub-path: reverse-proxied instances at /softtrack are real.
  const path = rest.split(/[?#]/)[0].replace(/\/+$/, '');

  const authorityOut =
    port === undefined ? host.toLowerCase() : `${host.toLowerCase()}:${port}`;
  return `${protocol}://${authorityOut}${path}`;
}

/** Just the host, for display: `https://track.acme.dev/st` -> `track.acme.dev`. */
export function instanceLabel(url: string): string {
  const afterScheme = url.slice(url.indexOf('://') + 3);
  const pathStart = afterScheme.search(/[/?#]/);
  return pathStart === -1 ? afterScheme : afterScheme.slice(0, pathStart);
}

/** The public shape of `GET /auth/config`. */
export type InstanceConfig = {
  open_registration: boolean;
  landing_page: boolean;
  demo_credentials: boolean;
};

export type ProbeResult =
  | { ok: true; config: InstanceConfig }
  | { ok: false; reason: 'unreachable' | 'not-softtrack'; message: string };

function notSoftTrack(baseURL: string): ProbeResult {
  return {
    ok: false,
    reason: 'not-softtrack',
    message: `${instanceLabel(baseURL)} answered, but it is not a SoftTrack instance.`,
  };
}

/**
 * Confirm a URL is a reachable SoftTrack instance before anything is stored.
 *
 * Uses a bare axios instance rather than the shared one on purpose: the probe
 * must carry no token and must not be able to trip the 401 interceptor.
 */
export async function probeInstance(
  baseURL: string,
  signal?: AbortSignal,
): Promise<ProbeResult> {
  const http = Axios.create({ baseURL, timeout: 8000 });

  try {
    const health = await http.get('/health', { signal });
    if (health.data?.status !== 'ok') return notSoftTrack(baseURL);
  } catch {
    return {
      ok: false,
      reason: 'unreachable',
      message: `Could not reach ${instanceLabel(baseURL)}. Check the link and your connection.`,
    };
  }

  try {
    const { data } = await http.get<InstanceConfig>('/auth/config', { signal });
    if (typeof data?.open_registration !== 'boolean') return notSoftTrack(baseURL);
    return { ok: true, config: data };
  } catch {
    return notSoftTrack(baseURL);
  }
}
