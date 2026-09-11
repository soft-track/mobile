import { Pressable, ScrollView, View } from 'react-native';

import type {
  CycleRead,
  LabelRead,
  ProjectRead,
  StatusRead,
  TeamMemberRead,
} from '@/api/generated/models';
import type { BoardFilters } from '@/board/filters';
import { PRIORITY_LABEL } from '@/issues/issue-meta';
import { AppText } from '@/ui/primitives';
import { useTokens } from '@/ui/theme';

/**
 * Active filters, each removable, per `docs/design/mobile/142-board-list.svg`.
 *
 * Every chip names both the dimension and the value ("Priority: Urgent"),
 * because with six possible filters the value alone is ambiguous -- "bug" could
 * be a label or a project.
 */
type Chip = { key: string; label: string; clear: () => void };

export function buildChips(
  filters: BoardFilters,
  data: {
    statuses: StatusRead[];
    labels: LabelRead[];
    projects: ProjectRead[];
    cycles: CycleRead[];
    members: TeamMemberRead[];
  },
  onChange: (next: BoardFilters) => void,
): Chip[] {
  const chips: Chip[] = [];
  const clear = <K extends keyof BoardFilters>(key: K) => () =>
    onChange({ ...filters, [key]: null });

  if (filters.statusId !== null) {
    const status = data.statuses.find((s) => s.id === filters.statusId);
    // A filter naming a row this team no longer has still has to be removable,
    // so the chip falls back to the id rather than disappearing.
    chips.push({
      key: 'status',
      label: `Status: ${status?.name ?? filters.statusId}`,
      clear: clear('statusId'),
    });
  }

  if (filters.priority) {
    chips.push({
      key: 'priority',
      label: `Priority: ${PRIORITY_LABEL[filters.priority]}`,
      clear: clear('priority'),
    });
  }

  if (filters.assignee !== null) {
    const name =
      filters.assignee === 'unassigned'
        ? 'Unassigned'
        : (data.members.find((m) => m.user.id === filters.assignee)?.user.full_name ??
          String(filters.assignee));
    chips.push({ key: 'assignee', label: `Assignee: ${name}`, clear: clear('assignee') });
  }

  if (filters.labelId !== null) {
    const label = data.labels.find((l) => l.id === filters.labelId);
    chips.push({
      key: 'label',
      label: `Label: ${label?.name ?? filters.labelId}`,
      clear: clear('labelId'),
    });
  }

  if (filters.projectId !== null) {
    const project = data.projects.find((p) => p.id === filters.projectId);
    chips.push({
      key: 'project',
      label: `Project: ${project?.name ?? filters.projectId}`,
      clear: clear('projectId'),
    });
  }

  if (filters.cycleId !== null) {
    const cycle = data.cycles.find((c) => c.id === filters.cycleId);
    chips.push({
      key: 'cycle',
      label: `Cycle: ${cycle?.display_name ?? filters.cycleId}`,
      clear: clear('cycleId'),
    });
  }

  return chips;
}

export function FilterChips({
  chips,
  onAdd,
}: {
  chips: Chip[];
  onAdd: () => void;
}) {
  const t = useTokens();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 10, gap: 8 }}
    >
      {chips.map((chip) => (
        <Pressable
          key={chip.key}
          accessibilityRole="button"
          accessibilityLabel={`Remove filter ${chip.label}`}
          onPress={chip.clear}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: t.radius.pill,
            backgroundColor: t.line.navActive,
          }}
        >
          <AppText variant="hint" style={{ color: t.brand[600], fontWeight: '600' }}>
            {chip.label}
          </AppText>
          <AppText variant="hint" style={{ color: t.brand[600] }}>
            ×
          </AppText>
        </Pressable>
      ))}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add filter"
        onPress={onAdd}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: t.radius.pill,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: t.line.field,
        }}
      >
        <AppText variant="hint">+ Filter</AppText>
      </Pressable>
      <View style={{ width: 4 }} />
    </ScrollView>
  );
}
