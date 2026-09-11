/**
 * Storage keys, kept byte-identical to the web client's so the two stay
 * conceptually in sync (`frontend/src/api/client.ts:3`, `frontend/src/ui/theme.ts:5`).
 */

/** The JWT. Secret -- lives in the Keychain / Android Keystore. */
export const TOKEN_KEY = 'softtrack.token';

/** Explicit theme choice. Absent means "follow the system". */
export const THEME_KEY = 'softtrack.theme';

/** Base URL of the instance the user signed in to. */
export const INSTANCE_KEY = 'softtrack.instance';
