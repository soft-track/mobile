import { useQueries } from '@tanstack/react-query';

import {
  getListTeamMembersTeamsTeamIdMembersGetQueryKey,
  listTeamMembersTeamsTeamIdMembersGet,
} from '@/api/generated/endpoints/teams/teams';
import type { TeamRead } from '@/api/generated/models';

/**
 * Member counts for the teams list.
 *
 * Every teams mockup shows "8 members", but `TeamRead` is
 * `{id, name, key, description, created_at}` -- there is no count on it
 * (`backend/lib_softtrack/models/teams.py:16-24`). The only way to get one today
 * is to ask each team for its members, so that is what this does: one query per
 * team, in parallel, cached for a minute.
 *
 * That is an N+1, and it is a deliberate one. `GET /teams` returns only the
 * teams you belong to, which is a handful for a real person, and each response
 * is small. A `member_count` field on `TeamRead` would be strictly better and
 * would help the web too -- worth raising upstream -- but it is not worth
 * shipping the screen without the counts the design calls for in the meantime.
 *
 * Counts are undefined rather than zero while loading or on failure, so a row
 * shows no count instead of claiming a team is empty.
 */
export function useMemberCounts(teams: TeamRead[]): Record<number, number | undefined> {
  const results = useQueries({
    queries: teams.map((team) => ({
      queryKey: getListTeamMembersTeamsTeamIdMembersGetQueryKey(team.id),
      queryFn: ({ signal }: { signal?: AbortSignal }) =>
        listTeamMembersTeamsTeamIdMembersGet(team.id, signal),
      staleTime: 60_000,
      retry: false,
    })),
  });

  const counts: Record<number, number | undefined> = {};
  teams.forEach((team, index) => {
    counts[team.id] = results[index]?.data?.length;
  });
  return counts;
}
