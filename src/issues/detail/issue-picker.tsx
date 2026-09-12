import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { useListIssuesTeamsTeamIdIssuesGet } from '@/api/generated/endpoints/issues/issues';
import type { IssueRead } from '@/api/generated/models';
import { AppText, Dot, Field, Loading } from '@/ui/primitives';
import { Sheet } from '@/ui/sheet';
import { useTokens } from '@/ui/theme';

/**
 * Choose another issue on the same team -- the target of a link, or a parent.
 *
 * Filtered client-side from the team's issue page rather than through /search:
 * the list is already cached for the board, the set is bounded by the same
 * 200-row cap, and matching on identifier as well as title is what people
 * actually type ("ENG-142").
 */
export function IssuePicker({
  visible,
  title,
  teamId,
  excludeIds,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  teamId: number;
  excludeIds: number[];
  onSelect: (issue: IssueRead) => void;
  onClose: () => void;
}) {
  const t = useTokens();
  const [search, setSearch] = useState('');

  const query = useListIssuesTeamsTeamIdIssuesGet(
    teamId,
    { limit: 200 },
    { query: { enabled: visible && teamId > 0 } },
  );

  const matches = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const all = (query.data?.items ?? []).filter((issue) => !excludeIds.includes(issue.id));
    if (!needle) return all.slice(0, 40);
    return all
      .filter(
        (issue) =>
          issue.title.toLowerCase().includes(needle) ||
          issue.identifier.toLowerCase().includes(needle),
      )
      .slice(0, 40);
  }, [query.data, search, excludeIds]);

  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <View style={{ gap: 8, paddingBottom: 12 }}>
        <Field
          label="Find an issue"
          value={search}
          onChangeText={setSearch}
          placeholder="ENG-142 or a few words"
          autoCapitalize="none"
          autoCorrect={false}
        />

        {query.isPending ? <Loading /> : null}

        {matches.map((issue) => (
          <Pressable
            key={issue.id}
            accessibilityRole="button"
            accessibilityLabel={`${issue.identifier} ${issue.title}`}
            onPress={() => {
              onSelect(issue);
              onClose();
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingVertical: 10,
              paddingHorizontal: 8,
              borderRadius: t.radius.control,
            }}
          >
            <Dot color={issue.status.color} />
            <View style={{ flex: 1 }}>
              <AppText variant="identifier">{issue.identifier}</AppText>
              <AppText variant="body" numberOfLines={1} style={{ fontSize: 14 }}>
                {issue.title}
              </AppText>
            </View>
          </Pressable>
        ))}

        {!query.isPending && matches.length === 0 ? (
          <View style={{ paddingVertical: 20, alignItems: 'center' }}>
            <AppText variant="muted">No issue matches that.</AppText>
          </View>
        ) : null}
      </View>
    </Sheet>
  );
}
