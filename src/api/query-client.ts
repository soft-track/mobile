import { QueryClient } from '@tanstack/react-query';

/**
 * Defaults match the web's (`frontend/src/app/main.tsx:10-17`).
 *
 * `refetchOnWindowFocus` is off there because it fires on every tab switch; the
 * React Native equivalent (`refetchOnWindowFocus` driven by AppState) is off for
 * the same reason, and issue #18 will decide what refetching on foreground
 * should actually look like.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      // Long enough that a persisted cache is still served after a restart --
      // without it everything would be discarded as stale on the way in, which
      // is exactly the case offline reading exists for.
      gcTime: 7 * 24 * 60 * 60 * 1000,
    },
  },
});
