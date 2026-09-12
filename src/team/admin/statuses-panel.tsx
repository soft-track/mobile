import { useState } from 'react';
import { Alert as RNAlert, Pressable, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import {
  createStatusTeamsTeamIdStatusesPost,
  deleteStatusStatusesStatusIdDelete,
  reorderStatusesTeamsTeamIdStatusesOrderPut,
  updateStatusStatusesStatusIdPatch,
  useListStatusesTeamsTeamIdStatusesGet,
} from '@/api/generated/endpoints/statuses/statuses';
import { StatusCategory, type StatusRead, type TeamRead } from '@/api/generated/models';
import { errorDetail } from '@/api/errors';
import { Icon } from '@/ui/icon';
import { Alert, AppText, Button, Card, Dot, Field } from '@/ui/primitives';
import { Sheet } from '@/ui/sheet';
import { useTokens } from '@/ui/theme';

/**
 * The team's board columns.
 *
 * Reordering moves one row at a time with arrows rather than a drag. The board
 * already spends its drag gesture on cards, and a second drag surface inside a
 * sheet is both harder to hit and harder to verify -- arrows do the same job
 * with a target a thumb can actually land on.
 */
const CATEGORY_ORDER: StatusCategory[] = [
  StatusCategory.backlog,
  StatusCategory.unstarted,
  StatusCategory.started,
  StatusCategory.done,
  StatusCategory.cancelled,
];

const CATEGORY_HINT: Record<StatusCategory, string> = {
  backlog: 'Not committed to yet',
  unstarted: 'Accepted, not begun',
  started: 'Work in flight',
  done: 'Finished',
  cancelled: 'Closed without being delivered',
};

export function StatusesPanel({
  visible,
  onClose,
  team,
  isAdmin,
}: {
  visible: boolean;
  onClose: () => void;
  team: TeamRead;
  isAdmin: boolean;
}) {
  const t = useTokens();
  const queryClient = useQueryClient();
  const statuses = useListStatusesTeamsTeamIdStatusesGet(team.id, {
    query: { enabled: visible },
  });

  const [name, setName] = useState('');
  const [category, setCategory] = useState<StatusCategory>(StatusCategory.unstarted);
  const [editing, setEditing] = useState<StatusRead | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const items = statuses.data ?? [];

  async function run(action: () => Promise<void>, fallback: string) {
    setError(null);
    setBusy(true);
    try {
      await action();
      await queryClient.invalidateQueries({ queryKey: [`/teams/${team.id}/statuses`] });
      // Columns are what the board draws, so it has to re-read them.
      void queryClient.invalidateQueries({ queryKey: [`/teams/${team.id}/issues`] });
    } catch (err) {
      setError(errorDetail(err, fallback));
    } finally {
      setBusy(false);
    }
  }

  /** Every id at once: two people reordering would otherwise interleave. */
  function move(index: number, delta: number) {
    const next = [...items];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    void run(
      () =>
        reorderStatusesTeamsTeamIdStatusesOrderPut(team.id, {
          status_ids: next.map((status) => status.id),
        }).then(() => undefined),
      'Could not reorder the columns.',
    );
  }

  function confirmDelete(status: StatusRead) {
    const others = items.filter((candidate) => candidate.id !== status.id);
    if (others.length === 0) {
      setError('A team needs at least one status.');
      return;
    }

    // Where the issues go is required rather than defaulted: guessing which
    // column somebody's work lands in is not a decision to make for them.
    RNAlert.alert(
      `Delete ${status.name}?`,
      'Its issues have to go somewhere. Choose a column.',
      [
        { text: 'Cancel', style: 'cancel' },
        ...others.slice(0, 4).map((destination) => ({
          text: `Move to ${destination.name}`,
          onPress: () =>
            void run(
              () =>
                deleteStatusStatusesStatusIdDelete(status.id, {
                  move_to_id: destination.id,
                }).then(() => undefined),
              'Could not delete that status.',
            ),
        })),
      ],
    );
  }

  if (!visible) return null;

  return (
    <Sheet visible onClose={onClose} title="Statuses">
      <View style={{ gap: 12, paddingBottom: 12 }}>
        {error ? <Alert>{error}</Alert> : null}

        {items.map((status, index) => (
          <Card
            key={status.id}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 }}
          >
            <Dot color={status.color} size={10} />
            <View style={{ flex: 1 }}>
              <AppText variant="body" numberOfLines={1} style={{ fontSize: 14 }}>
                {status.name}
              </AppText>
              <AppText variant="hint">{CATEGORY_HINT[status.category]}</AppText>
            </View>

            {isAdmin ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Move ${status.name} left`}
                  disabled={index === 0 || busy}
                  onPress={() => move(index, -1)}
                  style={{ padding: 6, opacity: index === 0 ? 0.3 : 1 }}
                >
                  <AppText variant="hint">↑</AppText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Move ${status.name} right`}
                  disabled={index === items.length - 1 || busy}
                  onPress={() => move(index, 1)}
                  style={{ padding: 6, opacity: index === items.length - 1 ? 0.3 : 1 }}
                >
                  <AppText variant="hint">↓</AppText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${status.name}`}
                  onPress={() => setEditing(status)}
                  style={{ padding: 6 }}
                >
                  <Icon name="settings" size={14} color={t.neutral[400]} />
                </Pressable>
              </>
            ) : null}
          </Card>
        ))}

        {isAdmin ? (
          <View
            style={{
              gap: 10,
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: t.line.hairline,
            }}
          >
            <AppText variant="eyebrow">NEW STATUS</AppText>
            <Field label="Name" value={name} onChangeText={setName} placeholder="In review" maxLength={40} />

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {CATEGORY_ORDER.map((option) => {
                const active = category === option;
                return (
                  <Pressable
                    key={option}
                    accessibilityRole="button"
                    accessibilityLabel={option}
                    accessibilityState={active ? { selected: true } : {}}
                    onPress={() => setCategory(option)}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: t.radius.pill,
                      backgroundColor: active ? t.line.navActive : t.line.well,
                    }}
                  >
                    <AppText
                      variant="hint"
                      style={{ color: active ? t.brand[600] : t.neutral[500] }}
                    >
                      {option}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
            <AppText variant="hint">{CATEGORY_HINT[category]}</AppText>

            <Button
              loading={busy}
              disabled={!name.trim()}
              onPress={() =>
                void run(async () => {
                  await createStatusTeamsTeamIdStatusesPost(team.id, {
                    name: name.trim(),
                    category,
                  });
                  setName('');
                }, 'Could not create that status.')
              }
            >
              Add status
            </Button>
          </View>
        ) : null}
      </View>

      {editing ? (
        <EditStatusSheet
          status={editing}
          onClose={() => setEditing(null)}
          onRun={run}
          onDelete={() => {
            const target = editing;
            setEditing(null);
            confirmDelete(target);
          }}
        />
      ) : null}
    </Sheet>
  );
}

function EditStatusSheet({
  status,
  onClose,
  onRun,
  onDelete,
}: {
  status: StatusRead;
  onClose: () => void;
  onRun: (action: () => Promise<void>, fallback: string) => Promise<void>;
  onDelete: () => void;
}) {
  const t = useTokens();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<StatusCategory>(status.category);

  return (
    <Sheet visible onClose={onClose} title={status.name}>
      <View style={{ gap: 12, paddingBottom: 12 }}>
        <Field
          label="Name"
          value={name || status.name}
          onChangeText={setName}
          maxLength={40}
        />

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {CATEGORY_ORDER.map((option) => {
            const active = category === option;
            return (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityLabel={option}
                accessibilityState={active ? { selected: true } : {}}
                onPress={() => setCategory(option)}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: t.radius.pill,
                  backgroundColor: active ? t.line.navActive : t.line.well,
                }}
              >
                <AppText
                  variant="hint"
                  style={{ color: active ? t.brand[600] : t.neutral[500] }}
                >
                  {option}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        <Button
          onPress={() =>
            void onRun(async () => {
              await updateStatusStatusesStatusIdPatch(status.id, {
                name: (name || status.name).trim(),
                category,
              });
              onClose();
            }, 'Could not save that status.')
          }
        >
          Save
        </Button>

        <Button variant="danger" onPress={onDelete}>
          Delete status
        </Button>
      </View>
    </Sheet>
  );
}
