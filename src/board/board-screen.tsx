import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { useListIssuesTeamsTeamIdIssuesGet } from '@/api/generated/endpoints/issues/issues';
import type { IssueRead, StatusRead } from '@/api/generated/models';
import { buildChips, FilterChips } from '@/board/filter-chips';
import { FilterSheet } from '@/board/filter-sheet';
import { fromParams, isEmpty, toParams, toQueryParams, type BoardFilters } from '@/board/filters';
import { IssueList } from '@/board/issue-list';
import { KanbanBoard } from '@/board/kanban-board';
import { useStatusChange } from '@/board/use-status-change';
import { useListViewsTeamsTeamIdViewsGet } from '@/api/generated/endpoints/views/views';
import { useAuth } from '@/auth/auth-context';
import { fromViewFilters } from '@/views/saved-views';
import { ViewsSheet } from '@/views/views-sheet';
import { useTeamData } from '@/board/use-team-data';
import { NewTeamSheet } from '@/team/new-team-sheet';
import { useTeams } from '@/team/team-context';
import { TeamSwitcher } from '@/team/team-switcher';
import { href } from '@/ui/href';
import { Icon } from '@/ui/icon';
import { useIsMultiPane } from '@/ui/layout';
import { AppText, Button, Loading, TeamBadge } from '@/ui/primitives';
import { Sheet } from '@/ui/sheet';
import { useTokens } from '@/ui/theme';

/**
 * Board and list, per `docs/design/mobile/142-board-list.svg`.
 *
 * Filters live in the route's query params rather than in component state, the
 * same choice the web makes -- that is what makes the board someone is looking
 * at a link they can send, and it uses the same keys, so a URL copied out of
 * the web app narrows this board the same way.
 *
 * The issue list is one page (the API caps at 200), so columns are grouped from
 * it client-side while per-column point totals come from the server's own
 * rollup -- summing the loaded page would quietly under-report a long column.
 */
type BoardView = 'board' | 'list';

