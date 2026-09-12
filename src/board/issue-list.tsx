import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import type { IssueRead, StatusRead } from '@/api/generated/models';
import { priorityColor } from '@/issues/issue-meta';
import { Avatar, AppText, Dot } from '@/ui/primitives';
import { useTokens } from '@/ui/theme';

/**
 * The same filtered issue set as the board, as one vertical list.
 *
 * Rows rather than cards: a list exists to be scanned, so the status moves from
 * "which column am I in" to an explicit dot, and the layout stays one line of
 * metadata per issue.
 */
export function IssueList({
  issues,
  onPress,
  onMovePress,
}: {
  issues: IssueRead[];
  onPress: (issue: IssueRead) => void;
  onMovePress: (issue: IssueRead) => void;
}) {
  const t = useTokens();

  return (
    <FlatList
      data={issues}
      keyExtractor={(issue) => String(issue.id)}
      contentContainerStyle={{ padding: 12, gap: 8 }}
      ListEmptyComponent={
        <View style={{ alignItems: 'center', paddingVertical: 40 }}>
          <AppText variant="muted">No issues match these filters.</AppText>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${item.identifier} ${item.title}`}
          onPress={() => onPress(item)}
          onLongPress={() => onMovePress(item)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            backgroundColor: t.surface.card,
            borderRadius: t.radius.card,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: t.surface.border,
            padding: 12,
          }}
        >
          <StatusDot status={item.status} />

          <View style={{ flex: 1, gap: 3 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <AppText variant="identifier">{item.identifier}</AppText>
              {item.blocked_by_count > 0 ? (
                <AppText variant="identifier" style={{ color: t.danger[700] }}>
                  blocked
                </AppText>
              ) : null}
            </View>
            <AppText variant="body" numberOfLines={2} style={{ fontSize: 14 }}>
              {item.title}
            </AppText>
          </View>

          <View
            accessibilityLabel={`Priority ${item.priority}`}
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: priorityColor(item.priority, t),
            }}
          />

          {item.assignee ? (
            <Avatar
              name={item.assignee.full_name}
              color={item.assignee.avatar_color}
              size={24}
            />
          ) : (
            <View
              accessibilityLabel="Unassigned"
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                borderWidth: 1,
                borderStyle: 'dashed',
                borderColor: t.neutral[300],
              }}
            />
          )}
        </Pressable>
      )}
    />
  );
}

function StatusDot({ status }: { status: StatusRead }) {
  return (
    <Dot color={status.color} size={10} label={status.name} />
  );
}
