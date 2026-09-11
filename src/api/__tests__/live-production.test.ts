/**
 * @jest-environment node
 */
import { loginAuthLoginPost, meAuthMeGet } from '@/api/generated/endpoints/auth/auth';
import { createCommentIssuesIssueIdCommentsPost, listCommentsIssuesIssueIdCommentsGet } from '@/api/generated/endpoints/comments/comments';
import {
  createIssueTeamsTeamIdIssuesPost,
  deleteIssueIssuesIssueIdDelete,
  getEstimateSummaryTeamsTeamIdEstimatesGet,
  getIssueIssuesIssueIdGet,
  listIssuesTeamsTeamIdIssuesGet,
  updateIssueIssuesIssueIdPatch,
} from '@/api/generated/endpoints/issues/issues';
import { getNotificationSettingsNotificationsSettingsGet, unreadCountNotificationsUnreadCountGet } from '@/api/generated/endpoints/notifications/notifications';
import { teamCumulativeFlowTeamsTeamIdCumulativeFlowGet, teamVelocityTeamsTeamIdVelocityGet } from '@/api/generated/endpoints/reports/reports';
import { searchSearchGet } from '@/api/generated/endpoints/search/search';
import { listStatusesTeamsTeamIdStatusesGet } from '@/api/generated/endpoints/statuses/statuses';
import { listMyTeamsTeamsGet } from '@/api/generated/endpoints/teams/teams';
import { listViewsTeamsTeamIdViewsGet } from '@/api/generated/endpoints/views/views';
import type { TeamRead } from '@/api/generated/models';
import { normalizeInstanceUrl, probeInstance, setInstanceUrl } from '@/api/instance';
import { resolveColor } from '@/ui/color';
import { light } from '@/ui/tokens';
import { persistToken } from '@/auth/session';
import { toQueryParams, NO_FILTERS } from '@/board/filters';
import { toggleTaskAtIndex } from '@/markdown/tasks';

/**
 * The app's own client modules against the production instance.
 *
 * Runs the real mutator, instance store, session and generated client -- the
 * same code the screens call -- so what is verified here is the client, not a
 * hand-written request.
 *
 *   SOFTTRACK_PROD_URL=https://softback.quantadev.io \
 *   SOFTTRACK_PROD_EMAIL=... SOFTTRACK_PROD_PASSWORD=... npm test
 *
 * Deliberately constrained, because this is somebody's real instance:
 * everything is read-only except one issue that is created and then deleted in
 * the same run. It never registers an account, never creates a team (the API
 * has no way to delete one), never changes a password and never signs anyone
 * out. Those paths are covered against the local stack instead.
 */
const URL_ = process.env.SOFTTRACK_PROD_URL;
const EMAIL = process.env.SOFTTRACK_PROD_EMAIL;
const PASSWORD = process.env.SOFTTRACK_PROD_PASSWORD;
const ready = Boolean(URL_ && EMAIL && PASSWORD);
const describeProd = ready ? describe : describe.skip;

