/**
 * @jest-environment node
 */
import { loginAuthLoginPost } from '@/api/generated/endpoints/auth/auth';
import { listCyclesTeamsTeamIdCyclesGet } from '@/api/generated/endpoints/cycles/cycles';
import {
  cycleBurndownCyclesCycleIdBurndownGet,
  teamCreatedVsResolvedTeamsTeamIdCreatedVsResolvedGet,
  teamCumulativeFlowTeamsTeamIdCumulativeFlowGet,
  teamVelocityTeamsTeamIdVelocityGet,
} from '@/api/generated/endpoints/reports/reports';
import { listMyTeamsTeamsGet } from '@/api/generated/endpoints/teams/teams';
import type { TeamRead } from '@/api/generated/models';
import { setInstanceUrl } from '@/api/instance';
import { persistToken } from '@/auth/session';
import { makeScale } from '@/reports/chart';

/**
 * The four reports against a real instance.
 *
 * The acceptance criterion for #13 is that the numbers match web exactly, which
 * they do by construction -- every figure is read from these endpoints and none
 * is recomputed on the client. What is worth checking is that the shapes the
 * charts index into are what arrives, and that a chart can be scaled from them
 * without dividing by zero on an empty instance.
 */
const LIVE_URL = process.env.SOFTTRACK_LIVE_URL;
const describeLive = LIVE_URL ? describe : describe.skip;

describeLive('reports against a live instance', () => {
  let team: TeamRead;

  beforeAll(async () => {
    await setInstanceUrl(LIVE_URL!);
    const token = await loginAuthLoginPost({
      username: process.env.SOFTTRACK_LIVE_EMAIL ?? 'demo@softtrack.dev',
      password: process.env.SOFTTRACK_LIVE_PASSWORD ?? 'password123',
    });
    await persistToken(token.access_token);
    team = (await listMyTeamsTeamsGet())[0];
  });

  it('returns a burndown with an ideal line to draw against', async () => {
    const cycles = await listCyclesTeamsTeamIdCyclesGet(team.id);
    if (cycles.length === 0) return;

    const burndown = await cycleBurndownCyclesCycleIdBurndownGet(cycles[0].id);
    expect(burndown.cycle_id).toBe(cycles[0].id);

    for (const point of burndown.points) {
      expect(point.day).toMatch(/^\d{4}-\d{2}-\d{2}/);
      expect(typeof point.points_remaining).toBe('number');
      // Both lines come from the server; the client draws, it does not model.
      expect(typeof point.ideal_remaining).toBe('number');
      expect(point.points_remaining).toBeLessThanOrEqual(point.points_total);
    }
  });

  it('returns velocity as committed against delivered', async () => {
    const velocity = await teamVelocityTeamsTeamIdVelocityGet(team.id);
    expect(Array.isArray(velocity.cycles)).toBe(true);
    for (const cycle of velocity.cycles) {
      expect(typeof cycle.points_committed).toBe('number');
      expect(typeof cycle.points_completed).toBe('number');
      expect(cycle.cycle_name).toEqual(expect.any(String));
    }
  });

  it('returns cumulative flow keyed by the categories the chart stacks', async () => {
    const flow = await teamCumulativeFlowTeamsTeamIdCumulativeFlowGet(team.id);
    const known = ['backlog', 'unstarted', 'started', 'done', 'cancelled'];

    for (const day of flow.days) {
      expect(day.day).toMatch(/^\d{4}-\d{2}-\d{2}/);
      // Unknown keys would silently vanish from a stacked area, so the chart's
      // fixed order has to cover everything that can arrive.
      for (const key of Object.keys(day.counts)) expect(known).toContain(key);
    }
  });

  it('returns created against resolved with a running open count', async () => {
    const report = await teamCreatedVsResolvedTeamsTeamIdCreatedVsResolvedGet(team.id);
    expect(typeof report.total_created).toBe('number');
    expect(typeof report.total_resolved).toBe('number');

    for (const day of report.days) {
      expect(typeof day.created).toBe('number');
      expect(typeof day.resolved).toBe('number');
      expect(typeof day.open_at_end_of_day).toBe('number');
    }
  });

  it('scales whatever the instance actually returns', async () => {
    // An instance with no history is the common case for a fresh install, and
    // the charts have to draw an axis rather than divide by zero.
    const flow = await teamCumulativeFlowTeamsTeamIdCumulativeFlowGet(team.id);
    const totals = flow.days.map((day) =>
      Object.values(day.counts).reduce((sum, n) => sum + (n ?? 0), 0),
    );
    const scale = makeScale(300, flow.days.length, Math.max(...totals, 1));
    expect(Number.isFinite(scale.y(0))).toBe(true);
    expect(Number.isFinite(scale.x(0))).toBe(true);
  });
});
