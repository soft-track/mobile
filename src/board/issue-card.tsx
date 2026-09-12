import { StyleSheet, Text, View } from 'react-native';

import type { IssueRead } from '@/api/generated/models';
import { priorityColor } from '@/issues/issue-meta';
import { Avatar, AppText } from '@/ui/primitives';
import { resolveColor } from '@/ui/color';
import { useTokens } from '@/ui/theme';

/**
 * A card on the board, per `docs/design/mobile/142-board-list.svg`:
 * identifier and markers on top, title, then labels and assignee.
 *
 * Pure presentation -- the gesture that lifts it lives in the column, so the
 * same card renders in the list view and inside the drag overlay unchanged.
 */
export function IssueCard({ issue }: { issue: IssueRead }) {
  const t = useTokens();

  return (
    <View
      style={{
        backgroundColor: t.surface.card,
        borderRadius: t.radius.card,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: t.surface.border,
        padding: 12,
        gap: 8,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <AppText variant="identifier">{issue.identifier}</AppText>
        <View style={{ flex: 1 }} />

        {/* Derived server-side as blocked_by_count, so the board does not have
            to fetch links per card to know a card is stuck. */}
        {issue.blocked_by_count > 0 ? (
          <View
            accessibilityLabel={`Blocked by ${issue.blocked_by_count} issue${
              issue.blocked_by_count === 1 ? '' : 's'
            }`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 3,
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: t.radius.pill,
              backgroundColor: t.danger[50],
            }}
          >
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: t.danger[500],
              }}
            />
            <Text style={{ fontSize: 10, fontWeight: '600', color: t.danger[700] }}>
              {issue.blocked_by_count}
            </Text>
          </View>
        ) : null}

        {issue.child_count > 0 ? (
          <AppText variant="identifier">
            {issue.completed_child_count}/{issue.child_count}
          </AppText>
        ) : null}

        {issue.estimate != null ? (
          <View
            style={{
              minWidth: 20,
              alignItems: 'center',
              paddingHorizontal: 5,
              paddingVertical: 1,
              borderRadius: t.radius.pill,
              backgroundColor: t.line.well,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '600', color: t.neutral[600] }}>
              {issue.estimate}
            </Text>
          </View>
        ) : null}

        <View
          accessibilityLabel={`Priority ${issue.priority}`}
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: priorityColor(issue.priority, t),
          }}
        />
      </View>

      <AppText variant="body" numberOfLines={3} style={{ fontSize: 13.5, fontWeight: '500' }}>
        {issue.title}
      </AppText>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
          {issue.labels?.slice(0, 2).map((label) => (
            <View
              key={label.id}
              style={{
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: t.radius.pill,
                backgroundColor: t.line.well,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: resolveColor(label.color, t),
              }}
            >
              <Text style={{ fontSize: 10, color: t.neutral[600] }}>{label.name}</Text>
            </View>
          ))}
        </View>

        {issue.assignee ? (
          <Avatar
            name={issue.assignee.full_name}
            color={issue.assignee.avatar_color}
            size={22}
          />
        ) : null}
      </View>
    </View>
  );
}
