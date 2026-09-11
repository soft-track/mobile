import { Pressable, View } from 'react-native';

import type {
  CycleRead,
  LabelRead,
  ProjectRead,
  StatusRead,
  TeamMemberRead,
} from '@/api/generated/models';
import type { BoardFilters } from '@/board/filters';
import { NO_FILTERS } from '@/board/filters';
import { PRIORITY_LABEL, PRIORITY_ORDER, priorityColor } from '@/issues/issue-meta';
import { Icon } from '@/ui/icon';
import { AppText, Button } from '@/ui/primitives';
import { Sheet } from '@/ui/sheet';
import { useTokens } from '@/ui/theme';

/**
 * The six composable filters, applied server-side.
 *
 * One sheet rather than the web's inline bar: a phone has no room for six
 * dropdowns beside a board, and every one of them is a single choice, so a list
 * of rows with a tick reads better than a row of collapsed menus.
 */
type Option = { key: string; label: string; color?: string; selected: boolean; onPress: () => void };

function Group({ title, options }: { title: string; options: Option[] }) {
  const t = useTokens();
  if (options.length === 0) return null;

  return (
    <View style={{ gap: 4, paddingBottom: 12 }}>
      <AppText variant="eyebrow">{title}</AppText>
      {options.map((option) => (
        <Pressable
          key={option.key}
          accessibilityRole="button"
          accessibilityLabel={option.label}
          accessibilityState={option.selected ? { selected: true } : {}}
          onPress={option.onPress}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingVertical: 10,
            paddingHorizontal: 10,
            borderRadius: t.radius.control,
            backgroundColor: option.selected ? t.line.navActive : 'transparent',
          }}
        >
          {option.color ? (
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: option.color,
              }}
            />
          ) : null}
          <AppText variant="body" numberOfLines={1} style={{ flex: 1 }}>
            {option.label}
          </AppText>
          {option.selected ? <Icon name="check" size={16} color={t.brand[600]} /> : null}
        </Pressable>
      ))}
    </View>
  );
}

export function FilterSheet({
  visible,
  onClose,
  filters,
  onChange,
  statuses,
  labels,
  projects,
  cycles,
  members,
}: {
  visible: boolean;
  onClose: () => void;
  filters: BoardFilters;
  onChange: (next: BoardFilters) => void;
  statuses: StatusRead[];
  labels: LabelRead[];
  projects: ProjectRead[];
  cycles: CycleRead[];
  members: TeamMemberRead[];
}) {
  const t = useTokens();

  /** Tapping the selected option clears it, so every row is its own toggle. */
  function toggle<K extends keyof BoardFilters>(key: K, value: BoardFilters[K]) {
    onChange({ ...filters, [key]: filters[key] === value ? null : value });
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Filter">
      <Group
        title="STATUS"
        options={statuses.map((status) => ({
          key: `status-${status.id}`,
          label: status.name,
          color: status.color,
          selected: filters.statusId === status.id,
          onPress: () => toggle('statusId', status.id),
        }))}
      />

      <Group
        title="PRIORITY"
        options={PRIORITY_ORDER.map((priority) => ({
          key: `priority-${priority}`,
          label: PRIORITY_LABEL[priority],
          color: priorityColor(priority, t),
          selected: filters.priority === priority,
          onPress: () => toggle('priority', priority),
        }))}
      />

      <Group
        title="ASSIGNEE"
        options={[
          {
            key: 'assignee-unassigned',
            label: 'Unassigned',
            selected: filters.assignee === 'unassigned',
            onPress: () => toggle('assignee', 'unassigned'),
          },
          ...members.map((member) => ({
            key: `assignee-${member.user.id}`,
            label: member.user.full_name,
            selected: filters.assignee === member.user.id,
            onPress: () => toggle('assignee', member.user.id),
          })),
        ]}
      />

      <Group
        title="LABEL"
        options={labels.map((label) => ({
          key: `label-${label.id}`,
          label: label.name,
          color: label.color,
          selected: filters.labelId === label.id,
          onPress: () => toggle('labelId', label.id),
        }))}
      />

      <Group
        title="PROJECT"
        options={projects.map((project) => ({
          key: `project-${project.id}`,
          label: project.name,
          selected: filters.projectId === project.id,
          onPress: () => toggle('projectId', project.id),
        }))}
      />

      <Group
        title="CYCLE"
        options={cycles.map((cycle) => ({
          key: `cycle-${cycle.id}`,
          label: cycle.display_name,
          selected: filters.cycleId === cycle.id,
          onPress: () => toggle('cycleId', cycle.id),
        }))}
      />

      <View style={{ paddingBottom: 12, gap: 8 }}>
        <Button variant="ghost" onPress={() => onChange(NO_FILTERS)}>
          Clear all
        </Button>
      </View>
    </Sheet>
  );
}
