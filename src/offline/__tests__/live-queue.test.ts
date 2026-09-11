/**
 * @jest-environment node
 */
import { MutationCache, QueryClient, onlineManager } from '@tanstack/react-query';

import { loginAuthLoginPost } from '@/api/generated/endpoints/auth/auth';
import {
  deleteIssueIssuesIssueIdDelete,
  getIssueIssuesIssueIdGet,
  listIssuesTeamsTeamIdIssuesGet,
  updateIssueIssuesIssueIdPatch,
} from '@/api/generated/endpoints/issues/issues';
import { listStatusesTeamsTeamIdStatusesGet } from '@/api/generated/endpoints/statuses/statuses';
import { listCommentsIssuesIssueIdCommentsGet } from '@/api/generated/endpoints/comments/comments';
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
 *   SOFTTRACK_URL=http://localhost:8000 SOFTTRACK_EMAIL=... SOFTTRACK_PASSWORD=... npm test
 */
const URL_ = process.env.SOFTTRACK_URL;
const EMAIL = process.env.SOFTTRACK_EMAIL;
const PASSWORD = process.env.SOFTTRACK_PASSWORD;
const describeLive = URL_ && EMAIL && PASSWORD ? describe : describe.skip;

describeLive('the offline queue, live', () => {
  let client: QueryClient;
  let teamId: number;
  const scratch: number[] = [];

  beforeAll(async () => {
    await setInstanceUrl(URL_!);
    const token = await loginAuthLoginPost({ username: EMAIL!, password: PASSWORD! });
    await persistToken(token.access_token);
    teamId = 1;
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
    client.unmount();
    client.getMutationCache().clear();
  });

  afterAll(async () => {
    onlineManager.setOnline(true);
    for (const id of scratch) await deleteIssueIssuesIssueIdDelete(id).catch(() => undefined);
  });

  it('holds a move while there is no network and sends it on reconnect', async () => {
    const statuses = await listStatusesTeamsTeamIdStatusesGet(teamId);
    const page = await listIssuesTeamsTeamIdIssuesGet(teamId, { limit: 1 });
    const issue = page.items[0];
    const target = statuses.find((s) => s.id !== issue.status.id)!;
    const before = issue.status;

    onlineManager.setOnline(false);

    const mutation = client
      .getMutationCache()
      .build(client, { mutationKey: QUEUED.moveIssue });
    const settled = mutation.execute({
      issueId: issue.id,
      status: target,
      seenAt: issue.updated_at,
      identifier: issue.identifier,
    });

    // Paused, not failed, and not sent.
    await new Promise((r) => setTimeout(r, 150));
    expect(mutation.state.isPaused).toBe(true);
    expect((await getIssueIssuesIssueIdGet(issue.id)).status.id).toBe(before.id);

    onlineManager.setOnline(true);
    await settled;

    expect(mutation.state.isPaused).toBe(false);
    expect((await getIssueIssuesIssueIdGet(issue.id)).status.id).toBe(target.id);

    // Put it back where it was found.
    const restore = client.getMutationCache().build(client, { mutationKey: QUEUED.moveIssue });
    const now = await getIssueIssuesIssueIdGet(issue.id);
    await restore.execute({
      issueId: issue.id,
      status: before,
      seenAt: now.updated_at,
      identifier: issue.identifier,
    });
  }, 30_000);

  it('refuses a queued move when somebody else moved it first', async () => {
    const statuses = await listStatusesTeamsTeamIdStatusesGet(teamId);
    const page = await listIssuesTeamsTeamIdIssuesGet(teamId, { limit: 1 });
    const issue = page.items[0];
    const mine = statuses.find((s) => s.id !== issue.status.id)!;
    const theirs = statuses.find((s) => s.id !== issue.status.id && s.id !== mine.id)!;
    const before = issue.status;

    onlineManager.setOnline(false);
    const mutation = client.getMutationCache().build(client, { mutationKey: QUEUED.moveIssue });
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

    await updateIssueIssuesIssueIdPatch(issue.id, { status_id: before.id });
  }, 30_000);

  it('holds a comment and an issue creation, then sends both', async () => {
    const page = await listIssuesTeamsTeamIdIssuesGet(teamId, { limit: 1 });
    const issue = page.items[0];
    const body = `Queued while offline ${Date.now().toString(36).slice(-5)}`;

    onlineManager.setOnline(false);
    const comment = client.getMutationCache().build(client, { mutationKey: QUEUED.addComment });
    const create = client.getMutationCache().build(client, { mutationKey: QUEUED.createIssue });
    const commentDone = comment.execute({ issueId: issue.id, body, identifier: issue.identifier });
    const createDone = create.execute({ teamId, title: `Queued offline ${body.slice(-5)}` });

    await new Promise((r) => setTimeout(r, 150));
    expect(comment.state.isPaused).toBe(true);
    expect(create.state.isPaused).toBe(true);

    onlineManager.setOnline(true);
    await Promise.all([commentDone, createDone]);

    const comments = await listCommentsIssuesIssueIdCommentsGet(issue.id, { limit: 50 });
    expect(comments.items.map((c) => c.body)).toContain(body);

    const created = create.state.data as { id: number };
    scratch.push(created.id);
    expect((await getIssueIssuesIssueIdGet(created.id)).id).toBe(created.id);
  }, 30_000);
});
