/**
 * @jest-environment node
 */
import { loginAuthLoginPost } from '@/api/generated/endpoints/auth/auth';
import {
  createIssueTeamsTeamIdIssuesPost,
  deleteIssueIssuesIssueIdDelete,
  getIssueIssuesIssueIdGet,
  listIssuesTeamsTeamIdIssuesGet,
  updateIssueIssuesIssueIdPatch,
} from '@/api/generated/endpoints/issues/issues';
import { createLabelTeamsTeamIdLabelsPost } from '@/api/generated/endpoints/labels/labels';
import { createProjectTeamsTeamIdProjectsPost } from '@/api/generated/endpoints/projects/projects';
import { listStatusesTeamsTeamIdStatusesGet } from '@/api/generated/endpoints/statuses/statuses';
import type { StatusRead, TeamRead } from '@/api/generated/models';
import { setInstanceUrl } from '@/api/instance';
import { persistToken } from '@/auth/session';
import { ESTIMATE_SCALE } from '@/issues/use-issue-properties';
import { seededTeam } from '@/api/__tests__/support/team';

/**
 * Creating and editing issues against a real instance.
 *
 * The acceptance criterion for #6 is that an issue created on mobile is
 * indistinguishable from a web-created one, so these assert the identifier
 * shape and that every property round-trips -- including the two that mean
 * something by being absent.
 *
 *   SOFTTRACK_LIVE_URL=http://localhost:8000 npm test
 */
const LIVE_URL = process.env.SOFTTRACK_LIVE_URL;
const describeLive = LIVE_URL ? describe : describe.skip;

const RUN = Date.now().toString(36).slice(-5);

describeLive('issues against a live instance', () => {
  let team: TeamRead;
  let statuses: StatusRead[];
  const created: number[] = [];

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
    // These are real rows; do not leave them behind.
    for (const id of created) {
      await deleteIssueIssuesIssueIdDelete(id).catch(() => undefined);
    }
  });

  it('creates an issue that looks exactly like a web-created one', async () => {
    const issue = await createIssueTeamsTeamIdIssuesPost(team.id, {
      title: `Mobile create ${RUN}`,
    });
    created.push(issue.id);

    // TEAMKEY-n, allocated by the server -- the client never invents one.
    expect(issue.identifier).toBe(`${team.key}-${issue.number}`);
    expect(issue.team_id).toBe(team.id);
    expect(issue.creator).toHaveProperty('id');
    // The defaults a title-only issue gets.
    expect(issue.priority).toBe('no_priority');
    expect(issue.estimate ?? null).toBeNull();
    expect(issue.assignee ?? null).toBeNull();
    // A status is assigned even though none was asked for.
    expect(statuses.map((s) => s.id)).toContain(issue.status.id);
  });

  it('round-trips every property the form offers', async () => {
    const label = await createLabelTeamsTeamIdLabelsPost(team.id, {
      name: `mob-${RUN}`,
    });
    const project = await createProjectTeamsTeamIdProjectsPost(team.id, {
      name: `Mobile ${RUN}`,
    });
    const status = statuses[1] ?? statuses[0];

    const issue = await createIssueTeamsTeamIdIssuesPost(team.id, {
      title: `Mobile full ${RUN}`,
      description: '## Heading\n\n- [ ] a task',
      status_id: status.id,
      priority: 'high',
      estimate: ESTIMATE_SCALE[3],
      label_ids: [label.id],
      project_id: project.id,
    });
    created.push(issue.id);

    expect(issue.title).toBe(`Mobile full ${RUN}`);
    expect(issue.description).toContain('## Heading');
    expect(issue.status.id).toBe(status.id);
    expect(issue.priority).toBe('high');
    expect(issue.estimate).toBe(ESTIMATE_SCALE[3]);
    expect(issue.project_id).toBe(project.id);
    expect((issue.labels ?? []).map((l) => l.id)).toEqual([label.id]);

    // And it reads back the same, which is what the detail screen renders.
    const fetched = await getIssueIssuesIssueIdGet(issue.id);
    expect(fetched.identifier).toBe(issue.identifier);
    expect(fetched.estimate).toBe(ESTIMATE_SCALE[3]);
  });

  it('accepts the estimate scale the picker offers, and nothing else', async () => {
    const issue = await createIssueTeamsTeamIdIssuesPost(team.id, {
      title: `Mobile estimate ${RUN}`,
    });
    created.push(issue.id);

    for (const points of ESTIMATE_SCALE) {
      const updated = await updateIssueIssuesIssueIdPatch(issue.id, { estimate: points });
      expect(updated.estimate).toBe(points);
    }

    // Off-scale values are refused, which is why the picker is a fixed list.
    await expect(
      updateIssueIssuesIssueIdPatch(issue.id, { estimate: 4 as never }),
    ).rejects.toMatchObject({ response: { status: 422 } });
  });

  it('clears a property back to nothing', async () => {
    // "Not sized" and "unassigned" are states, not the absence of an edit --
    // the pickers offer them as rows and null is what expresses them.
    const issue = await createIssueTeamsTeamIdIssuesPost(team.id, {
      title: `Mobile clear ${RUN}`,
      estimate: 5,
    });
    created.push(issue.id);
    expect(issue.estimate).toBe(5);

    const cleared = await updateIssueIssuesIssueIdPatch(issue.id, { estimate: null });
    expect(cleared.estimate ?? null).toBeNull();
  });

  it('deletes an issue and stops listing it', async () => {
    const issue = await createIssueTeamsTeamIdIssuesPost(team.id, {
      title: `Mobile delete ${RUN}`,
    });

    await deleteIssueIssuesIssueIdDelete(issue.id);

    await expect(getIssueIssuesIssueIdGet(issue.id)).rejects.toMatchObject({
      response: { status: 404 },
    });
    const page = await listIssuesTeamsTeamIdIssuesGet(team.id, { limit: 200 });
    expect(page.items.map((i) => i.id)).not.toContain(issue.id);
  });
});
