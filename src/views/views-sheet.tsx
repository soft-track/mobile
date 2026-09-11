import { useState } from 'react';
import { Alert as RNAlert, Pressable, Switch, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import {
  createViewTeamsTeamIdViewsPost,
  deleteViewViewsViewIdDelete,
  setMyDefaultViewTeamsTeamIdDefaultViewMePut,
  setTeamDefaultViewTeamsTeamIdDefaultViewPut,
  updateViewViewsViewIdPatch,
  useListViewsTeamsTeamIdViewsGet,
} from '@/api/generated/endpoints/views/views';
import type { SavedViewRead, TeamRead, UserMe } from '@/api/generated/models';
import { errorDetail } from '@/api/errors';
import { sameFilters, type BoardFilters } from '@/board/filters';
import { fromViewFilters, toViewFilters } from '@/views/saved-views';
import { Icon } from '@/ui/icon';
import { Alert, AppText, Button, Field } from '@/ui/primitives';
import { Sheet } from '@/ui/sheet';
import { useTokens } from '@/ui/theme';

/**
 * Saved views for a team, per `docs/design/mobile/151-saved-views.svg`.
 *
 * Which view is showing is decided by comparing filters rather than by tracking
 * an id, the same way the web's sidebar does it: that is what lets a pasted link
 * carrying filters light up the matching row for someone who can see it, and
 * still work for someone who cannot.
 */
export function ViewsSheet({
  visible,
  onClose,
  team,
  user,
  filters,
  onApply,
}: {
  visible: boolean;
  onClose: () => void;
  team: TeamRead;
  user: UserMe | null;
  filters: BoardFilters;
  onApply: (next: BoardFilters) => void;
}) {
  const t = useTokens();
  const queryClient = useQueryClient();
  const views = useListViewsTeamsTeamIdViewsGet(team.id, {
    query: { enabled: visible },
  });

  const [name, setName] = useState('');
  const [shared, setShared] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<SavedViewRead | null>(null);

  const data = views.data;
  const items = data?.items ?? [];

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: [`/teams/${team.id}/views`] });
  }

  async function run(action: () => Promise<void>, fallback: string) {
    setError(null);
    setBusy(true);
    try {
      await action();
      await refresh();
    } catch (err) {
      setError(errorDetail(err, fallback));
    } finally {
      setBusy(false);
    }
  }

  /** Owner or team admin; the server enforces it, this only hides what it would refuse. */
  function canManage(view: SavedViewRead): boolean {
    return user !== null && view.owner.id === user.id;
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Views">
      <View style={{ gap: 12, paddingBottom: 12 }}>
        {error ? <Alert>{error}</Alert> : null}

        <View style={{ gap: 2 }}>
          {items.map((view) => {
            const showing = sameFilters(filters, fromViewFilters(view.filters));
            const isTeamDefault = data?.team_default_id === view.id;
            const isMyDefault = data?.my_default_id === view.id;

            return (
              <Pressable
                key={view.id}
                accessibilityRole="button"
                accessibilityLabel={view.name}
                accessibilityState={showing ? { selected: true } : {}}
                onPress={() => {
                  onApply(fromViewFilters(view.filters));
                  onClose();
                }}
                onLongPress={() => canManage(view) && setEditing(view)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingVertical: 12,
                  paddingHorizontal: 10,
                  borderRadius: t.radius.control,
                  backgroundColor: showing ? t.line.navActive : 'transparent',
                }}
              >
                <View style={{ flex: 1 }}>
                  <AppText variant="body" numberOfLines={1}>
                    {view.name}
                  </AppText>
                  <AppText variant="hint">
                    {view.is_shared ? 'Shared with the team' : 'Private'}
                    {isMyDefault ? ' · your default' : ''}
                    {isTeamDefault ? ' · team default' : ''}
                  </AppText>
                </View>
                {showing ? <Icon name="check" size={16} color={t.brand[600]} /> : null}
              </Pressable>
            );
          })}

          {items.length === 0 && !views.isPending ? (
            <AppText variant="muted" style={{ paddingVertical: 8 }}>
              No saved views yet. Filter the board, then save it here.
            </AppText>
          ) : null}
        </View>

        {/* Saving the filters as they are now, which is the only thing a view is. */}
        <View
          style={{
            gap: 10,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: t.line.hairline,
          }}
        >
          <Field
            label="Save current filters as"
            value={name}
            onChangeText={setName}
            placeholder="My open bugs"
            maxLength={60}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Switch
              value={shared}
              onValueChange={setShared}
              accessibilityLabel="Share with the team"
            />
            <AppText variant="body" style={{ flex: 1, fontSize: 14 }}>
              Share with the team
            </AppText>
          </View>
          <Button
            loading={busy}
            disabled={!name.trim()}
            onPress={() =>
              void run(async () => {
                await createViewTeamsTeamIdViewsPost(team.id, {
                  name: name.trim(),
                  is_shared: shared,
                  filters: toViewFilters(filters),
                });
                setName('');
                setShared(false);
              }, 'Could not save that view.')
            }
          >
            Save view
          </Button>
          <AppText variant="hint">Private unless shared. Long-press a view to manage it.</AppText>
        </View>
      </View>

      <ManageViewSheet
        view={editing}
        data={data}
        onClose={() => setEditing(null)}
        onRun={run}
        teamId={team.id}
      />
    </Sheet>
  );
}

