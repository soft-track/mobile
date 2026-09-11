/**
 * @jest-environment node
 */
import { loginAuthLoginPost } from '@/api/generated/endpoints/auth/auth';
import {
  completeCycleCyclesCycleIdCompletePost,
  createCycleTeamsTeamIdCyclesPost,
  deleteCycleCyclesCycleIdDelete,
  getCycleCyclesCycleIdGet,
  listCyclesTeamsTeamIdCyclesGet,
  startCycleCyclesCycleIdStartPost,
} from '@/api/generated/endpoints/cycles/cycles';
import {
  createIssueTeamsTeamIdIssuesPost,
  deleteIssueIssuesIssueIdDelete,
  getIssueIssuesIssueIdGet,
  listIssuesTeamsTeamIdIssuesGet,
} from '@/api/generated/endpoints/issues/issues';
import { listStatusesTeamsTeamIdStatusesGet } from '@/api/generated/endpoints/statuses/statuses';
import type { TeamRead } from '@/api/generated/models';
import { setInstanceUrl } from '@/api/instance';
import { persistToken } from '@/auth/session';
import { seededTeam } from '@/api/__tests__/support/team';

/**
 * Cycles against a real instance.
 *
 * The acceptance criterion for #12 is that a cycle can be run start to finish
 * from mobile, so this does exactly that: create, start, complete, and check
 * where the unfinished work went.
 */
const LIVE_URL = process.env.SOFTTRACK_LIVE_URL;
const describeLive = LIVE_URL ? describe : describe.skip;

const RUN = Date.now().toString(36).slice(-5);

/** Fixed dates: a test that depends on today is a test that breaks on a Monday. */
const FROM = '2031-01-06';
const TO = '2031-01-20';
const NEXT_FROM = '2031-01-21';
const NEXT_TO = '2031-02-03';

describeLive('cycles against a live instance', () => {
  let team: TeamRead;
  const cycles: number[] = [];
  const issues: number[] = [];

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
    for (const id of issues) await deleteIssueIssuesIssueIdDelete(id).catch(() => undefined);
    for (const id of cycles) await deleteCycleCyclesCycleIdDelete(id).catch(() => undefined);
  });

  it('numbers a cycle when it is given no name', async () => {
    const cycle = await createCycleTeamsTeamIdCyclesPost(team.id, {
      starts_at: FROM,
      ends_at: TO,
    });
    cycles.push(cycle.id);

    expect(cycle.name ?? null).toBeNull();
    // display_name is always present, which is why every label reads that.
    expect(cycle.display_name).toContain(String(cycle.number));
    expect(cycle.state).toBe('upcoming');
  });

  it('reports progress including work that was never sized', async () => {
    const cycle = await createCycleTeamsTeamIdCyclesPost(team.id, {
      name: `Progress ${RUN}`,
      starts_at: FROM,
      ends_at: TO,
    });
    cycles.push(cycle.id);

    const sized = await createIssueTeamsTeamIdIssuesPost(team.id, {
      title: `Sized ${RUN}`,
      cycle_id: cycle.id,
      estimate: 3,
    });
    const unsized = await createIssueTeamsTeamIdIssuesPost(team.id, {
      title: `Unsized ${RUN}`,
      cycle_id: cycle.id,
    });
    issues.push(sized.id, unsized.id);

    const refreshed = await getCycleCyclesCycleIdGet(cycle.id);
    expect(refreshed.progress.issues_total).toBe(2);
    expect(refreshed.progress.points_total).toBe(3);
    // The count that stops a points total reading as the whole story.
    expect(refreshed.progress.issues_unestimated).toBe(1);
  });

  it('runs a cycle start to finish and says where unfinished work went', async () => {
    const statuses = await listStatusesTeamsTeamIdStatusesGet(team.id);
    const done = statuses.find((s) => s.category === 'done');

    const current = await createCycleTeamsTeamIdCyclesPost(team.id, {
      name: `Run ${RUN}`,
      starts_at: FROM,
      ends_at: TO,
    });
    const next = await createCycleTeamsTeamIdCyclesPost(team.id, {
      name: `Next ${RUN}`,
      starts_at: NEXT_FROM,
      ends_at: NEXT_TO,
    });
    cycles.push(current.id, next.id);

    const finished = await createIssueTeamsTeamIdIssuesPost(team.id, {
      title: `Finished ${RUN}`,
      cycle_id: current.id,
      status_id: done?.id,
    });
    const unfinished = await createIssueTeamsTeamIdIssuesPost(team.id, {
      title: `Unfinished ${RUN}`,
      cycle_id: current.id,
    });
    issues.push(finished.id, unfinished.id);

    const started = await startCycleCyclesCycleIdStartPost(current.id);
    expect(started.state).toBe('active');

    const completion = await completeCycleCyclesCycleIdCompletePost(current.id);
    expect(completion.cycle.state).toBe('completed');
    // One issue was not done, and the app reports this count because
    // "completed" otherwise reads as though it had been finished.
    expect(completion.carried_over).toBe(1);

    const moved = await getIssueIssuesIssueIdGet(unfinished.id);
    if (completion.carried_into_cycle_id) {
      expect(moved.cycle_id).toBe(completion.carried_into_cycle_id);
    } else {
      expect(moved.cycle_id ?? null).toBeNull();
    }

    // The finished one stays where it was.
    expect((await getIssueIssuesIssueIdGet(finished.id)).cycle_id).toBe(current.id);
  });

  it('filters the board by cycle, which is the link between the two', async () => {
    const cycle = await createCycleTeamsTeamIdCyclesPost(team.id, {
      name: `Filter ${RUN}`,
      starts_at: FROM,
      ends_at: TO,
    });
    cycles.push(cycle.id);
    const issue = await createIssueTeamsTeamIdIssuesPost(team.id, {
      title: `In cycle ${RUN}`,
      cycle_id: cycle.id,
    });
    issues.push(issue.id);

    const page = await listIssuesTeamsTeamIdIssuesGet(team.id, {
      cycle_id: cycle.id,
      limit: 200,
    });
    expect(page.items.map((i) => i.id)).toEqual([issue.id]);
  });

  it('lists cycles for the team', async () => {
    const listed = await listCyclesTeamsTeamIdCyclesGet(team.id);
    for (const id of cycles) expect(listed.map((c) => c.id)).toContain(id);
  });
});
