/**
 * @jest-environment node
 */
import { loginAuthLoginPost } from '@/api/generated/endpoints/auth/auth';
import {
  createIssueLinkIssuesIssueIdLinksPost,
  createIssueTeamsTeamIdIssuesPost,
  deleteIssueIssuesIssueIdDelete,
  deleteIssueLinkIssuesIssueIdLinksLinkIdDelete,
  getIssueIssuesIssueIdGet,
  listIssueLinksIssuesIssueIdLinksGet,
  listIssuesTeamsTeamIdIssuesGet,
  updateIssueIssuesIssueIdPatch,
} from '@/api/generated/endpoints/issues/issues';
import { listCodeLinksIssuesIssueIdCodeLinksGet } from '@/api/generated/endpoints/integrations/integrations';
import {
  getWatchStateIssuesIssueIdWatchGet,
  setWatchStateIssuesIssueIdWatchPut,
} from '@/api/generated/endpoints/notifications/notifications';
import { listStatusesTeamsTeamIdStatusesGet } from '@/api/generated/endpoints/statuses/statuses';
import type { StatusRead, TeamRead } from '@/api/generated/models';
import { setInstanceUrl } from '@/api/instance';
import { persistToken } from '@/auth/session';
import { seededTeam } from '@/api/__tests__/support/team';

/**
 * The issue detail sections against a real instance: sub-issues, links and
 * their derived inverses, watch, and code links.
 */
const LIVE_URL = process.env.SOFTTRACK_LIVE_URL;
const describeLive = LIVE_URL ? describe : describe.skip;

const RUN = Date.now().toString(36).slice(-5);

describeLive('issue detail against a live instance', () => {
  let team: TeamRead;
  let statuses: StatusRead[];
  const created: number[] = [];

  async function newIssue(title: string, parentId?: number) {
    const issue = await createIssueTeamsTeamIdIssuesPost(team.id, {
      title,
      parent_id: parentId,
    });
    created.push(issue.id);
    return issue;
  }

  beforeAll(async () => {
    await setInstanceUrl(LIVE_URL!);
    const token = await loginAuthLoginPost({
      username: process.env.SOFTTRACK_LIVE_EMAIL ?? 'demo@softtrack.dev',
      password: process.env.SOFTTRACK_LIVE_PASSWORD ?? 'password123',
    });
    await persistToken(token.access_token);
    team = await seededTeam();
    statuses = await listStatusesTeamsTeamIdStatusesGet(team.id);
  });

  afterAll(async () => {
    // Children first: deleting a parent with children may be refused.
    for (const id of [...created].reverse()) {
      await deleteIssueIssuesIssueIdDelete(id).catch(() => undefined);
    }
  });

  it('lists children by parent and counts progress server-side', async () => {
    const parent = await newIssue(`Parent ${RUN}`);
    const childA = await newIssue(`Child A ${RUN}`, parent.id);
    await newIssue(`Child B ${RUN}`, parent.id);

    // This is the query the sub-issues section runs.
    const children = await listIssuesTeamsTeamIdIssuesGet(team.id, {
      parent_id: parent.id,
      limit: 200,
    });
    expect(children.items.map((i) => i.id).sort()).toEqual(
      [childA.id, created[created.length - 1]].sort(),
    );

    let refreshed = await getIssueIssuesIssueIdGet(parent.id);
    expect(refreshed.child_count).toBe(2);
    expect(refreshed.completed_child_count).toBe(0);

    const done = statuses.find((s) => s.category === 'done');
    if (done) {
      await updateIssueIssuesIssueIdPatch(childA.id, { status_id: done.id });
      refreshed = await getIssueIssuesIssueIdGet(parent.id);
      // Counted by the server, which is why the section reads these fields
      // rather than tallying the child list itself.
      expect(refreshed.completed_child_count).toBe(1);
    }

    const cancelled = statuses.find((s) => s.category === 'cancelled');
    if (cancelled) {
      await updateIssueIssuesIssueIdPatch(childA.id, { status_id: cancelled.id });
      refreshed = await getIssueIssuesIssueIdGet(parent.id);
      // A cancelled child leaves the denominator, rather than counting as
      // outstanding work forever.
      expect(refreshed.child_count).toBe(1);
    }
  });

  it('derives the inverse of a link on the other issue', async () => {
    const blocker = await newIssue(`Blocker ${RUN}`);
    const blocked = await newIssue(`Blocked ${RUN}`);

    await createIssueLinkIssuesIssueIdLinksPost(blocker.id, {
      target_id: blocked.id,
      type: 'blocks',
    });

    const fromBlocker = await listIssueLinksIssuesIssueIdLinksGet(blocker.id);
    expect((fromBlocker.blocks ?? []).map((l) => l.issue.id)).toContain(blocked.id);

    // The inverse is not stored by the client -- it comes back on the other
    // side, which is why only three types are offered when adding one.
    const fromBlocked = await listIssueLinksIssuesIssueIdLinksGet(blocked.id);
    expect((fromBlocked.blocked_by ?? []).map((l) => l.issue.id)).toContain(blocker.id);

    // And it is what drives the card's blocked marker.
    const refreshed = await getIssueIssuesIssueIdGet(blocked.id);
    expect(refreshed.blocked_by_count).toBe(1);
  });

  it('removes a link from both sides', async () => {
    const a = await newIssue(`Relates A ${RUN}`);
    const b = await newIssue(`Relates B ${RUN}`);

    await createIssueLinkIssuesIssueIdLinksPost(a.id, {
      target_id: b.id,
      type: 'relates_to',
    });
    const links = await listIssueLinksIssuesIssueIdLinksGet(a.id);
    const link = (links.relates_to ?? [])[0];
    expect(link).toBeDefined();

    await deleteIssueLinkIssuesIssueIdLinksLinkIdDelete(a.id, link.id);

    expect((await listIssueLinksIssuesIssueIdLinksGet(a.id)).relates_to ?? []).toEqual([]);
    expect((await listIssueLinksIssuesIssueIdLinksGet(b.id)).relates_to ?? []).toEqual([]);
  });

  it('toggles watch and reports the current state', async () => {
    const issue = await newIssue(`Watch ${RUN}`);

    const before = await getWatchStateIssuesIssueIdWatchGet(issue.id);
    expect(typeof before.watching).toBe('boolean');

    await setWatchStateIssuesIssueIdWatchPut(issue.id, { watching: !before.watching });
    const after = await getWatchStateIssuesIssueIdWatchGet(issue.id);
    expect(after.watching).toBe(!before.watching);
  });

  it('returns the development buckets the section renders', async () => {
    const issue = await newIssue(`Code ${RUN}`);
    const codeLinks = await listCodeLinksIssuesIssueIdCodeLinksGet(issue.id);

    // Nothing is connected in the demo stack, so these are empty -- the point
    // is the shape the section groups by.
    for (const key of ['branches', 'commits', 'pull_requests'] as const) {
      expect(Array.isArray(codeLinks[key] ?? [])).toBe(true);
    }
  });
});
