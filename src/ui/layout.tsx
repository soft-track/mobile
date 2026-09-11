import { type ReactNode } from 'react';
import { useWindowDimensions, View } from 'react-native';

/**
 * Window size classes, matching the three columns of every mockup in
 * `docs/design/mobile/` and the Material breakpoints they are named after.
 */
export type SizeClass = 'compact' | 'medium' | 'expanded';

/** Phone. Single pane, bottom navigation. */
export const BREAKPOINT_MEDIUM = 600;
/** Unfolded foldable. Two panes split at the hinge, nav rail. */
export const BREAKPOINT_EXPANDED = 840;

/** Pure, so the boundaries can be tested without a renderer. */
export function sizeClassFor(width: number): SizeClass {
  if (width >= BREAKPOINT_EXPANDED) return 'expanded';
  if (width >= BREAKPOINT_MEDIUM) return 'medium';
  return 'compact';
}

export function useSizeClass(): SizeClass {
  return sizeClassFor(useWindowDimensions().width);
}

/** Medium and expanded show more than one pane and use a rail, not a tab bar. */
export function useIsMultiPane(): boolean {
  return useSizeClass() !== 'compact';
}

/**
 * The multi-pane container every screen builds on.
 *
 * Compact shows `primary` alone; medium adds `secondary` beside it; expanded
 * adds a persistent `sidebar` as well. Screens opt in by passing props, so the
 * later issues that introduce panes (#4 team creation, #5 the board) never have
 * to restructure `app/`.
 *
 * Note this splits at 50% rather than at a foldable's real hinge -- Android's
 * `WindowLayoutInfo` has no Expo module today, so true hinge geometry is not
 * available. For a two-pane split on a symmetric fold the result is the same.
 */
export function Panes({
  primary,
  secondary,
  sidebar,
  sidebarWidth = 240,
  gap = 0,
}: {
  primary: ReactNode;
  secondary?: ReactNode;
  sidebar?: ReactNode;
  sidebarWidth?: number;
  gap?: number;
}) {
  const size = useSizeClass();

  if (size === 'compact') return <>{primary}</>;

  const showSidebar = size === 'expanded' && Boolean(sidebar);
  const showSecondary = Boolean(secondary);

  return (
    <View style={{ flex: 1, flexDirection: 'row', gap }}>
      {showSidebar ? <View style={{ width: sidebarWidth }}>{sidebar}</View> : null}
      <View style={{ flex: 1 }}>{primary}</View>
      {showSecondary ? <View style={{ flex: 1 }}>{secondary}</View> : null}
    </View>
  );
}
