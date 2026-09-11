import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';

import type { TeamRead } from '@/api/generated/models';
import { NewTeamSheet } from '@/team/new-team-sheet';
import { useTeams } from '@/team/team-context';
import { useMemberCounts } from '@/team/use-member-counts';
import { Icon } from '@/ui/icon';
import { useIsMultiPane } from '@/ui/layout';
import { Alert, AppText, Button, Card, Field, Loading, TeamBadge } from '@/ui/primitives';
import { ThemeControl } from '@/ui/theme-control';
import { useTokens } from '@/ui/theme';

/**
 * The Home destination, per `docs/design/mobile/138-app-foundation.svg` and
 * `141-teams.svg`.
 *
 * Diverges from the web on purpose: `frontend/src/team/TeamsHome.tsx` redirects
 * straight to the first team's board, because on the web the board is the only
 * place to be. Here Board is its own destination in the tab bar, so Home stays
 * the list.
 */
function TeamRow({
  team,
  memberCount,
  active,
  onPress,
}: {
  team: TeamRead;
  memberCount: number | undefined;
  active: boolean;
  onPress: () => void;
}) {
  const t = useTokens();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={team.name}
      accessibilityState={active ? { selected: true } : {}}
      onPress={onPress}
    >
      <Card
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          padding: 14,
          borderColor: active ? t.brand[300] : t.surface.border,
        }}
      >
        <TeamBadge teamKey={team.key} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="heading" numberOfLines={1}>
            {team.name}
          </AppText>
          <AppText variant="muted" numberOfLines={1}>
            {team.key}
            {memberCount !== undefined
              ? ` · ${memberCount} member${memberCount === 1 ? '' : 's'}`
              : ''}
          </AppText>
        </View>
        {active ? <Icon name="check" size={18} color={t.brand[600]} /> : null}
        <Icon name="chevron-right" size={20} color={t.neutral[300]} />
      </Card>
    </Pressable>
  );
}

export function TeamsHome() {
  const t = useTokens();
  const multiPane = useIsMultiPane();
  const queryClient = useQueryClient();
  const { teams, teamKey, setTeamKey, isPending, isError } = useTeams();
  const counts = useMemberCounts(teams);

  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return teams;
    return teams.filter(
      (team) =>
        team.name.toLowerCase().includes(needle) ||
        team.key.toLowerCase().includes(needle),
    );
  }, [teams, search]);

  async function refresh() {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['/teams'], refetchType: 'all' });
    await queryClient.invalidateQueries({ queryKey: ['/auth/me/invites'] });
    setRefreshing(false);
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: t.canvas }}
      edges={multiPane ? ['top', 'bottom'] : ['top']}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingVertical: 12,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: t.line.hairline,
        }}
      >
        <AppText variant="title">Teams</AppText>
        <ThemeControl />
      </View>

      {isPending ? (
        <Loading />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(team) => String(team.id)}
          contentContainerStyle={{ padding: 20, gap: 10 }}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <TeamRow
              team={item}
              memberCount={counts[item.id]}
              active={item.key === teamKey}
              onPress={() => setTeamKey(item.key)}
            />
          )}
          ListHeaderComponent={
            <View style={{ gap: 14, paddingBottom: 4 }}>
              {isError ? (
                <Alert>Could not load your teams. Pull down to try again.</Alert>
              ) : null}

              {/* Only worth the space once the list is long enough to scan. */}
              {teams.length > 4 ? (
                <Field
                  label="Search teams"
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Engineering"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              ) : null}

              {teams.length > 0 ? <AppText variant="eyebrow">YOUR TEAMS</AppText> : null}
            </View>
          }
          ListEmptyComponent={
            isError ? null : teams.length === 0 ? (
              <View style={{ alignItems: 'center', gap: 10, paddingVertical: 40 }}>
                <AppText variant="heading">No teams yet</AppText>
                <AppText variant="muted" style={{ textAlign: 'center' }}>
                  Teams group issues, cycles and projects. Create one to get
                  started.
                </AppText>
              </View>
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                <AppText variant="muted">No team matches “{search}”.</AppText>
              </View>
            )
          }
          ListFooterComponent={
            <View style={{ paddingTop: 14 }}>
              <Button variant="ghost" onPress={() => setCreating(true)}>
                + New team
              </Button>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={t.brand[600]}
            />
          }
        />
      )}

      <NewTeamSheet visible={creating} onClose={() => setCreating(false)} />
    </SafeAreaView>
  );
}
