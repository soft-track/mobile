import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NewTeamSheet } from '@/team/new-team-sheet';
import { useTeams } from '@/team/team-context';
import { TeamSwitcher } from '@/team/team-switcher';
import { Icon } from '@/ui/icon';
import { useIsMultiPane } from '@/ui/layout';
import { AppText, Button, TeamBadge } from '@/ui/primitives';
import { useTokens } from '@/ui/theme';

/**
 * Board — the team-scoped destination.
 *
 * The board itself arrives with issue #5. What is here now is the part that
 * belongs to the team work: the header that says which team you are looking at
 * and the switcher that changes it, which is the affordance the web puts in its
 * sidebar and a tab bar has nowhere else to put.
 */
export default function BoardRoute() {
  const t = useTokens();
  const multiPane = useIsMultiPane();
  const { team, teams, isPending } = useTeams();

  const [switching, setSwitching] = useState(false);
  const [creating, setCreating] = useState(false);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: t.canvas }}
      edges={multiPane ? ['top', 'bottom'] : ['top']}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 20,
          paddingVertical: 12,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: t.line.hairline,
        }}
      >
        {team ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Switch team, currently ${team.name}`}
            onPress={() => setSwitching(true)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}
          >
            <TeamBadge teamKey={team.key} size={32} />
            <View style={{ flex: 1 }}>
              <AppText variant="heading" numberOfLines={1}>
                {team.name}
              </AppText>
            </View>
            <Icon name="chevron-right" size={18} color={t.neutral[400]} />
          </Pressable>
        ) : (
          <AppText variant="title">Board</AppText>
        )}
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 }}>
        {isPending ? null : teams.length === 0 ? (
          <>
            <AppText variant="heading">No teams yet</AppText>
            <AppText variant="muted" style={{ textAlign: 'center' }}>
              A board belongs to a team. Create one to get started.
            </AppText>
            <Button onPress={() => setCreating(true)}>Create a team</Button>
          </>
        ) : (
          <>
            <AppText variant="heading">{team?.key} board</AppText>
            <AppText variant="muted" style={{ textAlign: 'center' }}>
              Columns, filters and drag-and-drop arrive with issue #5.
            </AppText>
          </>
        )}
      </View>

      <TeamSwitcher
        visible={switching}
        onClose={() => setSwitching(false)}
        onCreateTeam={() => setCreating(true)}
      />
      <NewTeamSheet visible={creating} onClose={() => setCreating(false)} />
    </SafeAreaView>
  );
}
