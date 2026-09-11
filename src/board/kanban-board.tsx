import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  scrollTo,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';

import type { EstimateSummary, IssueRead, StatusRead } from '@/api/generated/models';
import { IssueCard } from '@/board/issue-card';
import {
  COLUMN_GAP,
  columnAt,
  columnWidth,
  edgeScrollStep,
  type ColumnBounds,
} from '@/board/column-layout';
import { COLLAPSED_CATEGORIES } from '@/issues/issue-meta';
import { Icon } from '@/ui/icon';
import { useSizeClass } from '@/ui/layout';
import { AppText } from '@/ui/primitives';
import { useTokens } from '@/ui/theme';

/** How long a press has to be held before the card lifts. */
const LIFT_MS = 250;

type Load = EstimateSummary['by_status'][string];

function ColumnHeader({
  status,
  count,
  load,
  collapsed,
  onToggle,
}: {
  status: StatusRead;
  count: number;
  load: Load | undefined;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const t = useTokens();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${collapsed ? 'Expand' : 'Collapse'} ${status.name}`}
      onPress={onToggle}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
      }}
    >
      <View
        style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: status.color }}
      />
      <AppText variant="label" numberOfLines={1} style={{ color: t.neutral[800] }}>
        {status.name}
      </AppText>
      <View
        style={{
          paddingHorizontal: 6,
          paddingVertical: 1,
          borderRadius: t.radius.pill,
          backgroundColor: t.line.well,
        }}
      >
        <AppText variant="identifier">{count}</AppText>
      </View>

      <View style={{ flex: 1 }} />

      {load && load.points > 0 ? (
        <AppText variant="identifier">
          {load.points} pts
          {/* An unsized issue is not worth zero, so say so rather than let the
              total read as complete. */}
          {load.unestimated_count > 0 ? ' +?' : ''}
        </AppText>
      ) : null}

      <Icon
        name="chevron-right"
        size={14}
        color={t.neutral[400]}
      />
    </Pressable>
  );
}

export function KanbanBoard({
  statuses,
  issues,
  estimates,
  onMove,
  onCardPress,
}: {
  statuses: StatusRead[];
  issues: IssueRead[];
  estimates: EstimateSummary | undefined;
  onMove: (issueId: number, status: StatusRead) => void;
  onCardPress: (issue: IssueRead) => void;
}) {
  const t = useTokens();
  const sizeClass = useSizeClass();

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollX = useSharedValue(0);
  const pointerX = useSharedValue(0);
  const pointerY = useSharedValue(0);
  const dragging = useSharedValue(false);

  const [boardWidth, setBoardWidth] = useState(0);
  const [boardOriginX, setBoardOriginX] = useState(0);
  const [lifted, setLifted] = useState<IssueRead | null>(null);
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(
      statuses
        .filter((status) => COLLAPSED_CATEGORIES.includes(status.category))
        .map((status) => [status.id, true]),
    ),
  );

  // Measured in content coordinates, which is what makes hit-testing survive
  // the strip being scrolled mid-drag.
  const bounds = useRef<ColumnBounds[]>([]);
  const boardRef = useRef<View>(null);

  const width = boardWidth > 0 ? columnWidth(sizeClass, boardWidth) : 0;

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollX.set(event.contentOffset.x);
  });

  // A card held still against an edge has to keep scrolling, which a
  // movement-driven handler would never do.
  const frame = useFrameCallback(() => {
    'worklet';
    if (!dragging.get()) return;
    const step = edgeScrollStep(pointerX.get(), boardOriginX, boardWidth);
    if (step !== 0) scrollTo(scrollRef, scrollX.get() + step, 0, false);
  }, false);

  /**
   * Pointer tracking lives here rather than in the card.
   *
   * The React Compiler treats every prop as immutable, so a card handed these
   * shared values could not write to them -- and routing each move through
   * runOnJS would put a bridge hop between the finger and the card. Passing
   * worklets down instead keeps the writes on the UI thread and in the scope
   * that owns the values.
   */
  const trackPointer = useCallback(
    (x: number, y: number) => {
      'worklet';
      pointerX.set(x);
      pointerY.set(y);
    },
    [pointerX, pointerY],
  );

  const setDragging = useCallback(
    (active: boolean) => {
      'worklet';
      dragging.set(active);
    },
    [dragging],
  );

  const beginDrag = useCallback(
    (issue: IssueRead) => {
      setLifted(issue);
      frame.setActive(true);
    },
    [frame],
  );

  const endDrag = useCallback(
    (issue: IssueRead, x: number) => {
      frame.setActive(false);
      setLifted(null);

      const targetId = columnAt(bounds.current, x, scrollX.get(), boardOriginX);
      const target = statuses.find((status) => status.id === targetId);
      // Dropping a card back where it started is not a move.
      if (target && target.id !== issue.status.id) onMove(issue.id, target);
    },
    [frame, scrollX, boardOriginX, statuses, onMove],
  );

  const overlayStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: pointerX.get() - boardOriginX - width / 2 },
      { translateY: pointerY.get() - 40 },
      { rotate: '2deg' },
    ],
  }));

  return (
    <View
      ref={boardRef}
      style={{ flex: 1 }}
      onLayout={() => {
        // Screen-space origin, so the gesture's absoluteX can be converted into
        // the content coordinates the columns were measured in.
        boardRef.current?.measureInWindow((x, _y, w) => {
          setBoardOriginX(x);
          setBoardWidth(w);
        });
      }}
    >
      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        // Snapping makes the phone's one-column-at-a-time strip land cleanly
        // rather than resting mid-gutter.
        snapToInterval={sizeClass === 'compact' ? width + COLUMN_GAP : undefined}
        contentContainerStyle={{ padding: COLUMN_GAP, gap: COLUMN_GAP }}
        // While a card is lifted the strip must not also pan under the finger.
        scrollEnabled={lifted === null}
      >
        {statuses.map((status, index) => {
          const columnIssues = issues.filter((issue) => issue.status.id === status.id);
          const load = estimates?.by_status?.[String(status.id)];
          const isCollapsed = collapsed[status.id] === true;

          return (
            <View
              key={status.id}
              accessibilityLabel={status.name}
              onLayout={(event) => {
                const { x, width: w } = event.nativeEvent.layout;
                bounds.current = [
                  ...bounds.current.filter((b) => b.statusId !== status.id),
                  { statusId: status.id, x, width: w },
                ];
              }}
              style={{
                width: isCollapsed ? 52 : width,
                backgroundColor: t.surface.subtle,
                borderRadius: t.radius.panel,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: t.line.hairline,
                overflow: 'hidden',
              }}
            >
              {isCollapsed ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Expand ${status.name}`}
                  onPress={() =>
                    setCollapsed((prev) => ({ ...prev, [status.id]: false }))
                  }
                  style={{ flex: 1, alignItems: 'center', paddingVertical: 12, gap: 8 }}
                >
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: status.color,
                    }}
                  />
                  <AppText variant="identifier">{columnIssues.length}</AppText>
                </Pressable>
              ) : (
                <>
                  <ColumnHeader
                    status={status}
                    count={columnIssues.length}
                    load={load}
                    collapsed={false}
                    onToggle={() =>
                      setCollapsed((prev) => ({ ...prev, [status.id]: true }))
                    }
                  />
                  <ScrollView
                    contentContainerStyle={{ padding: 8, paddingTop: 0, gap: 8 }}
                    showsVerticalScrollIndicator={false}
                  >
                    {columnIssues.map((issue) => (
                      <DraggableCard
                        key={issue.id}
                        issue={issue}
                        lifted={lifted?.id === issue.id}
                        trackPointer={trackPointer}
                        setDragging={setDragging}
                        onBegin={beginDrag}
                        onEnd={endDrag}
                        onPress={onCardPress}
                      />
                    ))}
                    {columnIssues.length === 0 ? (
                      <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                        <AppText variant="hint">Nothing here</AppText>
                      </View>
                    ) : null}
                  </ScrollView>
                </>
              )}
              {index === statuses.length - 1 ? null : null}
            </View>
          );
        })}
      </Animated.ScrollView>

      {/* The lifted card rides above every column, so it is not clipped by the
          one it came from. */}
      {lifted ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              width: width || 260,
              opacity: 0.95,
              shadowColor: '#000',
              shadowOpacity: 0.3,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 12 },
              elevation: 12,
            },
            overlayStyle,
          ]}
        >
          <IssueCard issue={lifted} />
        </Animated.View>
      ) : null}
    </View>
  );
}

