import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useListMyTeamsTeamsGet } from '@/api/generated/endpoints/teams/teams';
import type { TeamRead } from '@/api/generated/models';
import { errorDetail } from '@/api/errors';
import { Alert, AppText, Card, Loading, TeamBadge } from '@/ui/primitives';
import { Icon } from '@/ui/icon';
import { useIsMultiPane } from '@/ui/layout';
import { ThemeControl } from '@/ui/theme-control';
import { useTokens } from '@/ui/theme';

/**
 * The Home destination, per `docs/design/mobile/138-app-foundation.svg` and
 * `141-teams.svg`.
 *
 * Note this diverges from the web on purpose: `frontend/src/team/TeamsHome.tsx`
 * redirects straight to the first team's board, because on the web the board is
 * the only place to be. Here Board is its own destination in the tab bar, so
 * Home stays the list.
 *
 * The rows show the team key rather than the mockup's "8 members - 12 active
 * issues": `TeamRead` carries no counts, and fetching them today would mean one
 * `/teams/{id}/members` request per row. Issue #4 decides between that and
 * adding the fields to the API.
 */
function TeamRow({ team }: { team: TeamRead }) {
  const t = useTokens();
  return (
    <Pressable>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 }}>
        <TeamBadge teamKey={team.key} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="heading" numberOfLines={1}>
            {team.name}
          </AppText>
          <AppText variant="identifier">{team.key}</AppText>
        </View>
        <Icon name="chevron-right" size={20} color={t.neutral[300]} />
      </Card>
    </Pressable>
  );
}

function EmptyTeams() {
  return (
    <View style={{ alignItems: 'center', gap: 8, paddingVertical: 48 }}>
      <AppText variant="heading">No teams yet</AppText>
      <AppText variant="muted" style={{ textAlign: 'center' }}>
        Teams group issues, cycles and projects. Creating one arrives with the
        teams work.
      </AppText>
    </View>
  );
}

export function TeamsHome() {
  const t = useTokens();
  const multiPane = useIsMultiPane();
  const teams = useListMyTeamsTeamsGet();

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

      {teams.isPending ? (
        <Loading />
      ) : (
        <FlatList
          data={teams.data ?? []}
          keyExtractor={(team) => String(team.id)}
          contentContainerStyle={{ padding: 20, gap: 10 }}
          renderItem={({ item }) => <TeamRow team={item} />}
          ListHeaderComponent={
            teams.error ? (
              <View style={{ paddingBottom: 12 }}>
                <Alert>{errorDetail(teams.error, 'Could not load your teams.')}</Alert>
              </View>
            ) : (teams.data?.length ?? 0) > 0 ? (
              <AppText variant="eyebrow" style={{ paddingBottom: 4 }}>
                YOUR TEAMS
              </AppText>
            ) : null
          }
          ListEmptyComponent={teams.error ? null : <EmptyTeams />}
          refreshControl={
            <RefreshControl
              refreshing={teams.isFetching && !teams.isPending}
              onRefresh={() => void teams.refetch()}
              tintColor={t.brand[600]}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}
