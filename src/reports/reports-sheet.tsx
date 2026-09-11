import { useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';

import { useListCyclesTeamsTeamIdCyclesGet } from '@/api/generated/endpoints/cycles/cycles';
import {
  useCycleBurndownCyclesCycleIdBurndownGet,
  useTeamCreatedVsResolvedTeamsTeamIdCreatedVsResolvedGet,
  useTeamCumulativeFlowTeamsTeamIdCumulativeFlowGet,
  useTeamVelocityTeamsTeamIdVelocityGet,
} from '@/api/generated/endpoints/reports/reports';
import type { StatusCategory, TeamRead } from '@/api/generated/models';
import {
  Axes,
  Bars,
  Chart,
  Legend,
  Marker,
  makeScale,
  Series,
  StackedAreas,
  useProbe,
} from '@/reports/chart';
import { AppText, Card, Loading } from '@/ui/primitives';
import { Sheet } from '@/ui/sheet';
import { useTokens } from '@/ui/theme';

/**
 * The four reports, per `docs/design/mobile/150-reports.svg`.
 *
 * Every number comes from the same event-history endpoints the web charts, so
 * the figures match rather than being recomputed here. Portrait-first: one chart
 * per row, full width, with a tap-anywhere readout instead of a hover tooltip.
 */
const CATEGORY_ORDER: StatusCategory[] = [
  'backlog',
  'unstarted',
  'started',
  'done',
  'cancelled',
];

/** `2026-01-06` -> `6 Jan`, which is all the axis has room for. */
function shortDay(day: string): string {
  const parsed = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return day;
  return `${parsed.getUTCDate()} ${parsed.toLocaleString('en', { month: 'short', timeZone: 'UTC' })}`;
}

export function ReportsSheet({
  visible,
  onClose,
  team,
}: {
  visible: boolean;
  onClose: () => void;
  team: TeamRead;
}) {
  const t = useTokens();
  const { width: screenWidth } = useWindowDimensions();
  const width = Math.min(screenWidth, 520) - 72;

  const cycles = useListCyclesTeamsTeamIdCyclesGet(team.id, { query: { enabled: visible } });
  const [cycleId, setCycleId] = useState<number | null>(null);

  // Whichever cycle is running, else the most recent one -- a burndown of
  // nothing is not worth the screen.
  const chosenCycle =
    cycleId ??
    (cycles.data ?? []).find((cycle) => cycle.state === 'active')?.id ??
    (cycles.data ?? [])[0]?.id ??
    null;

  return (
    <Sheet visible={visible} onClose={onClose} title="Reports">
      <View style={{ gap: 22, paddingBottom: 16 }}>
        {/* The same notice the web shows: nothing can be drawn for the period
            before the instance started recording history. */}
        <AppText variant="hint">
          Charts are drawn from recorded history. Anything that happened before
          this instance began tracking cannot be reconstructed.
        </AppText>

        {cycles.isPending ? <Loading /> : null}

        <BurndownChart cycleId={chosenCycle} width={width} />

        {(cycles.data ?? []).length > 1 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {(cycles.data ?? []).map((cycle) => {
              const active = chosenCycle === cycle.id;
              return (
                <Pressable
                  key={cycle.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Burndown for ${cycle.display_name}`}
                  accessibilityState={active ? { selected: true } : {}}
                  onPress={() => setCycleId(cycle.id)}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: t.radius.pill,
                    backgroundColor: active ? t.line.navActive : t.line.well,
                  }}
                >
                  <AppText
                    variant="hint"
                    style={{ color: active ? t.brand[600] : t.neutral[500] }}
                  >
                    {cycle.display_name}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <VelocityChart teamId={team.id} width={width} />
        <FlowChart teamId={team.id} width={width} />
        <CreatedResolvedChart teamId={team.id} width={width} />
      </View>
    </Sheet>
  );
}

function BurndownChart({ cycleId, width }: { cycleId: number | null; width: number }) {
  const t = useTokens();
  const probe = useProbe();
  const burndown = useCycleBurndownCyclesCycleIdBurndownGet(cycleId ?? 0, {
    query: { enabled: cycleId !== null },
  });

  const points = burndown.data?.points ?? [];
  if (cycleId === null || points.length === 0) {
    return <Empty title="Burndown" reason="No cycle to burn down yet." />;
  }

  const remaining = points.map((point) => point.points_remaining);
  const ideal = points.map((point) => point.ideal_remaining);
  const max = Math.max(...remaining, ...ideal, 1);
  const scale = makeScale(width, points.length, max);
  const at = probe.index !== null ? points[probe.index] : null;

  return (
    <Chart
      title={`Burndown · ${burndown.data?.cycle_name ?? ''}`}
      count={points.length}
      width={width}
      onProbe={probe.setIndex}
      readout={
        at ? (
          <AppText variant="hint">
            {shortDay(at.day)} · {at.points_remaining} remaining of {at.points_total}
            {' · ideal '}
            {Math.round(at.ideal_remaining)}
          </AppText>
        ) : (
          <Legend
            items={[
              { label: 'Remaining', color: t.brand[600] },
              { label: 'Ideal', color: t.neutral[300] },
            ]}
          />
        )
      }
    >
      <Axes scale={scale} />
      <Series values={ideal} scale={scale} color={t.neutral[300]} dashed />
      <Series values={remaining} scale={scale} color={t.brand[600]} />
      {at && probe.index !== null ? (
        <Marker
          index={probe.index}
          value={at.points_remaining}
          scale={scale}
          color={t.brand[600]}
        />
      ) : null}
    </Chart>
  );
}

function VelocityChart({ teamId, width }: { teamId: number; width: number }) {
  const t = useTokens();
  const probe = useProbe();
  const velocity = useTeamVelocityTeamsTeamIdVelocityGet(teamId);

  const cycles = velocity.data?.cycles ?? [];
  if (cycles.length === 0) {
    return <Empty title="Velocity" reason="No completed cycles yet." />;
  }

  const committed = cycles.map((cycle) => cycle.points_committed);
  const completed = cycles.map((cycle) => cycle.points_completed);
  const scale = makeScale(width, cycles.length, Math.max(...committed, ...completed, 1));
  const at = probe.index !== null ? cycles[probe.index] : null;

  return (
    <Chart
      title="Velocity"
      subtitle={
        velocity.data?.average_points != null
          ? `Averaging ${Math.round(velocity.data.average_points)} points a cycle`
          : undefined
      }
      count={cycles.length}
      width={width}
      onProbe={probe.setIndex}
      readout={
        at ? (
          <AppText variant="hint">
            {at.cycle_name} · {at.points_completed} delivered of {at.points_committed}{' '}
            committed
          </AppText>
        ) : (
          <Legend
            items={[
              { label: 'Committed', color: t.neutral[300] },
              { label: 'Delivered', color: t.status.done },
            ]}
          />
        )
      }
    >
      <Axes scale={scale} />
      <Bars values={committed} scale={scale} color={t.neutral[300]} slots={2} offset={0} />
      <Bars values={completed} scale={scale} color={t.status.done} slots={2} offset={1} />
    </Chart>
  );
}

function FlowChart({ teamId, width }: { teamId: number; width: number }) {
  const t = useTokens();
  const probe = useProbe();
  const flow = useTeamCumulativeFlowTeamsTeamIdCumulativeFlowGet(teamId);

  const days = flow.data?.days ?? [];
  if (days.length === 0) {
    return <Empty title="Cumulative flow" reason="No history recorded yet." />;
  }

  const colorFor: Record<StatusCategory, string> = {
    backlog: t.status.backlog,
    unstarted: t.status.todo,
    started: t.status.progress,
    done: t.status.done,
    cancelled: t.status.cancelled,
  };

  const series = CATEGORY_ORDER.map((category) => ({
    color: colorFor[category],
    values: days.map((day) => day.counts[category] ?? 0),
  }));

  const totals = days.map((day) =>
    CATEGORY_ORDER.reduce((sum, category) => sum + (day.counts[category] ?? 0), 0),
  );
  const scale = makeScale(width, days.length, Math.max(...totals, 1));
  const at = probe.index !== null ? days[probe.index] : null;

  return (
    <Chart
      title="Cumulative flow"
      count={days.length}
      width={width}
      onProbe={probe.setIndex}
      readout={
        at ? (
          <AppText variant="hint">
            {shortDay(at.day)} ·{' '}
            {CATEGORY_ORDER.filter((category) => (at.counts[category] ?? 0) > 0)
              .map((category) => `${category} ${at.counts[category]}`)
              .join(', ')}
          </AppText>
        ) : (
          <Legend
            items={CATEGORY_ORDER.map((category) => ({
              label: category,
              color: colorFor[category],
            }))}
          />
        )
      }
    >
      <Axes scale={scale} />
      <StackedAreas series={series} scale={scale} />
    </Chart>
  );
}

function CreatedResolvedChart({ teamId, width }: { teamId: number; width: number }) {
  const t = useTokens();
  const probe = useProbe();
  const report = useTeamCreatedVsResolvedTeamsTeamIdCreatedVsResolvedGet(teamId);

  const days = report.data?.days ?? [];
  if (days.length === 0) {
    return <Empty title="Created vs resolved" reason="No history recorded yet." />;
  }

  const created = days.map((day) => day.created);
  const resolved = days.map((day) => day.resolved);
  const scale = makeScale(width, days.length, Math.max(...created, ...resolved, 1));
  const at = probe.index !== null ? days[probe.index] : null;

  return (
    <Chart
      title="Created vs resolved"
      subtitle={`${report.data?.total_created ?? 0} created, ${
        report.data?.total_resolved ?? 0
      } resolved`}
      count={days.length}
      width={width}
      onProbe={probe.setIndex}
      readout={
        at ? (
          <AppText variant="hint">
            {shortDay(at.day)} · {at.created} created, {at.resolved} resolved ·{' '}
            {at.open_at_end_of_day} open
          </AppText>
        ) : (
          <Legend
            items={[
              { label: 'Created', color: t.priority.medium },
              { label: 'Resolved', color: t.status.done },
            ]}
          />
        )
      }
    >
      <Axes scale={scale} />
      <Series values={created} scale={scale} color={t.priority.medium} />
      <Series values={resolved} scale={scale} color={t.status.done} />
    </Chart>
  );
}

function Empty({ title, reason }: { title: string; reason: string }) {
  return (
    <View style={{ gap: 6 }}>
      <AppText variant="label">{title}</AppText>
      <Card style={{ padding: 16 }}>
        <AppText variant="muted">{reason}</AppText>
      </Card>
    </View>
  );
}
