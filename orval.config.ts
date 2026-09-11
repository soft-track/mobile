import { defineConfig } from 'orval';

/**
 * Deliberately identical to `frontend/orval.config.ts` apart from the input
 * path. Same config means the same generated hook names in both clients
 * (`useLoginAuthLoginPost`, `useMeAuthMeGet`, ...), so query code moves between
 * the web and mobile repos unchanged.
 *
 * The input is vendored -- see `scripts/sync-openapi.sh` -- because the schema
 * is produced in the backend's repo.
 */
export default defineConfig({
  softtrack: {
    input: {
      target: './openapi/openapi.json',
    },
    output: {
      mode: 'tags-split',
      target: 'src/api/generated/endpoints',
      schemas: 'src/api/generated/models',
      client: 'react-query',
      httpClient: 'axios',
      // No baseUrl: it is resolved per request in the mutator, so one build
      // can talk to any self-hosted instance.
      override: {
        mutator: {
          path: 'src/api/client.ts',
          name: 'apiClient',
        },
      },
    },
  },
});
