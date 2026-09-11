import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { AppText } from '@/ui/primitives';
import { useTokens } from '@/ui/theme';

/**
 * The chart primitives the four reports are drawn with.
 *
 * Hand-drawn in react-native-svg, which is already here for the icon set, rather
 * than pulling in a charting library: four fixed chart shapes need a fraction of
 * what one provides, and tapping for a value is easier to get right on a touch
 * screen when the hit areas are ours.
 */
export const CHART_HEIGHT = 180;
const PADDING = { top: 12, right: 12, bottom: 22, left: 34 };

export type Scale = {
  x: (index: number) => number;
  y: (value: number) => number;
  width: number;
  height: number;
  innerWidth: number;
  innerHeight: number;
};

export function makeScale(width: number, count: number, max: number): Scale {
  const innerWidth = Math.max(1, width - PADDING.left - PADDING.right);
  const innerHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  const steps = Math.max(1, count - 1);
  const top = max <= 0 ? 1 : max;

  return {
    x: (index) => PADDING.left + (index / steps) * innerWidth,
    y: (value) => PADDING.top + innerHeight - (value / top) * innerHeight,
    width,
    height: CHART_HEIGHT,
    innerWidth,
    innerHeight,
  };
}

export function linePath(values: number[], scale: Scale): string {
  if (values.length === 0) return '';
  return values
    .map((value, index) => `${index === 0 ? 'M' : 'L'}${scale.x(index)},${scale.y(value)}`)
    .join(' ');
}

/**
 * A chart with a title, an optional note, and a tap-anywhere readout.
 *
 * `onProbe` receives the index nearest the touch, because a fingertip covers
 * several days at this width and asking someone to hit an exact point would
 * make the values unreachable.
 */
export function Chart({
  title,
  subtitle,
  count,
  width,
  onProbe,
  readout,
  children,
}: {
  title: string;
  subtitle?: string;
  count: number;
  width: number;
  onProbe: (index: number | null) => void;
  readout?: ReactNode;
  children: ReactNode;
}) {
  const t = useTokens();

  return (
    <View style={{ gap: 6 }}>
      <AppText variant="label">{title}</AppText>
      {subtitle ? <AppText variant="hint">{subtitle}</AppText> : null}

      <Pressable
        accessibilityRole="adjustable"
        accessibilityLabel={title}
        onPressOut={() => onProbe(null)}
        onPress={(event) => {
          const x = event.nativeEvent.locationX;
          const steps = Math.max(1, count - 1);
          const innerWidth = Math.max(1, width - PADDING.left - PADDING.right);
          const ratio = (x - PADDING.left) / innerWidth;
          onProbe(Math.max(0, Math.min(count - 1, Math.round(ratio * steps))));
        }}
        style={{
          height: CHART_HEIGHT,
          backgroundColor: t.surface.card,
          borderRadius: t.radius.card,
        }}
      >
        <Svg width={width} height={CHART_HEIGHT}>
          {children}
        </Svg>
      </Pressable>

      {/* Reserved rather than conditional, so the layout does not jump as a
          finger moves across the chart. */}
      <View style={{ minHeight: 18 }}>{readout}</View>
    </View>
  );
}

export function Axes({ scale }: { scale: Scale }) {
  const t = useTokens();
  return (
    <>
      <Line
        x1={PADDING.left}
        y1={PADDING.top}
        x2={PADDING.left}
        y2={PADDING.top + scale.innerHeight}
        stroke={t.line.hairline}
        strokeWidth={1}
      />
      <Line
        x1={PADDING.left}
        y1={PADDING.top + scale.innerHeight}
        x2={PADDING.left + scale.innerWidth}
        y2={PADDING.top + scale.innerHeight}
        stroke={t.line.hairline}
        strokeWidth={1}
      />
    </>
  );
}

export function Series({
  values,
  scale,
  color,
  dashed = false,
}: {
  values: number[];
  scale: Scale;
  color: string;
  dashed?: boolean;
}) {
  return (
    <Path
      d={linePath(values, scale)}
      stroke={color}
      strokeWidth={2}
      fill="none"
      strokeDasharray={dashed ? '4 4' : undefined}
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  );
}

export function Marker({
  index,
  value,
  scale,
  color,
}: {
  index: number;
  value: number;
  scale: Scale;
  color: string;
}) {
  return <Circle cx={scale.x(index)} cy={scale.y(value)} r={4} fill={color} />;
}

export function Bars({
  values,
  scale,
  color,
  offset = 0,
  slots = 1,
}: {
  values: number[];
  scale: Scale;
  color: string;
  offset?: number;
  slots?: number;
}) {
  const groupWidth = scale.innerWidth / Math.max(1, values.length);
  const barWidth = Math.max(2, (groupWidth * 0.7) / slots);
  const base = scale.y(0);

  return (
    <>
      {values.map((value, index) => {
        const top = scale.y(value);
        const left =
          PADDING.left + index * groupWidth + groupWidth * 0.15 + offset * barWidth;
        return (
          <Rect
            key={index}
            x={left}
            y={Math.min(top, base)}
            width={barWidth}
            height={Math.max(1, Math.abs(base - top))}
            fill={color}
            rx={2}
          />
        );
      })}
    </>
  );
}

/** Stacked areas, for the cumulative flow diagram. */
export function StackedAreas({
  series,
  scale,
}: {
  series: { values: number[]; color: string }[];
  scale: Scale;
}) {
  const running = series.length > 0 ? series[0].values.map(() => 0) : [];

  return (
    <>
      {series.map((layer, layerIndex) => {
        const lower = [...running];
        layer.values.forEach((value, index) => {
          running[index] += value;
        });
        const upper = [...running];

        const forward = upper
          .map((value, index) => `${index === 0 ? 'M' : 'L'}${scale.x(index)},${scale.y(value)}`)
          .join(' ');
        const back = lower
          .map((value, index) => `L${scale.x(lower.length - 1 - index)},${scale.y(lower[lower.length - 1 - index])}`)
          .join(' ');

        return (
          <Path
            key={layerIndex}
            d={`${forward} ${back} Z`}
            fill={layer.color}
            fillOpacity={0.85}
          />
        );
      })}
    </>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {items.map((item) => (
        <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View
            style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: item.color }}
          />
          <AppText variant="hint">{item.label}</AppText>
        </View>
      ))}
    </View>
  );
}

/** Hook for the shared "which point is being probed" state. */
export function useProbe() {
  const [index, setIndex] = useState<number | null>(null);
  return { index, setIndex };
}
