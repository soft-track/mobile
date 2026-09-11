import NetInfo from '@react-native-community/netinfo';
import { onlineManager, focusManager } from '@tanstack/react-query';
import { AppState, type AppStateStatus } from 'react-native';

/**
 * Telling React Query whether there is a network.
 *
 * Its browser default listens for `window.online`, which does not exist here --
 * without this, a phone in a tunnel keeps firing requests that time out one by
 * one instead of pausing them, and nothing is ever queued.
 *
 * `isInternetReachable` rather than `isConnected`: a captive portal or a Wi-Fi
 * network with no route out is still "connected", and is exactly the case where
 * a request will hang rather than fail fast.
 */
export function startConnectivityWatch(): () => void {
  const unsubscribeNet = NetInfo.addEventListener((state) => {
    const reachable = state.isInternetReachable ?? state.isConnected ?? false;
    onlineManager.setOnline(Boolean(reachable));
  });

  // React Query's focus default is also browser-shaped; on a phone, coming back
  // to the app is the equivalent event.
  const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
    focusManager.setFocused(status === 'active');
  });

  return () => {
    unsubscribeNet();
    subscription.remove();
  };
}