describeProd('production instance', () => {
  let teams: TeamRead[];
  let scratchTeam: TeamRead;
  const created: number[] = [];

  beforeAll(async () => {
    const base = normalizeInstanceUrl(URL_!);
    expect(base).not.toBeNull();
    await setInstanceUrl(base!);

    const token = await loginAuthLoginPost({ username: EMAIL!, password: PASSWORD! });
    await persistToken(token.access_token);
    teams = await listMyTeamsTeamsGet();
    // Prefer a team that is empty, so a scratch issue is least intrusive.
    scratchTeam = teams.find((t) => t.key === 'MB') ?? teams[0];
  });

  afterAll(async () => {
    for (const id of created) {
      await deleteIssueIssuesIssueIdDelete(id).catch(() => undefined);
    }
  });

  it('probes as a SoftTrack instance over TLS', async () => {
    const result = await probeInstance(normalizeInstanceUrl(URL_!)!);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // The login screen reads these to decide what to offer.
      expect(typeof result.config.open_registration).toBe('boolean');
      expect(result.config.demo_credentials).toBe(false);
    }
  });

  it('signs in and identifies the account', async () => {
    const me = await meAuthMeGet();
    expect(me.email).toBe(EMAIL);
    expect(me.is_active).toBe(true);
    expect(me.avatar_color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('lists teams with the keys the board routes on', async () => {
    expect(teams.length).toBeGreaterThan(0);
    for (const team of teams) {
      // Uppercase keys are what keep /ENG from colliding with /board.
      expect(team.key).toBe(team.key.toUpperCase());
      expect(team.key.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('draws columns from each team’s own statuses', async () => {
    for (const team of teams) {
      const statuses = await listStatusesTeamsTeamIdStatusesGet(team.id);
      expect(statuses.length).toBeGreaterThan(0);
      for (const status of statuses) {
        // Not asserted to be hex: a user-created status on this instance is
        // stored as `var(--color-status-progress)`, which a browser resolves
        // and React Native does not. What matters is that it resolves to
        // something paintable rather than to an invisible dot.
        const painted = resolveColor(status.color, light);
        expect(painted).toMatch(/^(#[0-9a-f]{3,8}|rgba?\(|[a-z]+$)/i);
        expect(['backlog', 'unstarted', 'started', 'done', 'cancelled']).toContain(
          status.category,
        );
      }
      // Rendered in this order, left to right.
      const positions = statuses.map((s) => s.position);
      expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    }
  });

  it('returns board data and a matching point rollup', async () => {
    for (const team of teams) {
      const page = await listIssuesTeamsTeamIdIssuesGet(team.id, { limit: 200 });
      const statusIds = new Set(
        (await listStatusesTeamsTeamIdStatusesGet(team.id)).map((s) => s.id),
      );
      for (const issue of page.items) {
        expect(issue.identifier).toContain(team.key);
        expect(statusIds.has(issue.status.id)).toBe(true);
        expect(typeof issue.blocked_by_count).toBe('number');
      }

      const estimates = await getEstimateSummaryTeamsTeamIdEstimatesGet(team.id);
      for (const key of Object.keys(estimates.by_status)) {
        expect(Number.isInteger(Number(key))).toBe(true);
      }
    }
  });

  it('narrows server-side with the filters the board sends', async () => {
    const team = teams[0];
    const params = toQueryParams({ ...NO_FILTERS, assignee: 'unassigned' });
    const page = await listIssuesTeamsTeamIdIssuesGet(team.id, { ...params, limit: 200 });
    for (const issue of page.items) expect(issue.assignee ?? null).toBeNull();
  });

  it('answers search, reports, views and notification settings', async () => {
    const team = teams[0];

    const hits = await searchSearchGet({ q: 'the', limit: 5 });
    expect(Array.isArray(hits.items)).toBe(true);

    const velocity = await teamVelocityTeamsTeamIdVelocityGet(team.id);
    expect(Array.isArray(velocity.cycles)).toBe(true);
    const flow = await teamCumulativeFlowTeamsTeamIdCumulativeFlowGet(team.id);
    expect(Array.isArray(flow.days)).toBe(true);

    const views = await listViewsTeamsTeamIdViewsGet(team.id);
    expect(Array.isArray(views.items)).toBe(true);

    const settings = await getNotificationSettingsNotificationsSettingsGet();
    expect(typeof settings.email_delivery_configured).toBe('boolean');
    const unread = await unreadCountNotificationsUnreadCountGet();
    expect(typeof unread.unread).toBe('number');
  });

  it('creates, edits, comments on and deletes one scratch issue', async () => {
    const statuses = await listStatusesTeamsTeamIdStatusesGet(scratchTeam.id);
    const stamp = Date.now().toString(36).slice(-5);

    const issue = await createIssueTeamsTeamIdIssuesPost(scratchTeam.id, {
      title: `Mobile client smoke test ${stamp}`,
      description: '- [ ] verify round trip',
      priority: 'low',
      estimate: 2,
    });
    created.push(issue.id);

    // Indistinguishable from a web-created issue.
    expect(issue.identifier).toBe(`${scratchTeam.key}-${issue.number}`);
    expect(issue.priority).toBe('low');
    expect(issue.estimate).toBe(2);

    // A move, the board's core mutation.
    const target = statuses.find((s) => s.id !== issue.status.id)!;
    const moved = await updateIssueIssuesIssueIdPatch(issue.id, { status_id: target.id });
    expect(moved.status.id).toBe(target.id);

    // Markdown survives byte for byte, including a ticked checkbox written
    // back as a one-character edit.
    const ticked = toggleTaskAtIndex(issue.description ?? '', 0)!;
    const updated = await updateIssueIssuesIssueIdPatch(issue.id, { description: ticked });
    expect(updated.description).toBe('- [x] verify round trip');

    const body = '## Smoke\n\n`code` and **bold**.';
    const comment = await createCommentIssuesIssueIdCommentsPost(issue.id, { body });
    expect(comment.body).toBe(body);
    const comments = await listCommentsIssuesIssueIdCommentsGet(issue.id, { limit: 10 });
    expect(comments.items.map((c) => c.body)).toContain(body);

    // And cleans up after itself.
    await deleteIssueIssuesIssueIdDelete(issue.id);
    created.pop();
    await expect(getIssueIssuesIssueIdGet(issue.id)).rejects.toMatchObject({
      response: { status: 404 },
    });
  });

  it('leaves the instance as it was found', async () => {
    // Nothing from this run should remain in any team.
    for (const team of teams) {
      const page = await listIssuesTeamsTeamIdIssuesGet(team.id, { limit: 200 });
      const residue = page.items.filter((i) => i.title.includes('Mobile client smoke test'));
      expect(residue).toEqual([]);
    }
  });
});
