import { useState } from 'react';
import { Alert as RNAlert, Pressable, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import {
  completeCycleCyclesCycleIdCompletePost,
  createCycleTeamsTeamIdCyclesPost,
  deleteCycleCyclesCycleIdDelete,
  startCycleCyclesCycleIdStartPost,
  updateCycleCyclesCycleIdPatch,
  useListCyclesTeamsTeamIdCyclesGet,
} from '@/api/generated/endpoints/cycles/cycles';
import type { CycleRead, TeamRead } from '@/api/generated/models';
import { errorDetail } from '@/api/errors';
import { Icon } from '@/ui/icon';
import { Alert, AppText, Button, Card, Field, Loading } from '@/ui/primitives';
import { Sheet } from '@/ui/sheet';
import { useTokens } from '@/ui/theme';

/**
 * Cycles, per `docs/design/mobile/149-cycles.svg`.
 *
 * Progress is reported by the server, unsized issues included as their own
 * count: a cycle whose points total looks complete while three issues were never
 * sized is not finished, and saying so is the whole reason that field exists.
 */

/** `YYYY-MM-DD` is what the API takes, and what a date field can produce. */
function isoDate(value: string): string | null {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const parsed = new Date(`${trimmed}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : trimmed;
}

function stateLabel(state: CycleRead['state']): string {
  return state === 'active' ? 'Active' : state === 'upcoming' ? 'Upcoming' : 'Completed';
}

function CycleCard({
  cycle,
  onManage,
}: {
  cycle: CycleRead;
  onManage: (cycle: CycleRead) => void;
}) {
  const t = useTokens();
  const { progress } = cycle;
  const done = progress.issues_total > 0 ? progress.issues_completed / progress.issues_total : 0;

  const color =
    cycle.state === 'active'
      ? t.status.progress
      : cycle.state === 'upcoming'
        ? t.status.todo
        : t.status.done;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${cycle.display_name}, ${stateLabel(cycle.state)}`}
      onPress={() => onManage(cycle)}
    >
      <Card style={{ padding: 14, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
          <AppText variant="heading" numberOfLines={1} style={{ flex: 1 }}>
            {cycle.display_name}
          </AppText>
          <AppText variant="hint">{stateLabel(cycle.state)}</AppText>
        </View>

        <AppText variant="hint">
          {cycle.starts_at.slice(0, 10)} → {cycle.ends_at.slice(0, 10)}
        </AppText>

        <View
          style={{
            height: 6,
            borderRadius: 3,
            backgroundColor: t.line.well,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              width: `${Math.round(done * 100)}%`,
              height: 6,
              backgroundColor: color,
            }}
          />
        </View>

        <AppText variant="hint">
          {progress.issues_completed}/{progress.issues_total} issues ·{' '}
          {progress.points_completed}/{progress.points_total} pts
          {/* An unsized issue is not worth zero points, so the total is not the
              whole story until this is nothing. */}
          {progress.issues_unestimated > 0
            ? ` · ${progress.issues_unestimated} unsized`
            : ''}
        </AppText>
      </Card>
    </Pressable>
  );
}

export function CyclesSheet({
  visible,
  onClose,
  team,
}: {
  visible: boolean;
  onClose: () => void;
  team: TeamRead;
}) {
  const queryClient = useQueryClient();
  const cycles = useListCyclesTeamsTeamIdCyclesGet(team.id, { query: { enabled: visible } });

  const [managing, setManaging] = useState<CycleRead | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const items = cycles.data ?? [];

  async function run(action: () => Promise<void>, fallback: string) {
    setError(null);
    setBusy(true);
    try {
      await action();
      await queryClient.invalidateQueries({ queryKey: [`/teams/${team.id}/cycles`] });
      // A cycle boundary moves issues, so the board has to re-read too.
      void queryClient.invalidateQueries({ queryKey: [`/teams/${team.id}/issues`] });
    } catch (err) {
      setError(errorDetail(err, fallback));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Cycles">
      <View style={{ gap: 10, paddingBottom: 12 }}>
        {error ? <Alert>{error}</Alert> : null}

        {cycles.isPending ? <Loading /> : null}

        {items.map((cycle) => (
          <CycleCard key={cycle.id} cycle={cycle} onManage={setManaging} />
        ))}

        {items.length === 0 && !cycles.isPending ? (
          <AppText variant="muted" style={{ paddingVertical: 8 }}>
            No cycles yet.
          </AppText>
        ) : null}

        <Button variant="ghost" onPress={() => setCreating(true)}>
          + New cycle
        </Button>
      </View>

      <NewCycleSheet
        visible={creating}
        teamId={team.id}
        busy={busy}
        onClose={() => setCreating(false)}
        onRun={run}
      />

      <ManageCycleSheet
        cycle={managing}
        busy={busy}
        onClose={() => setManaging(null)}
        onRun={run}
      />
    </Sheet>
  );
}

function NewCycleSheet({
  visible,
  teamId,
  busy,
  onClose,
  onRun,
}: {
  visible: boolean;
  teamId: number;
  busy: boolean;
  onClose: () => void;
  onRun: (action: () => Promise<void>, fallback: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [starts, setStarts] = useState('');
  const [ends, setEnds] = useState('');
  const [invalid, setInvalid] = useState<string | null>(null);

  if (!visible) return null;

  return (
    <Sheet visible onClose={onClose} title="New cycle">
      <View style={{ gap: 12, paddingBottom: 12 }}>
        {invalid ? <Alert>{invalid}</Alert> : null}

        <Field
          label="Name (optional)"
          value={name}
          onChangeText={setName}
          placeholder="Left blank, it is numbered for you"
        />
        <Field
          label="Starts"
          value={starts}
          onChangeText={setStarts}
          placeholder="2026-01-06"
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
        />
        <Field
          label="Ends"
          value={ends}
          onChangeText={setEnds}
          placeholder="2026-01-20"
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
        />

        <Button
          loading={busy}
          onPress={() => {
            const from = isoDate(starts);
            const to = isoDate(ends);
            if (!from || !to) {
              setInvalid('Dates need to look like 2026-01-06.');
              return;
            }
            if (from > to) {
              setInvalid('A cycle cannot end before it starts.');
              return;
            }
            setInvalid(null);
            void onRun(async () => {
              await createCycleTeamsTeamIdCyclesPost(teamId, {
                name: name.trim() || null,
                starts_at: from,
                ends_at: to,
              });
              setName('');
              setStarts('');
              setEnds('');
              onClose();
            }, 'Could not create the cycle.');
          }}
        >
          Create cycle
        </Button>
      </View>
    </Sheet>
  );
}

function ManageCycleSheet({
  cycle,
  busy,
  onClose,
  onRun,
}: {
  cycle: CycleRead | null;
  busy: boolean;
  onClose: () => void;
  onRun: (action: () => Promise<void>, fallback: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  if (!cycle) return null;

  return (
    <Sheet visible onClose={onClose} title={cycle.display_name}>
      <View style={{ gap: 12, paddingBottom: 12 }}>
        <Field
          label="Name"
          value={name || cycle.name || ''}
          onChangeText={setName}
          placeholder={cycle.display_name}
        />
        <Button
          variant="ghost"
          onPress={() =>
            void onRun(async () => {
              await updateCycleCyclesCycleIdPatch(cycle.id, {
                name: (name || cycle.name || '').trim() || null,
              });
              onClose();
            }, 'Could not rename the cycle.')
          }
        >
          Rename
        </Button>

        {cycle.state === 'upcoming' ? (
          <Button
            loading={busy}
            onPress={() =>
              void onRun(async () => {
                await startCycleCyclesCycleIdStartPost(cycle.id);
                onClose();
              }, 'Could not start the cycle.')
            }
          >
            Start cycle
          </Button>
        ) : null}

        {cycle.state === 'active' ? (
          <Button
            loading={busy}
            onPress={() =>
              void onRun(async () => {
                const result = await completeCycleCyclesCycleIdCompletePost(cycle.id);
                onClose();
                // The server decides where unfinished work goes; reporting the
                // count is the point, because "completed" otherwise looks like
                // those issues were finished.
                RNAlert.alert(
                  `${result.cycle.display_name} completed`,
                  result.carried_over === 0
                    ? 'Everything in it was finished.'
                    : result.carried_into_cycle_id
                      ? `${result.carried_over} unfinished issue${
                          result.carried_over === 1 ? '' : 's'
                        } moved to the next cycle.`
                      : `${result.carried_over} unfinished issue${
                          result.carried_over === 1 ? '' : 's'
                        } moved back to the backlog.`,
                );
              }, 'Could not complete the cycle.')
            }
          >
            Complete cycle
          </Button>
        ) : null}

        <Button
          variant="danger"
          onPress={() =>
            RNAlert.alert(
              `Delete ${cycle.display_name}?`,
              'Issues in it return to no cycle. This cannot be undone.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () =>
                    void onRun(async () => {
                      await deleteCycleCyclesCycleIdDelete(cycle.id);
                      onClose();
                    }, 'Could not delete the cycle.'),
                },
              ],
            )
          }
        >
          Delete cycle
        </Button>
      </View>
    </Sheet>
  );
}

/** The current cycle, shown above the board while one is running. */
export function CycleBanner({ team, onOpen }: { team: TeamRead; onOpen: () => void }) {
  const t = useTokens();
  const cycles = useListCyclesTeamsTeamIdCyclesGet(team.id);
  const active = (cycles.data ?? []).find((cycle) => cycle.state === 'active');
  if (!active) return null;

  const { progress } = active;
  const done =
    progress.issues_total > 0 ? progress.issues_completed / progress.issues_total : 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${active.display_name}, ${Math.round(done * 100)}% done`}
      onPress={onOpen}
      style={{
        marginHorizontal: 12,
        marginBottom: 8,
        padding: 10,
        borderRadius: t.radius.control,
        backgroundColor: t.line.well,
        gap: 6,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <AppText variant="label" style={{ flex: 1 }}>
          {active.display_name}
        </AppText>
        <AppText variant="hint">
          {progress.issues_completed}/{progress.issues_total}
          {progress.issues_unestimated > 0 ? ` · ${progress.issues_unestimated} unsized` : ''}
        </AppText>
        <Icon name="chevron-right" size={14} color={t.neutral[400]} />
      </View>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: t.surface.card, overflow: 'hidden' }}>
        <View
          style={{
            width: `${Math.round(done * 100)}%`,
            height: 4,
            backgroundColor: t.status.progress,
          }}
        />
      </View>
    </Pressable>
  );
}
