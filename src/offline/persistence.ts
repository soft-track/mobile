import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

/**
 * The cache that survives the app being closed.
 *
 * What this buys is offline *reading*: boards, issues and comments that were
 * loaded recently are still there with no network. A week is long enough that a
 * phone opened on Monday still shows Friday's board, and short enough that
 * nothing ancient is presented as current -- the banner says what it is.
 */
export const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'softtrack.cache',
  // Writes are debounced so a fast-scrolling board does not thrash storage.
  throttleTime: 1000,
});
