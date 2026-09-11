/**
 * Pull the API's `detail` out of an axios error.
 *
 * FastAPI reports two different shapes under the same key: a plain string for
 * every hand-raised `HTTPException` ("Incorrect email or password"), and an
 * array of `{loc, msg, type}` for 422 validation failures. The web version
 * (`frontend/src/api/errors.ts`) only handles the string and falls back for the
 * array, which loses the actual validation message.
 */
export function errorDetail(err: unknown, fallback: string): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response
    ?.data?.detail;

  if (typeof detail === 'string' && detail.length > 0) return detail;

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) =>
        item && typeof item === 'object' && typeof (item as { msg?: unknown }).msg === 'string'
          ? (item as { msg: string }).msg
          : null,
      )
      .filter((msg): msg is string => msg !== null);
    if (messages.length > 0) return messages.join('. ');
  }

  return fallback;
}

/**
 * True when the request never got an answer.
 *
 * This is what separates "your session is dead" from "you are in a tunnel". On a
 * phone that distinction matters a great deal: treating an unreachable server as
 * a signed-out user throws away a working session and forces the whole server
 * link / email / password dance again.
 */
export function isNetworkError(err: unknown): boolean {
  const e = err as { response?: unknown; code?: string } | null | undefined;
  if (!e) return false;
  return !e.response || e.code === 'ERR_NETWORK' || e.code === 'ECONNABORTED';
}
