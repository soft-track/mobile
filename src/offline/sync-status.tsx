import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  onlineManager,
  useIsMutating,
  useMutationState,
  useQueryClient,
} from '@tanstack/react-query';

import { describeQueued, MoveConflict } from '@/offline/queue';
import { AppText, Button, Card } from '@/ui/primitives';
import { Sheet } from '@/ui/sheet';
import { useTokens } from '@/ui/theme';

/** Whether there is a network, as React Query currently understands it. */
export function useIsOnline(): boolean {
  const [online, setOnline] = useState(() => onlineManager.isOnline());
  useEffect(() => onlineManager.subscribe(setOnline), []);
  return online;
}

/**
 * The offline banner, per `docs/design/mobile/155-offline.svg`.
 *
 * Shown while there is no network, and also while queued work is still going
 * out after one returns -- "back online" with three unsent changes is not the
 * same as being up to date, and saying so is the difference between trusting the
 * app and refreshing it nervously.
 */
export function OfflineBanner({ onOpenQueue }: { onOpenQueue: () => void }) {
  const t = useTokens();
  const online = useIsOnline();
  const pending = useMutationState({
    filters: { status: 'pending' },
  }).length;
  const paused = useMutationState({
    filters: { predicate: (mutation) => mutation.state.isPaused },
  }).length;

  const queued = paused + pending;
  if (online && queued === 0) return null;

  const tone = online ? t.status.progress : t.priority.medium;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        online ? `Syncing ${queued} changes` : `Offline, ${queued} changes waiting`
      }
      onPress={onOpenQueue}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginHorizontal: 12,
        marginBottom: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: t.radius.control,
        backgroundColor: t.danger[50],
      }}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tone }} />
      <AppText variant="hint" style={{ flex: 1, color: t.neutral[700] }}>
        {online
          ? `Syncing ${queued} change${queued === 1 ? '' : 's'}…`
          : queued > 0
            ? `Offline · ${queued} change${queued === 1 ? '' : 's'} waiting`
            : 'Offline · showing what was last loaded'}
      </AppText>
      {queued > 0 ? (
        <AppText variant="hint" style={{ color: t.brand[600] }}>
          View
        </AppText>
      ) : null}
    </Pressable>
  );
}

/**
 * The queue, and anything that could not be applied.
 *
 * A conflict is shown rather than resolved: the server's version and the one
 * that was queued are both somebody's intent, and picking between them is not a
 * decision to make on their behalf.
 */
export function SyncQueueSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const t = useTokens();
  const queryClient = useQueryClient();
  const online = useIsOnline();
  const inFlight = useIsMutating();

  const all = useMutationState({
    select: (mutation) => ({
      key: mutation.options.mutationKey,
      variables: mutation.state.variables,
      isPaused: mutation.state.isPaused,
      status: mutation.state.status,
      error: mutation.state.error,
    }),
  });

  const waiting = all.filter((entry) => entry.isPaused || entry.status === 'pending');
  const failed = all.filter((entry) => entry.status === 'error');

  if (!visible) return null;

  return (
    <Sheet visible onClose={onClose} title="Sync">
      <View style={{ gap: 12, paddingBottom: 12 }}>
        <AppText variant="hint">
          {online
            ? inFlight > 0
              ? 'Sending queued changes…'
              : 'Up to date.'
            : 'No connection. Changes are kept and sent when one returns.'}
        </AppText>

        {waiting.length > 0 ? (
          <View style={{ gap: 8 }}>
            <AppText variant="eyebrow">WAITING</AppText>
            {waiting.map((entry, index) => (
              <Card key={index} style={{ padding: 12, flexDirection: 'row', gap: 10 }}>
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    marginTop: 5,
                    backgroundColor: t.status.progress,
                  }}
                />
                <AppText variant="body" style={{ flex: 1, fontSize: 14 }}>
                  {describeQueued(entry.key, entry.variables)}
                </AppText>
              </Card>
            ))}
          </View>
        ) : null}

        {failed.length > 0 ? (
          <View style={{ gap: 8 }}>
            <AppText variant="eyebrow">NEEDS ATTENTION</AppText>
            {failed.map((entry, index) => (
              <Card
                key={index}
                style={{ padding: 12, gap: 6, borderColor: t.danger[500] }}
              >
                <AppText variant="body" style={{ fontSize: 14 }}>
                  {describeQueued(entry.key, entry.variables)}
                </AppText>
                <AppText variant="hint" style={{ color: t.danger[700] }}>
                  {entry.error instanceof MoveConflict
                    ? entry.error.message
                    : 'Could not be applied.'}
                </AppText>
                {entry.error instanceof MoveConflict ? (
                  <AppText variant="hint">
                    Open the issue to decide what it should be.
                  </AppText>
                ) : null}
              </Card>
            ))}
          </View>
        ) : null}

        {waiting.length === 0 && failed.length === 0 ? (
          <AppText variant="muted">Nothing waiting.</AppText>
        ) : null}

        {online && waiting.length > 0 ? (
          <Button
            variant="ghost"
            onPress={() => void queryClient.resumePausedMutations()}
          >
            Sync now
          </Button>
        ) : null}

        {failed.length > 0 ? (
          <Button
            variant="ghost"
            onPress={() => {
              // Clearing is the only way past a conflict that has been dealt
              // with on the issue itself.
              queryClient.getMutationCache().clear();
              onClose();
            }}
          >
            Clear failed changes
          </Button>
        ) : null}
      </View>
    </Sheet>
  );
}
