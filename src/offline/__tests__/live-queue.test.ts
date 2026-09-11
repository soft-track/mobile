/**
 * @jest-environment node
 */
import { MutationCache, QueryClient, onlineManager } from '@tanstack/react-query';

import { loginAuthLoginPost } from '@/api/generated/endpoints/auth/auth';
import { listCommentsIssuesIssueIdCommentsGet } from '@/api/generated/endpoints/comments/comments';
import {
  createIssueTeamsTeamIdIssuesPost,
  deleteIssueIssuesIssueIdDelete,
  getIssueIssuesIssueIdGet,
  updateIssueIssuesIssueIdPatch,
} from '@/api/generated/endpoints/issues/issues';
import { listStatusesTeamsTeamIdStatusesGet } from '@/api/generated/endpoints/statuses/statuses';
import type { IssueRead, StatusRead } from '@/api/generated/models';
import { setInstanceUrl } from '@/api/instance';
import { persistToken } from '@/auth/session';
import { QUEUED, MoveConflict, registerQueuedMutations } from '@/offline/queue';

/**
 * The offline queue against a running instance.
 *
 * The unit tests cover the conflict rule in isolation; what they cannot show is
 * that React Query actually pauses these mutations when `onlineManager` goes
 * down and replays them on the way back up. That round trip is the whole
 * feature, so it is worth exercising against a real server.
 *
 * Every test works on an issue it created itself. The seeded issues are shared
 * with every other live suite, and these assertions turn on an issue *not*
 * moving while the network is down -- which another suite moving it in parallel
 * would break for reasons that have nothing to do with the queue.
 *
 *   SOFTTRACK_URL=http://localhost:8000 SOFTTRACK_EMAIL=... SOFTTRACK_PASSWORD=... npm test
 */
const URL_ = process.env.SOFTTRACK_URL;
const EMAIL = process.env.SOFTTRACK_EMAIL;
const PASSWORD = process.env.SOFTTRACK_PASSWORD;
const describeLive = URL_ && EMAIL && PASSWORD ? describe : describe.skip;

const TEAM_ID = 1;

