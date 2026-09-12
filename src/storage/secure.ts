import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Secret storage, backed by the iOS Keychain and the Android Keystore.
 *
 * Unlike `prefs`, a read failure here is meaningful: it means we could not
 * recover the session, which is the same outcome as having no session. Callers
 * treat `null` that way, so swallowing is still correct -- but a *write* failure
 * would silently sign the user out on next launch, so it is allowed to throw.
 *
 * SecureStore has no web implementation, so on the web target the token falls
 * back to localStorage. That is not the Keychain, but the web build exists for
 * development and review against a real instance, not for shipping secrets to a
 * phone -- and it is the same store the web app itself keeps its token in.
 */
const isWeb = Platform.OS === 'web';

function webStorage(): Storage | null {
  return typeof window !== 'undefined' ? window.localStorage : null;
}

export async function readSecret(key: string): Promise<string | null> {
  try {
    if (isWeb) return webStorage()?.getItem(key) ?? null;
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function writeSecret(key: string, value: string): Promise<void> {
  if (isWeb) {
    webStorage()?.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function deleteSecret(key: string): Promise<void> {
  try {
    if (isWeb) {
      webStorage()?.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Already gone, or the store is unavailable; either way there is nothing
    // left to clear.
  }
}
