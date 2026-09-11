import { useState, type ReactNode } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import {
  createIssueLinkIssuesIssueIdLinksPost,
  createIssueTeamsTeamIdIssuesPost,
  deleteIssueLinkIssuesIssueIdLinksLinkIdDelete,
  useListIssueLinksIssuesIssueIdLinksGet,
  useListIssuesTeamsTeamIdIssuesGet,
} from '@/api/generated/endpoints/issues/issues';
import { useListCodeLinksIssuesIssueIdCodeLinksGet } from '@/api/generated/endpoints/integrations/integrations';
import {
  useGetWatchStateIssuesIssueIdWatchGet,
  setWatchStateIssuesIssueIdWatchPut,
} from '@/api/generated/endpoints/notifications/notifications';
import { IssueLinkType, type IssueRead, type LinkedIssue } from '@/api/generated/models';
import { errorDetail } from '@/api/errors';
import { IssuePicker } from '@/issues/detail/issue-picker';
import { Icon } from '@/ui/icon';
import { href } from '@/ui/href';
import { Alert, AppText, Button, Card, Dot, Field } from '@/ui/primitives';
import { Sheet } from '@/ui/sheet';
import { useTokens } from '@/ui/theme';

/** A titled block on the detail screen, with an optional action in the header. */
export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <AppText variant="eyebrow" style={{ flex: 1 }}>
          {title}
        </AppText>
        {action}
      </View>
      {children}
    </View>
  );
}