export function BoardScreen() {
  const t = useTokens();
  const multiPane = useIsMultiPane();
  const { team, teams, isPending: teamsPending } = useTeams();

  const params = useLocalSearchParams();
  const filters = useMemo(() => fromParams(params), [params]);
  const setFilters = useCallback((next: BoardFilters) => {
    router.setParams(toParams(next));
  }, []);

  const [view, setView] = useState<BoardView>('board');
  const [filterOpen, setFilterOpen] = useState(false);
  const [viewsOpen, setViewsOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [moving, setMoving] = useState<IssueRead | null>(null);

  const { user } = useAuth();
  const views = useListViewsTeamsTeamIdViewsGet(team?.id ?? 0, {
    query: { enabled: Boolean(team) },
  });

  /**
   * Land on the default view, at most once per team.
   *
   * `effective_default_id` is the server's own resolution of yours, then the
   * team's, then nothing -- so the client does not re-derive that order. A ref
   * rather than state because nothing renders differently for having landed; it
   * only stops the redirect happening again after someone clears the filters on
   * purpose.
   */
  const landed = useRef<number | null>(null);
  useEffect(() => {
    if (!team || views.isPending) return;
    if (landed.current === team.id) return;
    landed.current = team.id;

    const defaultId = views.data?.effective_default_id;
    if (!defaultId || !isEmpty(filters)) return;
    const view = views.data?.items.find((candidate) => candidate.id === defaultId);
    if (view) router.setParams(toParams(fromViewFilters(view.filters)));
  }, [team, views.isPending, views.data, filters]);

  const data = useTeamData(team);
  const queryParams = useMemo(
    // The cap is the API's own MAX_LIMIT; a board wants every column at once,
    // not a page of one of them.
    () => ({ ...toQueryParams(filters), limit: 200 }),
    [filters],
  );

  const issuesQuery = useListIssuesTeamsTeamIdIssuesGet(team?.id ?? 0, queryParams, {
    query: { enabled: Boolean(team) },
  });
  const issues = issuesQuery.data?.items ?? [];

  const move = useStatusChange(team, queryParams);
  const chips = useMemo(
    () => buildChips(filters, data, setFilters),
    [filters, data, setFilters],
  );

  const onMove = useCallback(
    (issueId: number, status: StatusRead) => {
      void move(issueId, status);
    },
    [move],
  );

  if (teamsPending) return <Loading />;

  if (!team) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.canvas }} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 }}>
          <AppText variant="heading">No teams yet</AppText>
          <AppText variant="muted" style={{ textAlign: 'center' }}>
            A board belongs to a team. Create one to get started.
          </AppText>
          <Button onPress={() => setCreating(true)}>Create a team</Button>
        </View>
        <NewTeamSheet visible={creating} onClose={() => setCreating(false)} />
      </SafeAreaView>
    );
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
          gap: 10,
          paddingHorizontal: 12,
          paddingVertical: 10,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Switch team, currently ${team.name}`}
          onPress={() => setSwitching(true)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}
        >
          <TeamBadge teamKey={team.key} size={28} />
          <AppText variant="heading" numberOfLines={1} style={{ flex: 1 }}>
            {multiPane ? `${team.key} · ${team.name}` : `${team.key} · Board`}
          </AppText>
          <Icon name="chevron-right" size={16} color={t.neutral[400]} />
        </Pressable>

        <Segmented value={view} onChange={setView} />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Saved views"
          onPress={() => setViewsOpen(true)}
          style={{
            width: 36,
            height: 36,
            borderRadius: t.radius.control,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: t.line.ghost,
          }}
        >
          <Icon name="list" size={16} color={t.neutral[600]} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Filter"
          onPress={() => setFilterOpen(true)}
          style={{
            width: 36,
            height: 36,
            borderRadius: t.radius.control,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: chips.length > 0 ? t.line.navActive : t.line.ghost,
          }}
        >
          <Icon
            name="settings"
            size={16}
            color={chips.length > 0 ? t.brand[600] : t.neutral[600]}
          />
        </Pressable>
      </View>

      <FilterChips chips={chips} onAdd={() => setFilterOpen(true)} />

      {issuesQuery.isPending ? (
        <Loading />
      ) : view === 'board' ? (
        <KanbanBoard
          statuses={data.statuses}
          issues={issues}
          estimates={data.estimates}
          onMove={onMove}
          onCardPress={(issue) => router.push(href(`/issue/${issue.id}`))}
        />
      ) : (
        <IssueList
          issues={issues}
          onPress={(issue) => router.push(href(`/issue/${issue.id}`))}
          onMovePress={setMoving}
        />
      )}

      <ViewsSheet
        visible={viewsOpen}
        onClose={() => setViewsOpen(false)}
        team={team}
        user={user}
        filters={filters}
        onApply={setFilters}
      />

      <FilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={filters}
        onChange={setFilters}
        statuses={data.statuses}
        labels={data.labels}
        projects={data.projects}
        cycles={data.cycles}
        members={data.members}
      />

      {/* The fallback the issue asks for beside dragging: a long press on a
          list row, and the only way to move a card without a drag at all. */}
      <Sheet
        visible={moving !== null}
        onClose={() => setMoving(null)}
        title={moving ? `Move ${moving.identifier}` : 'Move'}
      >
        <View style={{ gap: 4, paddingBottom: 12 }}>
          {data.statuses.map((status) => (
            <Pressable
              key={status.id}
              accessibilityRole="button"
              accessibilityLabel={status.name}
              accessibilityState={moving?.status.id === status.id ? { selected: true } : {}}
              onPress={() => {
                if (moving && moving.status.id !== status.id) onMove(moving.id, status);
                setMoving(null);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingVertical: 12,
                paddingHorizontal: 10,
                borderRadius: t.radius.control,
                backgroundColor:
                  moving?.status.id === status.id ? t.line.navActive : 'transparent',
              }}
            >
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: status.color,
                }}
              />
              <AppText variant="body" style={{ flex: 1 }}>
                {status.name}
              </AppText>
              {moving?.status.id === status.id ? (
                <Icon name="check" size={16} color={t.brand[600]} />
              ) : null}
            </Pressable>
          ))}
        </View>
      </Sheet>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="New issue"
        onPress={() => router.push('/new-issue')}
        style={{
          position: 'absolute',
          right: 20,
          bottom: 24,
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: t.brand[600],
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
        }}
      >
        <Icon name="plus" size={24} color="#ffffff" />
      </Pressable>

      <TeamSwitcher
        visible={switching}
        onClose={() => setSwitching(false)}
        onCreateTeam={() => setCreating(true)}
      />
      <NewTeamSheet visible={creating} onClose={() => setCreating(false)} />
      {teams.length === 0 ? null : null}
    </SafeAreaView>
  );
}

function Segmented({
  value,
  onChange,
}: {
  value: BoardView;
  onChange: (next: BoardView) => void;
}) {
  const t = useTokens();
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: t.line.well,
        borderRadius: t.radius.control,
        padding: 2,
        gap: 2,
      }}
    >
      {(['board', 'list'] as const).map((option) => {
        const active = value === option;
        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityLabel={option === 'board' ? 'Board view' : 'List view'}
            accessibilityState={active ? { selected: true } : {}}
            onPress={() => onChange(option)}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: t.radius.control - 2,
              backgroundColor: active ? t.surface.card : 'transparent',
              borderWidth: active ? StyleSheet.hairlineWidth : 0,
              borderColor: t.surface.border,
            }}
          >
            <Icon
              name={option === 'board' ? 'board' : 'list'}
              size={16}
              color={active ? t.neutral[900] : t.neutral[400]}
            />
          </Pressable>
        );
      })}
    </View>
  );
}
