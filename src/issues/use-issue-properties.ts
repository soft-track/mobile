import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { createLabelTeamsTeamIdLabelsPost } from '@/api/generated/endpoints/labels/labels';
import { createProjectTeamsTeamIdProjectsPost } from '@/api/generated/endpoints/projects/projects';
import type { IssuePriority, TeamRead } from '@/api/generated/models';
import { useTeamData } from '@/board/use-team-data';
import { PRIORITY_LABEL, PRIORITY_ORDER, priorityColor } from '@/issues/issue-meta';
import type { PickerOption } from '@/issues/property-picker';
import { useTokens } from '@/ui/theme';

/** The story-point scale, mirroring ESTIMATE_SCALE in the backend's issue model. */
export const ESTIMATE_SCALE = [1, 2, 3, 5, 8] as const;

/**
 * The option lists every issue picker needs, plus inline creation for the two
 * the web lets any member add from the issue form.
 */
export function useIssueProperties(team: TeamRead | undefined) {
  const t = useTokens();
  const queryClient = useQueryClient();
  const data = useTeamData(team);
  const [creating, setCreating] = useState(false);

  const statusOptions: PickerOption<number>[] = data.statuses.map((status) => ({
    value: status.id,
    label: status.name,
    color: status.color,
  }));

  const priorityOptions: PickerOption<IssuePriority>[] = PRIORITY_ORDER.map((priority) => ({
    value: priority,
    label: PRIORITY_LABEL[priority],
    color: priorityColor(priority, t),
  }));

  const estimateOptions: PickerOption<number>[] = ESTIMATE_SCALE.map((points) => ({
    value: points,
    label: `${points} point${points === 1 ? '' : 's'}`,
  }));

  const assigneeOptions: PickerOption<number>[] = data.members.map((member) => ({
    value: member.user.id,
    label: member.user.full_name,
    color: member.user.avatar_color,
  }));

  const labelOptions: PickerOption<number>[] = data.labels.map((label) => ({
    value: label.id,
    label: label.name,
    color: label.color,
  }));

  const projectOptions: PickerOption<number>[] = data.projects.map((project) => ({
    value: project.id,
    label: project.name,
  }));

  const cycleOptions: PickerOption<number>[] = data.cycles.map((cycle) => ({
    value: cycle.id,
    label: cycle.display_name,
    hint: cycle.state,
  }));

  const createLabel = useCallback(
    async (name: string): Promise<number | null> => {
      if (!team) return null;
      setCreating(true);
      try {
        const label = await createLabelTeamsTeamIdLabelsPost(team.id, { name });
        await queryClient.invalidateQueries({ queryKey: [`/teams/${team.id}/labels`] });
        return label.id;
      } catch {
        return null;
      } finally {
        setCreating(false);
      }
    },
    [team, queryClient],
  );

  const createProject = useCallback(
    async (name: string): Promise<number | null> => {
      if (!team) return null;
      setCreating(true);
      try {
        const project = await createProjectTeamsTeamIdProjectsPost(team.id, { name });
        await queryClient.invalidateQueries({ queryKey: [`/teams/${team.id}/projects`] });
        return project.id;
      } catch {
        return null;
      } finally {
        setCreating(false);
      }
    },
    [team, queryClient],
  );

  return {
    ...data,
    statusOptions,
    priorityOptions,
    estimateOptions,
    assigneeOptions,
    labelOptions,
    projectOptions,
    cycleOptions,
    createLabel,
    createProject,
    creating,
  };
}

/** Look a value's label up for a property row, falling back to a placeholder. */
export function labelFor<T extends string | number>(
  options: PickerOption<T>[],
  value: T | null,
  empty: string,
): { text: string; color?: string; muted: boolean } {
  if (value === null) return { text: empty, muted: true };
  const match = options.find((option) => option.value === value);
  // A property naming a row the team has since deleted still has to render.
  if (!match) return { text: String(value), muted: true };
  return { text: match.label, color: match.color, muted: false };
}
