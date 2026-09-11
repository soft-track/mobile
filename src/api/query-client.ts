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
    },
  },
});
