import { listIssuesTeamsTeamIdIssuesGet } from '@/api/generated/endpoints/issues/issues';
import { listMyTeamsTeamsGet } from '@/api/generated/endpoints/teams/teams';
import type { TeamRead } from '@/api/generated/models';

/**
 * The team the live suites should work against.
 *
 * `GET /teams` promises no particular order, and the suites that exercise team
 * administration and onboarding create teams the API offers no way to delete --
 * so an instance these tests have run against accumulates empty teams for good.
 * Taking `teams[0]` eventually picks one of those and fails on an empty board,
 * which says nothing about the code under test.
 *
 * Prefer the seeded team by key, then any team that actually has issues.
 */
export async function seededTeam(preferredKey = 'ENG'): Promise<TeamRead> {
  const teams = await listMyTeamsTeamsGet();
  if (teams.length === 0) throw new Error('the instance has no teams to test against');

  const preferred = teams.find((team) => team.key === preferredKey);
  if (preferred) return preferred;

  for (const team of teams) {
    const page = await listIssuesTeamsTeamIdIssuesGet(team.id, { limit: 1 });
    if (page.items.length > 0) return team;
  }
  return teams[0];
}
