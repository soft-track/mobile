import { QueryClient } from '@tanstack/react-query';

import { describeQueued, MoveConflict, QUEUED, registerQueuedMutations } from '@/offline/queue';

jest.mock('@/api/generated/endpoints/issues/issues', () => ({
  getIssueIssuesIssueIdGet: jest.fn(),
  updateIssueIssuesIssueIdPatch: jest.fn(),
  createIssueTeamsTeamIdIssuesPost: jest.fn(),
}));
jest.mock('@/api/generated/endpoints/comments/comments', () => ({
  createCommentIssuesIssueIdCommentsPost: jest.fn(),
}));

const issues = jest.requireMock('@/api/generated/endpoints/issues/issues');

const TODO = { id: 1, name: 'Todo', category: 'unstarted', color: '#000', team_id: 1, position: 1 };
const DONE = { id: 2, name: 'Done', category: 'done', color: '#0f0', team_id: 1, position: 2 };

/** Run the registered move mutation the way a resumed queue would. */
async function runMove(variables: Record<string, unknown>) {
  const client = new QueryClient();
  registerQueuedMutations(client);
  const defaults = client.getMutationDefaults(QUEUED.moveIssue);
  return (defaults.mutationFn as (v: unknown) => Promise<unknown>)(variables);
}

beforeEach(() => jest.clearAllMocks());

describe('the queued move', () => {
  it('applies when nothing changed while offline', async () => {
    issues.getIssueIssuesIssueIdGet.mockResolvedValue({
      updated_at: 'T1',
      status: TODO,
    });
    issues.updateIssueIssuesIssueIdPatch.mockResolvedValue({ status: DONE });

    await runMove({ issueId: 7, status: DONE, seenAt: 'T1', identifier: 'ENG-7' });

    expect(issues.updateIssueIssuesIssueIdPatch).toHaveBeenCalledWith(7, { status_id: 2 });
  });

  it('refuses when somebody else moved it in the meantime', async () => {
    // Replaying blindly here would undo their work, which is the whole reason
    // the timestamp is captured when the move is queued.
    issues.getIssueIssuesIssueIdGet.mockResolvedValue({
      updated_at: 'T2',
      status: { ...TODO, id: 3, name: 'In Review' },
    });

    await expect(
      runMove({ issueId: 7, status: DONE, seenAt: 'T1', identifier: 'ENG-7' }),
    ).rejects.toBeInstanceOf(MoveConflict);
    expect(issues.updateIssueIssuesIssueIdPatch).not.toHaveBeenCalled();
  });

  it('is not a conflict when somebody made the same move', async () => {
    // The issue changed, but it is already where this move wanted it -- there
    // is nothing to argue about.
    issues.getIssueIssuesIssueIdGet.mockResolvedValue({ updated_at: 'T2', status: DONE });
    issues.updateIssueIssuesIssueIdPatch.mockResolvedValue({ status: DONE });

    await runMove({ issueId: 7, status: DONE, seenAt: 'T1', identifier: 'ENG-7' });
    expect(issues.updateIssueIssuesIssueIdPatch).toHaveBeenCalled();
  });

  it('names both sides in the conflict message', async () => {
    const conflict = new MoveConflict('ENG-7', 'Done', 'In Review');
    expect(conflict.message).toContain('ENG-7');
    expect(conflict.message).toContain('In Review');
    expect(conflict.message).toContain('Done');
  });
});

describe('describeQueued', () => {
  it('says what each waiting change will do', () => {
    expect(
      describeQueued(QUEUED.moveIssue, { identifier: 'ENG-7', status: DONE }),
    ).toBe('Move ENG-7 to Done');
    expect(describeQueued(QUEUED.addComment, { identifier: 'ENG-7' })).toBe(
      'Comment on ENG-7',
    );
    expect(describeQueued(QUEUED.createIssue, { title: 'Fix it' })).toBe(
      'New issue “Fix it”',
    );
  });

  it('falls back rather than rendering a key', () => {
    expect(describeQueued(['something', 'else'], {})).toBe('Pending change');
  });
});
