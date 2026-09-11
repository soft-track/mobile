import { useListCyclesTeamsTeamIdCyclesGet } from '@/api/generated/endpoints/cycles/cycles';
import { useGetEstimateSummaryTeamsTeamIdEstimatesGet } from '@/api/generated/endpoints/issues/issues';
import { useListLabelsTeamsTeamIdLabelsGet } from '@/api/generated/endpoints/labels/labels';
import { useListProjectsTeamsTeamIdProjectsGet } from '@/api/generated/endpoints/projects/projects';
import { useListStatusesTeamsTeamIdStatusesGet } from '@/api/generated/endpoints/statuses/statuses';
import { useListTeamMembersTeamsTeamIdMembersGet } from '@/api/generated/endpoints/teams/teams';
import type { TeamRead } from '@/api/generated/models';

/**
 * Everything the board needs about a team besides its issues.
 *
 * A port of `frontend/src/team/useTeamData.ts`. All six are keyed on the team,
 * enabled together, and consumed as one object, so they belong together.
 */
export function useTeamData(team: TeamRead | undefined) {
  const id = team?.id ?? 0;
  const options = { query: { enabled: Boolean(team) } };

  const projects = useListProjectsTeamsTeamIdProjectsGet(id, options);
  const labels = useListLabelsTeamsTeamIdLabelsGet(id, options);
  const members = useListTeamMembersTeamsTeamIdMembersGet(id, options);
  const cycles = useListCyclesTeamsTeamIdCyclesGet(id, options);
  // The team's own board columns -- never a hardcoded list.
  const statuses = useListStatusesTeamsTeamIdStatusesGet(id, options);
  // Rolled up on the server rather than summed from the issue list: that list
  // is one page, so a client-side total would only total what happened to load.
  const estimates = useGetEstimateSummaryTeamsTeamIdEstimatesGet(id, options);

  return {
    projects: projects.data ?? [],
    labels: labels.data ?? [],
    members: members.data ?? [],
    cycles: cycles.data ?? [],
    statuses: statuses.data ?? [],
    estimates: estimates.data,
    isPending: statuses.isPending,
  };
}
