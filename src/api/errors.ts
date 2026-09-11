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

/**
 * Seconds to wait after a 429, from the `Retry-After` header.
 *
 * Sign-in is throttled per IP and per account (`backend/lib_utils/rate_limit.py`),
 * with exponential backoff. Telling someone "incorrect password" when they are
 * actually throttled makes them retry straight into a longer backoff, so the
 * wait has to be surfaced as itself.
 */
export function retryAfterSeconds(err: unknown): number | null {
  const response = (err as {
    response?: { status?: number; headers?: Record<string, unknown> };
  })?.response;
  if (response?.status !== 429) return null;

  const header = response.headers?.['retry-after'] ?? response.headers?.['Retry-After'];
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds >= 0 ? Math.ceil(seconds) : null;
}

/** "1 minute 30 seconds", for a message someone has to act on. */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}
