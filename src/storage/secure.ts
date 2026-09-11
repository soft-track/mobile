import * as SecureStore from 'expo-secure-store';

/**
 * Secret storage, backed by the iOS Keychain and the Android Keystore.
 *
 * Unlike `prefs`, a read failure here is meaningful: it means we could not
 * recover the session, which is the same outcome as having no session. Callers
 * treat `null` that way, so swallowing is still correct -- but a *write* failure
 * would silently sign the user out on next launch, so it is allowed to throw.
 */

export async function readSecret(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function writeSecret(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value);
}

export async function deleteSecret(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Already gone, or the store is unavailable; either way there is nothing
    // left to clear.
  }
}
