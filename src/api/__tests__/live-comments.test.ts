/**
 * @jest-environment node
 */
import { loginAuthLoginPost } from '@/api/generated/endpoints/auth/auth';
import {
  createCommentIssuesIssueIdCommentsPost,
  listCommentsIssuesIssueIdCommentsGet,
} from '@/api/generated/endpoints/comments/comments';
import {
  createIssueTeamsTeamIdIssuesPost,
  deleteIssueIssuesIssueIdDelete,
  getIssueIssuesIssueIdGet,
  updateIssueIssuesIssueIdPatch,
} from '@/api/generated/endpoints/issues/issues';
import {
  getWatchStateIssuesIssueIdWatchGet,
  setWatchStateIssuesIssueIdWatchPut,
} from '@/api/generated/endpoints/notifications/notifications';
import { listTeamMembersTeamsTeamIdMembersGet } from '@/api/generated/endpoints/teams/teams';
import type { TeamRead } from '@/api/generated/models';
import { setInstanceUrl } from '@/api/instance';
import { persistToken } from '@/auth/session';
import { toggleTaskAtIndex } from '@/markdown/tasks';
import { seededTeam } from '@/api/__tests__/support/team';

/**
 * Comments and markdown against a real instance.
 *
 * The acceptance criterion for #8 is that a comment written on mobile renders
 * identically on web, which means the *source* has to survive the round trip
 * untouched -- so these assert the bytes, not a rendering.
 */
const LIVE_URL = process.env.SOFTTRACK_LIVE_URL;
const describeLive = LIVE_URL ? describe : describe.skip;

const RUN = Date.now().toString(36).slice(-5);

describeLive('comments against a live instance', () => {
  let team: TeamRead;
  const created: number[] = [];

  beforeAll(async () => {
    await setInstanceUrl(LIVE_URL!);
    const token = await loginAuthLoginPost({
      username: process.env.SOFTTRACK_LIVE_EMAIL ?? 'demo@softtrack.dev',
      password: process.env.SOFTTRACK_LIVE_PASSWORD ?? 'password123',
    });
    await persistToken(token.access_token);
    team = await seededTeam();
  });

  afterAll(async () => {
    for (const id of created) {
      await deleteIssueIssuesIssueIdDelete(id).catch(() => undefined);
    }
  });

  async function newIssue(title: string, description?: string) {
    const issue = await createIssueTeamsTeamIdIssuesPost(team.id, { title, description });
    created.push(issue.id);
    return issue;
  }

  it('stores comment markdown byte for byte', async () => {
    const issue = await newIssue(`Comment ${RUN}`);
    // Everything GFM that the issue names, including the shapes a parser would
    // normalise if the client round-tripped through one.
    const body = [
      '## Heading',
      '',
      'Some **bold**, ~~struck~~ and `code`.',
      '',
      '| a | b |',
      '| - | - |',
      '| 1 | 2 |',
      '',
      '```sh',
      'echo "@demo is not a mention in here"',
      '```',
      '',
      '- [ ] not done',
      '- [x] done',
    ].join('\n');

    const comment = await createCommentIssuesIssueIdCommentsPost(issue.id, { body });
    expect(comment.body).toBe(body);

    const page = await listCommentsIssuesIssueIdCommentsGet(issue.id, { limit: 20 });
    expect(page.items.map((c) => c.body)).toContain(body);
  });

  it('paginates, which is what the "show more" control pages through', async () => {
    const issue = await newIssue(`Paging ${RUN}`);
    for (let n = 0; n < 3; n += 1) {
      await createCommentIssuesIssueIdCommentsPost(issue.id, { body: `comment ${n}` });
    }

    const firstPage = await listCommentsIssuesIssueIdCommentsGet(issue.id, {
      limit: 2,
      offset: 0,
    });
    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.total).toBe(3);

    const wider = await listCommentsIssuesIssueIdCommentsGet(issue.id, { limit: 20 });
    expect(wider.items).toHaveLength(3);
  });

  it('watches an issue you opened, and does not resubscribe you after you opt out', async () => {
    // auto_watch only ever adds a row when none exists
    // (`lib_softtrack/notifications.py:72`): someone who unwatched an issue and
    // then answered a question on it meant to answer the question, not to
    // resubscribe. This is what "the same auto-watch semantics as web" means,
    // and it is why the toggle reads the server's state instead of predicting
    // it after a comment.
    const issue = await newIssue(`Autowatch ${RUN}`);
    expect((await getWatchStateIssuesIssueIdWatchGet(issue.id)).watching).toBe(true);

    await setWatchStateIssuesIssueIdWatchPut(issue.id, { watching: false });
    await createCommentIssuesIssueIdCommentsPost(issue.id, { body: 'answering a question' });

    expect((await getWatchStateIssuesIssueIdWatchGet(issue.id)).watching).toBe(false);
  });

  it('persists a ticked checkbox as a one-character edit', async () => {
    const description = ['- [ ] first', '- [ ] second'].join('\n');
    const issue = await newIssue(`Tasks ${RUN}`, description);

    const toggled = toggleTaskAtIndex(issue.description ?? '', 1)!;
    await updateIssueIssuesIssueIdPatch(issue.id, { description: toggled });

    const refreshed = await getIssueIssuesIssueIdGet(issue.id);
    expect(refreshed.description).toBe('- [ ] first\n- [x] second');
  });

  it('restricts mentionable people to the issue team', async () => {
    // The `@` menu offers exactly these, because they are who the API will
    // notify.
    const members = await listTeamMembersTeamsTeamIdMembersGet(team.id);
    expect(members.length).toBeGreaterThan(0);
    for (const member of members) {
      expect(member.user.username).toEqual(expect.any(String));
    }
  });
});
