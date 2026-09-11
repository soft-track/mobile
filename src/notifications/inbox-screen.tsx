import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import {
  markAllReadNotificationsReadAllPost,
  updateNotificationNotificationsNotificationIdPatch,
  useListNotificationsNotificationsGet,
} from '@/api/generated/endpoints/notifications/notifications';
import type { NotificationKind, NotificationRead } from '@/api/generated/models';
import { errorDetail } from '@/api/errors';
import { href } from '@/ui/href';
import { Icon } from '@/ui/icon';
import { useIsMultiPane } from '@/ui/layout';
import { Alert, AppText, Avatar, Card, Loading } from '@/ui/primitives';
import { useTokens } from '@/ui/theme';

/**
 * The inbox, per `docs/design/mobile/147-notifications.svg`.
 *
 * Four kinds, and each one needs a different sentence -- "commented on" and
 * "mentioned you in" are not the same event even though both are a comment.
 */
const PAGE = 25;

function sentenceFor(notification: NotificationRead): string {
  const who = notification.actor?.full_name ?? 'Someone';
  const kind: NotificationKind = notification.kind;
  switch (kind) {
    case 'assigned':
      return `${who} assigned you`;
    case 'mentioned':
      return `${who} mentioned you`;
    case 'commented':
      return `${who} commented`;
    case 'status_changed':
      return `${who} changed the status`;
    default:
      return who;
  }
}

export function InboxScreen() {
  const t = useTokens();
  const multiPane = useIsMultiPane();
  const queryClient = useQueryClient();

  const [unreadOnly, setUnreadOnly] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [error, setError] = useState<string | null>(null);

  const notifications = useListNotificationsNotificationsGet({
    unread_only: unreadOnly || undefined,
    limit,
    offset: 0,
  });

  const items = notifications.data?.items ?? [];
  const total = notifications.data?.total ?? 0;

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['/notifications'] });
    // The tab badge reads its own endpoint, so it has to be told too.
    void queryClient.invalidateQueries({ queryKey: ['/notifications/unread-count'] });
  }

  async function open(notification: NotificationRead) {
    // Marked read on the way out rather than on arrival: opening it is what
    // says it has been seen.
    if (!notification.read) {
      try {
        await updateNotificationNotificationsNotificationIdPatch(notification.id, {
          read: true,
        });
        await refresh();
      } catch {
        // Navigating still matters more than the read flag.
      }
    }
    router.push(href(`/issue/${notification.issue.id}`));
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
          paddingHorizontal: 20,
          paddingVertical: 12,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: t.line.hairline,
        }}
      >
        <AppText variant="title" style={{ flex: 1 }}>
          Inbox
        </AppText>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={unreadOnly ? 'Show all' : 'Show unread only'}
          accessibilityState={unreadOnly ? { selected: true } : {}}
          onPress={() => setUnreadOnly((current) => !current)}
          style={{
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: t.radius.pill,
            backgroundColor: unreadOnly ? t.line.navActive : t.line.ghost,
          }}
        >
          <AppText
            variant="hint"
            style={{
              color: unreadOnly ? t.brand[600] : t.neutral[500],
              fontWeight: '600',
            }}
          >
            Unread
          </AppText>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mark all read"
          onPress={async () => {
            setError(null);
            try {
              await markAllReadNotificationsReadAllPost();
              await refresh();
            } catch (err) {
              setError(errorDetail(err, 'Could not mark everything read.'));
            }
          }}
        >
          <Icon name="check" size={18} color={t.neutral[500]} />
        </Pressable>
      </View>

      {notifications.isPending ? (
        <Loading />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          ListHeaderComponent={error ? <Alert>{error}</Alert> : null}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 48, gap: 6 }}>
              <AppText variant="heading">
                {unreadOnly ? 'Nothing unread' : 'Nothing yet'}
              </AppText>
              <AppText variant="muted" style={{ textAlign: 'center' }}>
                You are told when you are assigned, mentioned, or when work you
                watch moves.
              </AppText>
            </View>
          }
          ListFooterComponent={
            total > items.length ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Load more"
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
              accessibilityLabel={`${sentenceFor(item)} on ${item.issue.identifier}`}
              onPress={() => void open(item)}
            >
              <Card
                style={{
                  flexDirection: 'row',
                  gap: 12,
                  padding: 14,
                  // Unread is carried by a marker rather than a background, so
                  // the list does not change colour as things are read.
                  borderColor: item.read ? t.surface.border : t.brand[300],
                }}
              >
                {item.actor ? (
                  <Avatar
                    name={item.actor.full_name}
                    color={item.actor.avatar_color}
                    size={32}
                  />
                ) : (
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: t.line.well,
                    }}
                  />
                )}

                <View style={{ flex: 1, gap: 3 }}>
                  <AppText variant="body" numberOfLines={1} style={{ fontSize: 14 }}>
                    {sentenceFor(item)}
                  </AppText>
                  <AppText variant="identifier">
                    {item.issue.identifier} · {item.issue.title}
                  </AppText>
                  {item.excerpt ? (
                    <AppText variant="hint" numberOfLines={2}>
                      {item.excerpt}
                    </AppText>
                  ) : null}
                </View>

                {!item.read ? (
                  <View
                    accessibilityLabel="Unread"
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      marginTop: 4,
                      backgroundColor: t.brand[600],
                    }}
                  />
                ) : null}
              </Card>
            </Pressable>
          )}
          refreshing={notifications.isFetching && !notifications.isPending}
          onRefresh={refresh}
        />
      )}
    </SafeAreaView>
  );
}
