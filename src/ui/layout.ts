import { useWindowDimensions } from 'react-native';

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
