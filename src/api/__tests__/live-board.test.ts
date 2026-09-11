/**
 * @jest-environment node
 */
import { loginAuthLoginPost } from '@/api/generated/endpoints/auth/auth';
import {
  getEstimateSummaryTeamsTeamIdEstimatesGet,
  listIssuesTeamsTeamIdIssuesGet,
  updateIssueIssuesIssueIdPatch,
} from '@/api/generated/endpoints/issues/issues';
import { listStatusesTeamsTeamIdStatusesGet } from '@/api/generated/endpoints/statuses/statuses';
import { listMyTeamsTeamsGet } from '@/api/generated/endpoints/teams/teams';
import type { StatusRead, TeamRead } from '@/api/generated/models';
import { toQueryParams } from '@/board/filters';
import { setInstanceUrl } from '@/api/instance';
import { persistToken } from '@/auth/session';

/**
 * The board's data path against a real instance: that the six filters narrow
 * server-side, and that moving a card actually moves it.
 *
 *   cd ../soft-track && docker compose up -d
 *   SOFTTRACK_LIVE_URL=http://localhost:8000 npm test
 */
const LIVE_URL = process.env.SOFTTRACK_LIVE_URL;
const describeLive = LIVE_URL ? describe : describe.skip;

describeLive('the board against a live instance', () => {
  let team: TeamRead;
  let statuses: StatusRead[];

  beforeAll(async () => {
    await setInstanceUrl(LIVE_URL!);
    const token = await loginAuthLoginPost({
      username: process.env.SOFTTRACK_LIVE_EMAIL ?? 'demo@softtrack.dev',
      password: process.env.SOFTTRACK_LIVE_PASSWORD ?? 'password123',
    });
    await persistToken(token.access_token);

    team = (await listMyTeamsTeamsGet())[0];
    statuses = await listStatusesTeamsTeamIdStatusesGet(team.id);
  });

  it('gets the team its own columns, not a fixed list', () => {
    expect(statuses.length).toBeGreaterThan(0);
    for (const status of statuses) {
      expect(status.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(['backlog', 'unstarted', 'started', 'done', 'cancelled']).toContain(
        status.category,
      );
    }
    // Rendered left to right in this order.
    const positions = statuses.map((s) => s.position);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('returns a page whose items carry what a card renders', async () => {
    const page = await listIssuesTeamsTeamIdIssuesGet(team.id, { limit: 200 });
    expect(page.items.length).toBeGreaterThan(0);

    for (const issue of page.items) {
      expect(issue.identifier).toContain(team.key);
      expect(issue.status).toHaveProperty('id');
      // The blocked marker is read straight off the issue rather than fetched
      // per card.
      expect(typeof issue.blocked_by_count).toBe('number');
      expect(typeof issue.child_count).toBe('number');
    }

    // Every issue belongs to a column the board actually draws.
    const statusIds = new Set(statuses.map((s) => s.id));
    for (const issue of page.items) expect(statusIds.has(issue.status.id)).toBe(true);
  });

  it('keys the point rollup by status id, as the column headers read it', async () => {
    const estimates = await getEstimateSummaryTeamsTeamIdEstimatesGet(team.id);
    for (const [key, load] of Object.entries(estimates.by_status)) {
      // String keys: `by_status[String(status.id)]` is not incidental.
      expect(Number.isInteger(Number(key))).toBe(true);
      expect(typeof load.points).toBe('number');
      expect(typeof load.unestimated_count).toBe('number');
    }
  });

  it('narrows by status on the server', async () => {
    const status = statuses[0];
    const page = await listIssuesTeamsTeamIdIssuesGet(team.id, {
      ...toQueryParams({
        statusId: status.id,
        priority: null,
        assignee: null,
        labelId: null,
        projectId: null,
        cycleId: null,
      }),
      limit: 200,
    });
    for (const issue of page.items) expect(issue.status.id).toBe(status.id);
  });

  it('narrows by priority on the server', async () => {
    const all = await listIssuesTeamsTeamIdIssuesGet(team.id, { limit: 200 });
    const priority = all.items.find((i) => i.priority !== 'no_priority')?.priority;
    if (!priority) return; // Nothing prioritised in this dataset.

    const page = await listIssuesTeamsTeamIdIssuesGet(team.id, {
      priority,
      limit: 200,
    });
    expect(page.items.length).toBeGreaterThan(0);
    for (const issue of page.items) expect(issue.priority).toBe(priority);
  });

  it('treats unassigned as its own answer', async () => {
    // The flag overrides assignee_id server-side, which is why the client maps
    // "unassigned" onto it rather than onto a sentinel id.
    const page = await listIssuesTeamsTeamIdIssuesGet(team.id, {
      unassigned: true,
      limit: 200,
    });
    for (const issue of page.items) expect(issue.assignee ?? null).toBeNull();
  });

  it('moves a card between columns and keeps it there', async () => {
    const page = await listIssuesTeamsTeamIdIssuesGet(team.id, { limit: 200 });
    const issue = page.items[0];
    const target = statuses.find((s) => s.id !== issue.status.id)!;
    const original = issue.status.id;

    const moved = await updateIssueIssuesIssueIdPatch(issue.id, { status_id: target.id });
    expect(moved.status.id).toBe(target.id);

    // The board re-reads the list after a move, so that is what has to agree.
    const after = await listIssuesTeamsTeamIdIssuesGet(team.id, { limit: 200 });
    expect(after.items.find((i) => i.id === issue.id)?.status.id).toBe(target.id);

    // And the filtered view has to agree too -- the acceptance criterion is
    // that board and list stay consistent with the filters.
    const inTarget = await listIssuesTeamsTeamIdIssuesGet(team.id, {
      status_id: target.id,
      limit: 200,
    });
    expect(inTarget.items.map((i) => i.id)).toContain(issue.id);

    await updateIssueIssuesIssueIdPatch(issue.id, { status_id: original });
  });
});
