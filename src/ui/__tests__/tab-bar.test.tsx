import type * as React from 'react';
import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RAIL_WIDTH, SoftTrackTabBar } from '@/ui/tab-bar';
import { ThemeProvider } from '@/ui/theme';

/**
 * The size-class switch cannot be seen on this machine -- no Android SDK, so no
 * foldable or tablet emulator -- so the geometry from
 * `docs/design/mobile/138-app-foundation.svg` is asserted here instead.
 */

/** The bar reads safe-area insets, so it needs a provider with fixed metrics. */
const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const ROUTES = ['index', 'board', 'search', 'inbox', 'you'];
const TITLES: Record<string, string> = {
  index: 'Home',
  board: 'Board',
  search: 'Search',
  inbox: 'Inbox',
  you: 'You',
};

/** Only the slice of BottomTabBarProps the bar actually reads. */
type BarProps = Omit<React.ComponentProps<typeof SoftTrackTabBar>, 'orientation'>;

function tabBarProps(focusedIndex = 0): BarProps {
  return {
    state: {
      index: focusedIndex,
      routes: ROUTES.map((name) => ({ key: `${name}-key`, name, params: undefined })),
    },
    descriptors: Object.fromEntries(
      ROUTES.map((name) => [`${name}-key`, { options: { title: TITLES[name] } }]),
    ),
    navigation: { emit: () => ({ defaultPrevented: false }), navigate: jest.fn() },
  } as unknown as BarProps;
}

function renderBar(orientation: 'bar' | 'rail', focusedIndex = 0) {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider initialPreference="light">
        <SoftTrackTabBar {...tabBarProps(focusedIndex)} orientation={orientation} />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

describe('SoftTrackTabBar', () => {
  it('keeps the same five destinations in both orientations', async () => {
    for (const orientation of ['bar', 'rail'] as const) {
      const view = await renderBar(orientation);
      for (const title of Object.values(TITLES)) {
        expect(view.getByLabelText(title)).toBeTruthy();
      }
    }
  });

  it('lays out as a row along the bottom on a phone', async () => {
    const view = await renderBar('bar');
    const style = StyleSheet.flatten(view.getByTestId('tab-bar').props.style);

    expect(style.flexDirection).toBe('row');
    expect(style.width).toBeUndefined();
    expect(style.borderTopWidth).toBeGreaterThan(0);
    // Clears the home indicator.
    expect(style.paddingBottom).toBe(METRICS.insets.bottom);
  });

  it('lays out as a 76dp rail on anything wider', async () => {
    const view = await renderBar('rail');
    const style = StyleSheet.flatten(view.getByTestId('tab-bar').props.style);

    expect(style.width).toBe(RAIL_WIDTH);
    expect(style.flexDirection).toBeUndefined(); // column is the flex default
    expect(style.borderRightWidth).toBeGreaterThan(0);
    expect(style.borderTopWidth).toBeUndefined();
  });

  it('marks the focused destination as selected', async () => {
    const view = await renderBar('bar', 2); // Search
    expect(view.getByLabelText('Search').props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(view.getByLabelText('Home').props.accessibilityState ?? {}).not.toMatchObject({
      selected: true,
    });
  });
});