function LinkedRow({
  issue,
  trailing,
}: {
  issue: LinkedIssue;
  trailing?: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${issue.identifier} ${issue.title}`}
      onPress={() => router.push(href(`/issue/${issue.id}`))}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 10,
        paddingHorizontal: 12,
      }}
    >
      <Dot color={issue.status.color} />
      <View style={{ flex: 1 }}>
        <AppText variant="identifier">{issue.identifier}</AppText>
        <AppText variant="body" numberOfLines={1} style={{ fontSize: 14 }}>
          {issue.title}
        </AppText>
      </View>
      {trailing}
    </Pressable>
  );
}

/**
 * Children of this issue, one level deep.
 *
 * Progress comes from the issue's own child_count / completed_child_count
 * rather than being counted here: the server excludes cancelled children from
 * both, and re-deriving it from the child list would quietly disagree.
 */
export function SubIssuesSection({ issue }: { issue: IssueRead }) {
  const t = useTokens();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const children = useListIssuesTeamsTeamIdIssuesGet(issue.team_id, {
    parent_id: issue.id,
    limit: 200,
  });
  const items = children.data?.items ?? [];

  return (
    <Section
      title={
        issue.child_count > 0
          ? `SUB-ISSUES · ${issue.completed_child_count} OF ${issue.child_count} DONE`
          : 'SUB-ISSUES'
      }
      action={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add sub-issue"
          onPress={() => setAdding(true)}
        >
          <Icon name="plus" size={16} color={t.brand[600]} />
        </Pressable>
      }
    >
      {error ? <Alert>{error}</Alert> : null}

      <Card>
        {items.length === 0 ? (
          <View style={{ padding: 14 }}>
            <AppText variant="muted">No sub-issues yet.</AppText>
          </View>
        ) : (
          items.map((child, index) => (
            <View
              key={child.id}
              style={{
                borderTopWidth: index === 0 ? 0 : StyleSheet.hairlineWidth,
                borderTopColor: t.line.hairline,
              }}
            >
              <LinkedRow
                issue={{
                  id: child.id,
                  team_key: child.team_key,
                  number: child.number,
                  identifier: child.identifier,
                  title: child.title,
                  status: child.status,
                  priority: child.priority,
                }}
              />
            </View>
          ))
        )}
      </Card>

      <NewSubIssueSheet
        visible={adding}
        parent={issue}
        onClose={() => setAdding(false)}
        onCreated={async () => {
          await queryClient.invalidateQueries({ queryKey: [`/issues/${issue.id}`] });
          await queryClient.invalidateQueries({
            queryKey: [`/teams/${issue.team_id}/issues`],
          });
        }}
        onError={setError}
      />
    </Section>
  );
}

/** Creating a child is creating an issue with a parent, so it is the same call. */
function NewSubIssueSheet({
  visible,
  parent,
  onClose,
  onCreated,
  onError,
}: {
  visible: boolean;
  parent: IssueRead;
  onClose: () => void;
  onCreated: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <Sheet visible={visible} onClose={onClose} title={`Sub-issue of ${parent.identifier}`}>
      <View style={{ gap: 12, paddingBottom: 12 }}>
        <Field
          label="Title"
          value={title}
          onChangeText={setTitle}
          placeholder="What needs doing?"
          returnKeyType="done"
        />
        <Button
          loading={busy}
          disabled={!title.trim()}
          onPress={async () => {
            setBusy(true);
            try {
              await createIssueTeamsTeamIdIssuesPost(parent.team_id, {
                title: title.trim(),
                parent_id: parent.id,
              });
              await onCreated();
              setTitle('');
              onClose();
            } catch (err) {
              onError(errorDetail(err, 'Could not create the sub-issue.'));
            } finally {
              setBusy(false);
            }
          }}
        >
          Create sub-issue
        </Button>
      </View>
    </Sheet>
  );
}

/** The relation buckets the API returns, in the order the web lists them. */
const RELATIONS = [
  { key: 'blocked_by', label: 'Blocked by' },
  { key: 'blocks', label: 'Blocks' },
  { key: 'duplicates', label: 'Duplicates' },
  { key: 'duplicated_by', label: 'Duplicated by' },
  { key: 'relates_to', label: 'Relates to' },
] as const;

const ADDABLE = [
  { type: IssueLinkType.blocks, label: 'Blocks' },
  { type: IssueLinkType.duplicates, label: 'Duplicates' },
  { type: IssueLinkType.relates_to, label: 'Relates to' },
] as const;

/**
 * Links to other issues.
 *
 * Only three types can be created; the inverses (blocked_by, duplicated_by) are
 * derived server-side, which is why they are listed but not offered.
 */
export function LinksSection({ issue }: { issue: IssueRead }) {
  const t = useTokens();
  const queryClient = useQueryClient();
  const links = useListIssueLinksIssuesIssueIdLinksGet(issue.id);
  const [picking, setPicking] = useState<IssueLinkType | null>(null);
  const [choosingType, setChoosingType] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buckets = links.data ?? {};
  const linkedIds = RELATIONS.flatMap(
    (relation) => (buckets[relation.key] ?? []).map((link) => link.issue.id),
  );

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: [`/issues/${issue.id}/links`] });
    // A blocking link changes the blocked marker on the board.
    void queryClient.invalidateQueries({ queryKey: [`/issues/${issue.id}`] });
    void queryClient.invalidateQueries({ queryKey: [`/teams/${issue.team_id}/issues`] });
  }

  const anyLinks = RELATIONS.some((relation) => (buckets[relation.key] ?? []).length > 0);

  return (
    <Section
      title="LINKS"
      action={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add link"
          onPress={() => setChoosingType(true)}
        >
          <Icon name="plus" size={16} color={t.brand[600]} />
        </Pressable>
      }
    >
      {error ? <Alert>{error}</Alert> : null}

      <Card>
        {!anyLinks ? (
          <View style={{ padding: 14 }}>
            <AppText variant="muted">No linked issues.</AppText>
          </View>
        ) : (
          RELATIONS.map((relation) => {
            const bucket = buckets[relation.key] ?? [];
            if (bucket.length === 0) return null;
            return (
              <View key={relation.key} style={{ paddingTop: 10 }}>
                <AppText variant="hint" style={{ paddingHorizontal: 12 }}>
                  {relation.label}
                </AppText>
                {bucket.map((link) => (
                  <LinkedRow
                    key={link.id}
                    issue={link.issue}
                    trailing={
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Remove link to ${link.issue.identifier}`}
                        onPress={async () => {
                          setError(null);
                          try {
                            await deleteIssueLinkIssuesIssueIdLinksLinkIdDelete(
                              issue.id,
                              link.id,
                            );
                            await refresh();
                          } catch (err) {
                            setError(errorDetail(err, 'Could not remove that link.'));
                          }
                        }}
                      >
                        <AppText variant="hint" style={{ color: t.neutral[400] }}>
                          ×
                        </AppText>
                      </Pressable>
                    }
                  />
                ))}
              </View>
            );
          })
        )}
      </Card>

      <Sheet
        visible={choosingType}
        onClose={() => setChoosingType(false)}
        title="Link type"
      >
        <View style={{ gap: 2, paddingBottom: 12 }}>
          {ADDABLE.map((option) => (
            <Pressable
              key={option.type}
              accessibilityRole="button"
              accessibilityLabel={option.label}
              onPress={() => {
                setChoosingType(false);
                setPicking(option.type);
              }}
              style={{
                paddingVertical: 12,
                paddingHorizontal: 10,
                borderRadius: t.radius.control,
              }}
            >
              <AppText variant="body">{option.label}</AppText>
            </Pressable>
          ))}
          <AppText variant="hint" style={{ paddingHorizontal: 10, paddingTop: 8 }}>
            “Blocked by” and “Duplicated by” are the other side of these, and
            appear on the issue you pick.
          </AppText>
        </View>
      </Sheet>

      <IssuePicker
        visible={picking !== null}
        title="Link to"
        teamId={issue.team_id}
        excludeIds={[issue.id, ...linkedIds]}
        onClose={() => setPicking(null)}
        onSelect={async (target) => {
          if (!picking) return;
          setError(null);
          try {
            await createIssueLinkIssuesIssueIdLinksPost(issue.id, {
              target_id: target.id,
              type: picking,
            });
            await refresh();
          } catch (err) {
            setError(errorDetail(err, 'Could not add that link.'));
          }
        }}
      />
    </Section>
  );
}

