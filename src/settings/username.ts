/**
 * The username rule, mirrored from `backend/lib_identity/usernames.py`.
 *
 * Checked before submitting so the form answers rather than the server -- a
 * round trip to be told a dash is fine but a space is not reads as a fault in
 * the app.
 */
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{1,38}$/;

export function isValidUsername(username: string): boolean {
  return USERNAME_PATTERN.test(username);
}
