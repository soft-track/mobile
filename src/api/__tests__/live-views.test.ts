/**
 * @jest-environment node
 */
import { loginAuthLoginPost } from '@/api/generated/endpoints/auth/auth';
import { listMyTeamsTeamsGet } from '@/api/generated/endpoints/teams/teams';
import {
  createViewTeamsTeamIdViewsPost,
  deleteViewViewsViewIdDelete,
  listViewsTeamsTeamIdViewsGet,
  setMyDefaultViewTeamsTeamIdDefaultViewMePut,
  setTeamDefaultViewTeamsTeamIdDefaultViewPut,
  updateViewViewsViewIdPatch,
} from '@/api/generated/endpoints/views/views';
import type { TeamRead } from '@/api/generated/models';
import { setInstanceUrl } from '@/api/instance';
import { persistToken } from '@/auth/session';
import { NO_FILTERS, sameFilters } from '@/board/filters';
import { fromViewFilters, toViewFilters } from '@/views/saved-views';

/**
 * Saved views against a real instance.
 *
 * The acceptance criterion for #14 is that views created on mobile appear on web
 * with identical filters and that defaults resolve the same way -- so these
 * assert the stored shape and the server's own default resolution.
 */
const LIVE_URL = process.env.SOFTTRACK_LIVE_URL;
const describeLive = LIVE_URL ? describe : describe.skip;

const RUN = Date.now().toString(36).slice(-5);

describeLive('saved views against a live instance', () => {
  let team: TeamRead;
  const created: number[] = [];

  beforeAll(async () => {
    await setInstanceUrl(LIVE_URL!);
    const token = await loginAuthLoginPost({
      username: process.env.SOFTTRACK_LIVE_EMAIL ?? 'demo@softtrack.dev',
      password: process.env.SOFTTRACK_LIVE_PASSWORD ?? 'password123',
    });
    await persistToken(token.access_token);
    team = (await listMyTeamsTeamsGet())[0];
  });

  afterAll(async () => {
    await setMyDefaultViewTeamsTeamIdDefaultViewMePut(team.id, { view_id: null }).catch(
      () => undefined,
    );
    await setTeamDefaultViewTeamsTeamIdDefaultViewPut(team.id, { view_id: null }).catch(
      () => undefined,
    );
    for (const id of created) {
      await deleteViewViewsViewIdDelete(id).catch(() => undefined);
    }
  });

  it('stores exactly the filters the board was showing', async () => {
    const filters = { ...NO_FILTERS, priority: 'urgent' as const, assignee: 'unassigned' as const };
    const view = await createViewTeamsTeamIdViewsPost(team.id, {
      name: `Urgent unassigned ${RUN}`,
      filters: toViewFilters(filters),
    });
    created.push(view.id);

    expect(view.is_shared).toBe(false); // private by default
    expect(view.filters.priority).toBe('urgent');
    expect(view.filters.unassigned).toBe(true);
    // And reading it back reconstructs the same question.
    expect(sameFilters(fromViewFilters(view.filters), filters)).toBe(true);
  });

  it('renames and re-shares', async () => {
    const view = await createViewTeamsTeamIdViewsPost(team.id, {
      name: `Rename me ${RUN}`,
      filters: toViewFilters(NO_FILTERS),
    });
    created.push(view.id);

    const renamed = await updateViewViewsViewIdPatch(view.id, {
      name: `Renamed ${RUN}`,
      is_shared: true,
    });
    expect(renamed.name).toBe(`Renamed ${RUN}`);
    expect(renamed.is_shared).toBe(true);
  });

  it('resolves the effective default itself: yours over the team’s', async () => {
    const teamView = await createViewTeamsTeamIdViewsPost(team.id, {
      name: `Team default ${RUN}`,
      is_shared: true,
      filters: toViewFilters({ ...NO_FILTERS, priority: 'low' }),
    });
    const myView = await createViewTeamsTeamIdViewsPost(team.id, {
      name: `My default ${RUN}`,
      filters: toViewFilters({ ...NO_FILTERS, priority: 'high' }),
    });
    created.push(teamView.id, myView.id);

    await setTeamDefaultViewTeamsTeamIdDefaultViewPut(team.id, { view_id: teamView.id });
    let listed = await listViewsTeamsTeamIdViewsGet(team.id);
    expect(listed.team_default_id).toBe(teamView.id);
    // With no personal default, the team's is what a board lands on.
    expect(listed.effective_default_id).toBe(teamView.id);

    await setMyDefaultViewTeamsTeamIdDefaultViewMePut(team.id, { view_id: myView.id });
    listed = await listViewsTeamsTeamIdViewsGet(team.id);
    // Yours wins -- the client reads this rather than re-deriving the order.
    expect(listed.effective_default_id).toBe(myView.id);

    // Null clears rather than sets.
    await setMyDefaultViewTeamsTeamIdDefaultViewMePut(team.id, { view_id: null });
    listed = await listViewsTeamsTeamIdViewsGet(team.id);
    expect(listed.my_default_id ?? null).toBeNull();
    expect(listed.effective_default_id).toBe(teamView.id);
  });

  it('stops listing a deleted view', async () => {
    const view = await createViewTeamsTeamIdViewsPost(team.id, {
      name: `Delete me ${RUN}`,
      filters: toViewFilters(NO_FILTERS),
    });
    await deleteViewViewsViewIdDelete(view.id);

    const listed = await listViewsTeamsTeamIdViewsGet(team.id);
    expect(listed.items.map((v) => v.id)).not.toContain(view.id);
  });
});