/**
 * Branches, commits and pull requests from connected repositories.
 *
 * Read-only: these arrive by webhook from the repository side, so there is
 * nothing to create here. Tapping opens the host in a browser.
 */
export function DevelopmentSection({ issue }: { issue: IssueRead }) {
  const t = useTokens();
  const codeLinks = useListCodeLinksIssuesIssueIdCodeLinksGet(issue.id);

  const groups = [
    { key: 'pull_requests' as const, label: 'Pull requests' },
    { key: 'branches' as const, label: 'Branches' },
    { key: 'commits' as const, label: 'Commits' },
  ];

  const data = codeLinks.data ?? {};
  const any = groups.some((group) => (data[group.key] ?? []).length > 0);

  // Nothing connected and nothing linked is the common case; a permanently
  // empty section would just be noise on a phone.
  if (!any) return null;

  return (
    <Section title="DEVELOPMENT">
      <Card>
        {groups.map((group) => {
          const items = data[group.key] ?? [];
          if (items.length === 0) return null;
          return (
            <View key={group.key} style={{ paddingTop: 10 }}>
              <AppText variant="hint" style={{ paddingHorizontal: 12 }}>
                {group.label}
              </AppText>
              {items.map((item) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="link"
                  accessibilityLabel={item.title ?? item.external_id}
                  onPress={() => void Linking.openURL(item.url)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <AppText variant="body" numberOfLines={1} style={{ fontSize: 14 }}>
                      {item.title ?? item.external_id}
                    </AppText>
                    <AppText variant="hint" numberOfLines={1}>
                      {item.repository.full_name}
                      {item.state ? ` · ${item.state}` : ''}
                    </AppText>
                  </View>
                  <Icon name="chevron-right" size={16} color={t.neutral[300]} />
                </Pressable>
              ))}
            </View>
          );
        })}
      </Card>
    </Section>
  );
}

/**
 * Watch toggle.
 *
 * The server auto-watches on assignment and commenting, so this reflects a
 * state that changes without being touched here -- it reads the current value
 * rather than assuming.
 */
export function WatchToggle({ issue }: { issue: IssueRead }) {
  const t = useTokens();
  const queryClient = useQueryClient();
  const watch = useGetWatchStateIssuesIssueIdWatchGet(issue.id);
  const [busy, setBusy] = useState(false);

  const watching = watch.data?.watching === true;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={watching ? 'Stop watching' : 'Watch this issue'}
      accessibilityState={{ selected: watching }}
      disabled={busy || watch.isPending}
      onPress={async () => {
        setBusy(true);
        try {
          await setWatchStateIssuesIssueIdWatchPut(issue.id, { watching: !watching });
          await queryClient.invalidateQueries({ queryKey: [`/issues/${issue.id}/watch`] });
        } finally {
          setBusy(false);
        }
      }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: t.radius.pill,
        backgroundColor: watching ? t.line.navActive : t.line.ghost,
      }}
    >
      <Icon name="bell" size={14} color={watching ? t.brand[600] : t.neutral[500]} />
      <AppText
        variant="hint"
        style={{ color: watching ? t.brand[600] : t.neutral[500], fontWeight: '600' }}
      >
        {watching ? 'Watching' : 'Watch'}
      </AppText>
    </Pressable>
  );
}
