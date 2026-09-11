import type { QueryClient } from '@tanstack/react-query';

import { createCommentIssuesIssueIdCommentsPost } from '@/api/generated/endpoints/comments/comments';
import {
  createIssueTeamsTeamIdIssuesPost,
  getIssueIssuesIssueIdGet,
  updateIssueIssuesIssueIdPatch,
} from '@/api/generated/endpoints/issues/issues';
import type { IssueRead, StatusRead } from '@/api/generated/models';

/**
 * The mutations that survive going offline.
 *
 * React Query pauses a mutation while `onlineManager` says there is no network
 * and replays it on reconnect. For that to survive the app being killed, the
 * mutation function has to be registered by key rather than passed inline --
 * a persisted mutation is only data, and `setMutationDefaults` is what turns it
 * back into something runnable.
 *
 * Only these three are queued. They are the ones the issue names, and the ones
 * where doing the work offline is genuinely useful: moving a card, saying
 * something, and capturing a thought. Everything else asks for a connection.
 */
export const QUEUED = {
  moveIssue: ['offline', 'moveIssue'] as const,
  addComment: ['offline', 'addComment'] as const,
  createIssue: ['offline', 'createIssue'] as const,
};

export type MoveIssueVariables = {
  issueId: number;
  status: StatusRead;
  /** The issue's updated_at when the move was queued, for conflict detection. */
  seenAt: string;
  identifier: string;
};

export type AddCommentVariables = {
  issueId: number;
  body: string;
  identifier: string;
};

export type CreateIssueVariables = {
  teamId: number;
  title: string;
  description?: string;
};

/**
 * A queued move whose issue changed while we were away.
 *
 * Thrown rather than silently applied: somebody else moving the card to Done
 * while this phone was in a tunnel is exactly the case where replaying blindly
 * would undo their work.
 */
export class MoveConflict extends Error {
  constructor(
    readonly identifier: string,
    readonly intended: string,
    readonly actual: string,
  ) {
    super(
      `${identifier} moved to ${actual} while you were offline, so it was not moved to ${intended}.`,
    );
    this.name = 'MoveConflict';
  }
}

export function registerQueuedMutations(queryClient: QueryClient): void {
  queryClient.setMutationDefaults(QUEUED.moveIssue, {
    mutationFn: async (variables: MoveIssueVariables) => {
      const current = await getIssueIssuesIssueIdGet(variables.issueId);

      // Unchanged since it was queued: the move is still the one intended.
      if (current.updated_at !== variables.seenAt && current.status.id !== variables.status.id) {
        throw new MoveConflict(
          variables.identifier,
          variables.status.name,
          current.status.name,
        );
      }

      return updateIssueIssuesIssueIdPatch(variables.issueId, {
        status_id: variables.status.id,
      });
    },
  });

  queryClient.setMutationDefaults(QUEUED.addComment, {
    mutationFn: (variables: AddCommentVariables) =>
      createCommentIssuesIssueIdCommentsPost(variables.issueId, { body: variables.body }),
  });

  queryClient.setMutationDefaults(QUEUED.createIssue, {
    mutationFn: (variables: CreateIssueVariables) =>
      createIssueTeamsTeamIdIssuesPost(variables.teamId, {
        title: variables.title,
        description: variables.description,
      }),
  });
}

/** What a queued mutation is called in the sync panel. */
export function describeQueued(mutationKey: unknown, variables: unknown): string {
  const key = Array.isArray(mutationKey) ? mutationKey.join('/') : '';

  if (key === QUEUED.moveIssue.join('/')) {
    const move = variables as MoveIssueVariables;
    return `Move ${move.identifier} to ${move.status.name}`;
  }
  if (key === QUEUED.addComment.join('/')) {
    const comment = variables as AddCommentVariables;
    return `Comment on ${comment.identifier}`;
  }
  if (key === QUEUED.createIssue.join('/')) {
    const issue = variables as CreateIssueVariables;
    return `New issue “${issue.title}”`;
  }
  return 'Pending change';
}

/** The issue as it should look while a queued move waits. */
export function withQueuedStatus(issue: IssueRead, status: StatusRead): IssueRead {
  return { ...issue, status };
}
