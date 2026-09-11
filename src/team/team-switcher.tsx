import { Pressable, View } from 'react-native';

import { useTeams } from '@/team/team-context';
import { Icon } from '@/ui/icon';
import { AppText, TeamBadge } from '@/ui/primitives';
import { Sheet } from '@/ui/sheet';
import { useTokens } from '@/ui/theme';

/**
 * Switch which team the team-scoped destinations are showing.
 *
 * A bottom sheet on a phone and a side sheet on anything wider, per
 * `docs/design/mobile/141-teams.svg`, with a checkmark on the active team.
 * The web does this with a `<Select>` in the sidebar (`board/Sidebar.tsx:52-65`),
 * which has nowhere to live in a tab bar.
 */
export function TeamSwitcher({
  visible,
  onClose,
  onCreateTeam,
}: {
  visible: boolean;
  onClose: () => void;
  onCreateTeam: () => void;
}) {
  const t = useTokens();
  const { teams, teamKey, setTeamKey } = useTeams();

  return (
    <Sheet visible={visible} title="Switch team" onClose={onClose}>
      <View style={{ gap: 4, paddingBottom: 8 }}>
        {teams.map((team) => {
          const active = team.key === teamKey;
          return (
            <Pressable
              key={team.id}
              accessibilityRole="button"
              accessibilityLabel={team.name}
              accessibilityState={active ? { selected: true } : {}}
              onPress={() => {
                setTeamKey(team.key);
                onClose();
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 10,
                paddingHorizontal: 10,
                borderRadius: t.radius.control,
                backgroundColor: active ? t.line.navActive : 'transparent',
              }}
            >
              <TeamBadge teamKey={team.key} size={36} />
              <View style={{ flex: 1, gap: 1 }}>
                <AppText variant="body" numberOfLines={1}>
                  {team.name}
                </AppText>
                <AppText variant="identifier">{team.key}</AppText>
              </View>
              {active ? <Icon name="check" size={18} color={t.brand[600]} /> : null}
            </Pressable>
          );
        })}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create new team"
          onPress={() => {
            onClose();
            onCreateTeam();
          }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingVertical: 10,
            paddingHorizontal: 10,
            borderRadius: t.radius.control,
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: t.radius.control,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: t.line.well,
            }}
          >
            <AppText variant="heading" style={{ color: t.neutral[500] }}>
              +
            </AppText>
          </View>
          <AppText variant="body">Create new team</AppText>
        </Pressable>
      </View>
    </Sheet>
  );
}
