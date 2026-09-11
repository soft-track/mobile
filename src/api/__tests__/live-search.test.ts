/**
 * @jest-environment node
 */
import { loginAuthLoginPost } from '@/api/generated/endpoints/auth/auth';
import { createCommentIssuesIssueIdCommentsPost } from '@/api/generated/endpoints/comments/comments';
import {
  createIssueTeamsTeamIdIssuesPost,
  deleteIssueIssuesIssueIdDelete,
} from '@/api/generated/endpoints/issues/issues';
import { searchSearchGet } from '@/api/generated/endpoints/search/search';
import type { TeamRead } from '@/api/generated/models';
import { setInstanceUrl } from '@/api/instance';
import { persistToken } from '@/auth/session';
import { seededTeam } from '@/api/__tests__/support/team';

/**
 * Search against a real instance.
 *
 * The acceptance criterion for #11 is the same result set as web for the same
 * query and scope, so what matters is that matching, ranking and scoping all
 * stay on the server -- the client only debounces and pages.
 */
const LIVE_URL = process.env.SOFTTRACK_LIVE_URL;
const describeLive = LIVE_URL ? describe : describe.skip;

const RUN = Date.now().toString(36).slice(-5);
const NEEDLE = `zqx${RUN}`;

describeLive('search against a live instance', () => {
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

    const inTitle = await createIssueTeamsTeamIdIssuesPost(team.id, {
      title: `Title match ${NEEDLE}`,
    });
    const inDescription = await createIssueTeamsTeamIdIssuesPost(team.id, {
      title: `Description holder ${RUN}`,
      description: `body mentions ${NEEDLE} here`,
    });
    const inComment = await createIssueTeamsTeamIdIssuesPost(team.id, {
      title: `Comment holder ${RUN}`,
    });
    await createCommentIssuesIssueIdCommentsPost(inComment.id, {
      body: `a comment saying ${NEEDLE}`,
    });
    created.push(inTitle.id, inDescription.id, inComment.id);
  });

  afterAll(async () => {
    for (const id of created) {
      await deleteIssueIssuesIssueIdDelete(id).catch(() => undefined);
    }
  });

  it('searches titles, descriptions and comments alike', async () => {
    const page = await searchSearchGet({ q: NEEDLE, limit: 25 });
    const ids = page.items.map((hit) => hit.id);

    for (const id of created) expect(ids).toContain(id);

    // `matched_in` is what the result row labels itself with.
    const kinds = new Set(page.items.map((hit) => hit.matched_in));
    expect(kinds.size).toBeGreaterThan(1);
  });

  it('carries a snippet, which is why the result is worth a line', async () => {
    const page = await searchSearchGet({ q: NEEDLE, limit: 25 });
    for (const hit of page.items) {
      expect(typeof hit.snippet).toBe('string');
      expect(hit.identifier).toContain(hit.team_key);
    }
  });

  it('scopes to one team when asked', async () => {
    const scoped = await searchSearchGet({ q: NEEDLE, team_id: team.id, limit: 25 });
    for (const hit of scoped.items) expect(hit.team_id).toBe(team.id);
    expect(scoped.items.length).toBeGreaterThan(0);
  });

  it('pages, which is what the "show more" control walks through', async () => {
    const first = await searchSearchGet({ q: NEEDLE, limit: 1, offset: 0 });
    expect(first.items).toHaveLength(1);
    expect(first.total).toBeGreaterThanOrEqual(3);

    const wider = await searchSearchGet({ q: NEEDLE, limit: 25 });
    expect(wider.items.length).toBe(wider.total);
  });

  it('finds nothing for a query that matches nothing', async () => {
    const page = await searchSearchGet({ q: `${NEEDLE}-absent`, limit: 25 });
    expect(page.items).toEqual([]);
    expect(page.total).toBe(0);
  });
});