/** Rename, re-share, set as a default, or delete. */
function ManageViewSheet({
  view,
  data,
  teamId,
  onClose,
  onRun,
}: {
  view: SavedViewRead | null;
  data: { team_default_id?: number | null; my_default_id?: number | null } | undefined;
  teamId: number;
  onClose: () => void;
  onRun: (action: () => Promise<void>, fallback: string) => Promise<void>;
}) {
  const [name, setName] = useState('');

  if (!view) return null;
  const isMyDefault = data?.my_default_id === view.id;
  const isTeamDefault = data?.team_default_id === view.id;

  return (
    <Sheet visible onClose={onClose} title={view.name}>
      <View style={{ gap: 12, paddingBottom: 12 }}>
        <Field
          label="Name"
          value={name || view.name}
          onChangeText={setName}
          maxLength={60}
        />
        <Button
          onPress={() =>
            void onRun(async () => {
              await updateViewViewsViewIdPatch(view.id, { name: (name || view.name).trim() });
              onClose();
            }, 'Could not rename that view.')
          }
        >
          Rename
        </Button>

        <Button
          variant="ghost"
          onPress={() =>
            void onRun(async () => {
              await updateViewViewsViewIdPatch(view.id, { is_shared: !view.is_shared });
              onClose();
            }, 'Could not change sharing.')
          }
        >
          {view.is_shared ? 'Make private' : 'Share with the team'}
        </Button>

        <Button
          variant="ghost"
          onPress={() =>
            void onRun(async () => {
              // Null clears the default rather than setting one.
              await setMyDefaultViewTeamsTeamIdDefaultViewMePut(teamId, {
                view_id: isMyDefault ? null : view.id,
              });
              onClose();
            }, 'Could not set your default.')
          }
        >
          {isMyDefault ? 'Stop being my default' : 'Make my default'}
        </Button>

        <Button
          variant="ghost"
          onPress={() =>
            void onRun(async () => {
              await setTeamDefaultViewTeamsTeamIdDefaultViewPut(teamId, {
                view_id: isTeamDefault ? null : view.id,
              });
              onClose();
            }, 'Could not set the team default. Team admins only.')
          }
        >
          {isTeamDefault ? 'Stop being the team default' : 'Make the team default'}
        </Button>

        <Button
          variant="danger"
          onPress={() =>
            RNAlert.alert(`Delete “${view.name}”?`, 'This cannot be undone.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () =>
                  void onRun(async () => {
                    await deleteViewViewsViewIdDelete(view.id);
                    onClose();
                  }, 'Could not delete that view.'),
              },
            ])
          }
        >
          Delete view
        </Button>
      </View>
    </Sheet>
  );
}
