import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Non-secret preferences. Storage can fail (full disk, a corrupted store), and a
 * failure here should never keep the app from starting -- the web makes the same
 * trade in `theme.ts`, where a failed write just means the choice lasts the
 * session. Every helper swallows and degrades.
 */

export async function readPref(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function writePref(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    // Ignored on purpose: the in-memory value still applies for this session.
  }
}

export async function removePref(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // Ignored on purpose -- see writePref.
  }
}
