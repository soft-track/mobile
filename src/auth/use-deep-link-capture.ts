import { useEffect } from 'react';
import * as Linking from 'expo-linking';

import { deepLinkPath, rememberDestination } from '@/auth/pending-destination';

/**
 * Remember where a deep link was heading while the user is signed out.
 *
 * `Stack.Protected` redirects declaratively, which is what keeps the router out
 * of the axios interceptor -- but it also means the attempted route is simply
 * dropped. Capturing it here, before the gate acts, is what lets the login
 * screen replay it.
 *
 * Covers both entry points: a cold start into the link, and a link arriving
 * while the app is already open.
 */
export function useDeepLinkCapture(signedOut: boolean): void {
  useEffect(() => {
    if (!signedOut) return;

    let cancelled = false;

    void Linking.getInitialURL().then((url) => {
      if (cancelled || !url) return;
      rememberDestination(deepLinkPath(url));
    });

    const subscription = Linking.addEventListener('url', ({ url }) => {
      rememberDestination(deepLinkPath(url));
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [signedOut]);
}
