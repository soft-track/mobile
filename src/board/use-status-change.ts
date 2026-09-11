import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import {
  getListIssuesTeamsTeamIdIssuesGetQueryKey,
  updateIssueIssuesIssueIdPatch,
} from '@/api/generated/endpoints/issues/issues';
import type {
  ListIssuesTeamsTeamIdIssuesGetParams,
  PageIssueRead,
  StatusRead,
  TeamRead,
} from '@/api/generated/models';

/**
 * Move an issue between columns, optimistically.
 *
 * A port of `frontend/src/board/useStatusChange.ts`. The card moves before the
 * server answers and moves back if the server refuses -- on a phone, where the
 * round trip may be a cellular one, waiting for it would make every drag feel
 * broken.
 *
 * `params` has to match what the board is showing, because it is part of the
 * query key being patched.
 */
export function useStatusChange(
  team: TeamRead | undefined,
  params: ListIssuesTeamsTeamIdIssuesGetParams,
) {
  const queryClient = useQueryClient();

  return useCallback(
    async (issueId: number, status: StatusRead): Promise<boolean> => {
      if (!team) return false;

      const queryKey = getListIssuesTeamsTeamIdIssuesGetQueryKey(team.id, params);
      const previous = queryClient.getQueryData<PageIssueRead>(queryKey);

      queryClient.setQueryData<PageIssueRead>(queryKey, (old) =>
        old
          ? {
              ...old,
              items: old.items.map((issue) =>
                issue.id === issueId ? { ...issue, status } : issue,
              ),
            }
          : old,
      );

      try {
        await updateIssueIssuesIssueIdPatch(issueId, { status_id: status.id });
        // Moving a card moves its points between columns, and may close out a
        // cycle's remaining work.
        void queryClient.invalidateQueries({ queryKey: [`/teams/${team.id}/estimates`] });
        void queryClient.invalidateQueries({ queryKey: [`/teams/${team.id}/cycles`] });
        void queryClient.invalidateQueries({ queryKey: [`/issues/${issueId}`] });
        return true;
      } catch {
        queryClient.setQueryData(queryKey, previous);
        return false;
      }
    },
    [queryClient, team, params],
  );
}