describeLive('the offline queue, live', () => {
  let client: QueryClient;
  let statuses: StatusRead[];
  const scratch: number[] = [];

  beforeAll(async () => {
    await setInstanceUrl(URL_!);
    const token = await loginAuthLoginPost({ username: EMAIL!, password: PASSWORD! });
    await persistToken(token.access_token);
    statuses = await listStatusesTeamsTeamIdStatusesGet(TEAM_ID);
  });

  beforeEach(() => {
    client = new QueryClient({
      mutationCache: new MutationCache(),
      // Settled mutations otherwise sit in the cache behind a five-minute
      // garbage-collection timer, which keeps the test runner alive.
      defaultOptions: { mutations: { gcTime: 0 } },
    });
    registerQueuedMutations(client);
    // Without mounting, the client never subscribes to `onlineManager` and a
    // paused mutation is never resumed -- which is also true in the app, and is
    // what `QueryClientProvider` does for it.
    client.mount();
    onlineManager.setOnline(true);
  });

  afterEach(() => {
    onlineManager.setOnline(true);
    client.unmount();
    client.getMutationCache().clear();
  });

  afterAll(async () => {
    for (const id of scratch) await deleteIssueIssuesIssueIdDelete(id).catch(() => undefined);
  });

  /** An issue nothing else is touching. */
  async function scratchIssue(title: string): Promise<IssueRead> {
    const issue = await createIssueTeamsTeamIdIssuesPost(TEAM_ID, { title });
    scratch.push(issue.id);
    return issue;
  }

  function queue(key: readonly unknown[]) {
    return client.getMutationCache().build(client, { mutationKey: [...key] });
  }

  it('holds a move while there is no network and sends it on reconnect', async () => {
    const issue = await scratchIssue('Offline queue: a move that waits');
    const target = statuses.find((s) => s.id !== issue.status.id)!;

    onlineManager.setOnline(false);
    const mutation = queue(QUEUED.moveIssue);
    const settled = mutation.execute({
      issueId: issue.id,
      status: target,
      seenAt: issue.updated_at,
      identifier: issue.identifier,
    });

    // Paused rather than failed, and genuinely not sent.
    await new Promise((r) => setTimeout(r, 150));
    expect(mutation.state.isPaused).toBe(true);
    expect((await getIssueIssuesIssueIdGet(issue.id)).status.id).toBe(issue.status.id);

    onlineManager.setOnline(true);
    await settled;

    expect(mutation.state.isPaused).toBe(false);
    expect((await getIssueIssuesIssueIdGet(issue.id)).status.id).toBe(target.id);
  }, 30_000);

  it('refuses a queued move when somebody else moved it first', async () => {
    const issue = await scratchIssue('Offline queue: a move somebody overtook');
    const mine = statuses.find((s) => s.id !== issue.status.id)!;
    const theirs = statuses.find((s) => s.id !== issue.status.id && s.id !== mine.id)!;

    onlineManager.setOnline(false);
    const mutation = queue(QUEUED.moveIssue);
    const settled = mutation.execute({
      issueId: issue.id,
      status: mine,
      seenAt: issue.updated_at,
      identifier: issue.identifier,
    });
    await new Promise((r) => setTimeout(r, 100));
    expect(mutation.state.isPaused).toBe(true);

    // Somebody else, on the web, moves it somewhere else entirely -- while this
    // client is still offline. A direct call, because their browser is not
    // subject to this client's `onlineManager`.
    await updateIssueIssuesIssueIdPatch(issue.id, { status_id: theirs.id });

    onlineManager.setOnline(true);
    await expect(settled).rejects.toBeInstanceOf(MoveConflict);
    // Their move stands; the queued one is dropped rather than applied on top.
    expect((await getIssueIssuesIssueIdGet(issue.id)).status.id).toBe(theirs.id);
  }, 30_000);

  it('applies a queued move when somebody else made the same one', async () => {
    const issue = await scratchIssue('Offline queue: a move somebody agreed with');
    const target = statuses.find((s) => s.id !== issue.status.id)!;

    onlineManager.setOnline(false);
    const mutation = queue(QUEUED.moveIssue);
    const settled = mutation.execute({
      issueId: issue.id,
      status: target,
      seenAt: issue.updated_at,
      identifier: issue.identifier,
    });
    await new Promise((r) => setTimeout(r, 100));

    await updateIssueIssuesIssueIdPatch(issue.id, { status_id: target.id });

    onlineManager.setOnline(true);
    // Landing where it was already headed is not a conflict.
    await expect(settled).resolves.toBeDefined();
    expect((await getIssueIssuesIssueIdGet(issue.id)).status.id).toBe(target.id);
  }, 30_000);

  it('holds a comment and an issue creation, then sends both', async () => {
    const issue = await scratchIssue('Offline queue: something to say');
    const body = 'Written in a tunnel, sent on the way out.';

    onlineManager.setOnline(false);
    const comment = queue(QUEUED.addComment);
    const create = queue(QUEUED.createIssue);
    const commentDone = comment.execute({
      issueId: issue.id,
      body,
      identifier: issue.identifier,
    });
    const createDone = create.execute({
      teamId: TEAM_ID,
      title: 'Offline queue: captured while away',
    });

    await new Promise((r) => setTimeout(r, 150));
    expect(comment.state.isPaused).toBe(true);
    expect(create.state.isPaused).toBe(true);
    expect((await listCommentsIssuesIssueIdCommentsGet(issue.id, { limit: 50 })).items).toEqual([]);

    onlineManager.setOnline(true);
    await Promise.all([commentDone, createDone]);

    const comments = await listCommentsIssuesIssueIdCommentsGet(issue.id, { limit: 50 });
    expect(comments.items.map((c) => c.body)).toContain(body);

    const created = create.state.data as IssueRead;
    scratch.push(created.id);
    expect((await getIssueIssuesIssueIdGet(created.id)).title).toBe(
      'Offline queue: captured while away',
    );
  }, 30_000);
});
