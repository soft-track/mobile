import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { useSearchSearchGet } from '@/api/generated/endpoints/search/search';
import type { SearchHit } from '@/api/generated/models';
import { useTeams } from '@/team/team-context';
import { href } from '@/ui/href';
import { useIsMultiPane } from '@/ui/layout';
import { AppText, Card, Dot, Field, Loading, TeamBadge } from '@/ui/primitives';
import { Sheet } from '@/ui/sheet';
import { useDebouncedValue } from '@/ui/use-debounced-value';
import { useTokens } from '@/ui/theme';

/**
 * Search, per `docs/design/mobile/148-search.svg`.
 *
 * The query settles before it is sent, so typing a word does not cost a request
 * per keystroke. Scope is all your teams or one of them, which is exactly the
 * `team_id` parameter the endpoint takes -- ranking and matching stay on the
 * server, so the result set is the web's.
 */
const DEBOUNCE_MS = 300;
const PAGE = 25;

/** Where the match was found, as something to read rather than a column name. */
function matchedInLabel(hit: SearchHit): string {
  switch (hit.matched_in) {
    case 'title':
      return 'Title';
    case 'description':
      return 'Description';
    case 'comment':
      return 'Comment';
    default:
      return hit.matched_in;
  }
}

export function SearchScreen() {
  const t = useTokens();
  const multiPane = useIsMultiPane();
  const { teams } = useTeams();

  const [query, setQuery] = useState('');
  const [scopeTeamId, setScopeTeamId] = useState<number | null>(null);
  const [scoping, setScoping] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  const settled = useDebouncedValue(query.trim(), DEBOUNCE_MS);

  const results = useSearchSearchGet(
    { q: settled, team_id: scopeTeamId ?? undefined, limit, offset: 0 },
    // A single character matches most of an instance and is never what anyone
    // meant, so the request waits for a second one.
    { query: { enabled: settled.length >= 2 } },
  );

  const hits = results.data?.items ?? [];
  const total = results.data?.total ?? 0;
  const scopeName = scopeTeamId
    ? (teams.find((team) => team.id === scopeTeamId)?.name ?? 'One team')
    : 'All teams';

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: t.canvas }}
      edges={multiPane ? ['top', 'bottom'] : ['top']}
    >
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 10 }}>
        <AppText variant="title">Search</AppText>
        <Field
          label="Find issues"
          value={query}
          onChangeText={setQuery}
          placeholder="Titles, descriptions and comments"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Scope: ${scopeName}`}
          onPress={() => setScoping(true)}
          style={{
            alignSelf: 'flex-start',
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: t.radius.pill,
            backgroundColor: scopeTeamId ? t.line.navActive : t.line.ghost,
          }}
        >
          <AppText
            variant="hint"
            style={{
              color: scopeTeamId ? t.brand[600] : t.neutral[500],
              fontWeight: '600',
            }}
          >
            {scopeName}
          </AppText>
        </Pressable>
      </View>

      {settled.length < 2 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <AppText variant="muted" style={{ textAlign: 'center' }}>
            Type at least two characters to search.
          </AppText>
        </View>
      ) : results.isPending ? (
        <Loading />
      ) : (
        <FlatList
          data={hits}
          keyExtractor={(hit) => String(hit.id)}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <AppText variant="eyebrow">
              {total} RESULT{total === 1 ? '' : 'S'}
            </AppText>
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <AppText variant="muted">Nothing matches “{settled}”.</AppText>
            </View>
          }
          ListFooterComponent={
            total > hits.length ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Load more results"
                onPress={() => setLimit((current) => current + PAGE)}
                style={{
                  paddingVertical: 12,
                  alignItems: 'center',
                  borderRadius: t.radius.control,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: t.line.hairline,
                }}
              >
                <AppText variant="label" style={{ color: t.brand[600] }}>
                  Show more
                </AppText>
              </Pressable>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.identifier} ${item.title}`}
              onPress={() => router.push(href(`/issue/${item.id}`))}
            >
              <Card style={{ padding: 14, gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TeamBadge teamKey={item.team_key} size={20} />
                  <AppText variant="identifier">{item.identifier}</AppText>
                  <Dot color={item.status.color} />
                  <View style={{ flex: 1 }} />
                  <AppText variant="hint">{matchedInLabel(item)}</AppText>
                </View>

                <AppText variant="body" numberOfLines={2} style={{ fontSize: 14 }}>
                  {item.title}
                </AppText>

                {/* The snippet is why this result is here, so it is worth the
                    line even when it repeats part of the title. */}
                {item.snippet ? (
                  <AppText variant="hint" numberOfLines={2}>
                    {item.snippet}
                  </AppText>
                ) : null}
              </Card>
            </Pressable>
          )}
        />
      )}

      <Sheet visible={scoping} onClose={() => setScoping(false)} title="Search in">
        <View style={{ gap: 2, paddingBottom: 12 }}>
          {[{ id: null, name: 'All teams' }, ...teams].map((option) => {
            const id = 'id' in option ? (option.id as number | null) : null;
            const active = scopeTeamId === id;
            return (
              <Pressable
                key={String(id)}
                accessibilityRole="button"
                accessibilityLabel={option.name}
                accessibilityState={active ? { selected: true } : {}}
                onPress={() => {
                  setScopeTeamId(id);
                  setScoping(false);
                }}
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 10,
                  borderRadius: t.radius.control,
                  backgroundColor: active ? t.line.navActive : 'transparent',
                }}
              >
                <AppText variant="body">{option.name}</AppText>
              </Pressable>
            );
          })}
        </View>
      </Sheet>
    </SafeAreaView>
  );
}