function DraggableCard({
  issue,
  lifted,
  trackPointer,
  setDragging,
  onBegin,
  onEnd,
  onPress,
}: {
  issue: IssueRead;
  lifted: boolean;
  trackPointer: (x: number, y: number) => void;
  setDragging: (active: boolean) => void;
  onBegin: (issue: IssueRead) => void;
  onEnd: (issue: IssueRead, x: number) => void;
  onPress: (issue: IssueRead) => void;
}) {
  // One gesture rather than a long-press composed with a pan: activateAfterLongPress
  // is what lets the column keep scrolling vertically until the card actually
  // lifts, instead of the card swallowing every touch that starts on it.
  const pan = Gesture.Pan()
    .activateAfterLongPress(LIFT_MS)
    .onStart((event) => {
      setDragging(true);
      trackPointer(event.absoluteX, event.absoluteY);
      runOnJS(onBegin)(issue);
    })
    .onUpdate((event) => {
      trackPointer(event.absoluteX, event.absoluteY);
    })
    .onFinalize((event) => {
      setDragging(false);
      runOnJS(onEnd)(issue, event.absoluteX);
    });

  return (
    <GestureDetector gesture={pan}>
      {/* A tap is the non-drag route to the same move action, which is what
          makes the board usable without the gesture at all. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${issue.identifier} ${issue.title}`}
        onPress={() => onPress(issue)}
        style={{ opacity: lifted ? 0.35 : 1 }}
      >
        <IssueCard issue={issue} />
      </Pressable>
    </GestureDetector>
  );
}
