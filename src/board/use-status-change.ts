import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { getListIssuesTeamsTeamIdIssuesGetQueryKey } from '@/api/generated/endpoints/issues/issues';
import { QUEUED, type MoveIssueVariables } from '@/offline/queue';
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
 *
 * The write itself goes through a keyed mutation rather than a bare call, so
 * React Query pauses it when there is no network and replays it on reconnect --
 * a card moved on a train stays moved, and reaches the server when the train
 * comes out of the tunnel.
 */
export function useStatusChange(
  team: TeamRead | undefined,
  params: ListIssuesTeamsTeamIdIssuesGetParams,
) {
  const queryClient = useQueryClient();
  const move = useMutation<unknown, Error, MoveIssueVariables>({
    mutationKey: QUEUED.moveIssue,
  });

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

      const before = previous?.items.find((item) => item.id === issueId);

      try {
        await move.mutateAsync({
          issueId,
          status,
          // Captured now so a replay can tell "nothing moved" from "somebody
          // else moved it while we were away".
          seenAt: before?.updated_at ?? '',
          identifier: before?.identifier ?? `#${issueId}`,
        });
        // Moving a card moves its points between columns, and may close out a
        // cycle's remaining work.
        void queryClient.invalidateQueries({ queryKey: [`/teams/${team.id}/estimates`] });
        void queryClient.invalidateQueries({ queryKey: [`/teams/${team.id}/cycles`] });
        void queryClient.invalidateQueries({ queryKey: [`/issues/${issueId}`] });
        return true;
      } catch {
        // A paused mutation does not reject, so reaching here means it was
        // genuinely refused -- put the card back where it was.
        queryClient.setQueryData(queryKey, previous);
        return false;
      }
    },
    [queryClient, team, params, move],
  );
}
