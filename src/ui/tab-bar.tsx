import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from 'expo-router/js-tabs';

import { useUnreadCountNotificationsUnreadCountGet } from '@/api/generated/endpoints/notifications/notifications';
import { Icon, type IconName } from '@/ui/icon';
import { useTokens } from '@/ui/theme';

/**
 * The five persistent destinations, laid out as a bottom bar on a phone and as
 * a 76dp rail on anything wider -- see `docs/design/mobile/138-app-foundation.svg`,
 * where the same five entries follow the layout across all three size classes.
 *
 * One renderer for both orientations on purpose: React Navigation's
 * `tabBarPosition` flips the navigator's own flex direction and hands the custom
 * bar to whichever edge it belongs on, so nothing remounts when a foldable opens
 * and the destinations keep their identity and order.
 */

/** Rail width from the mockup. */
export const RAIL_WIDTH = 76;

const ICONS: Record<string, IconName> = {
  index: 'home',
  board: 'board',
  search: 'search',
  inbox: 'bell',
  you: 'users',
};

export function SoftTrackTabBar({
  state,
  descriptors,
  navigation,
  orientation,
}: BottomTabBarProps & { orientation: 'bar' | 'rail' }) {
  const t = useTokens();
  const insets = useSafeAreaInsets();
  const rail = orientation === 'rail';

  /**
   * The unread badge.
   *
   * Polled rather than pushed, at the same minute the web uses, and only while
   * the app is in front -- there is no realtime channel, and a phone that polls
   * in the background is a phone with a flat battery. Real push needs a backend
   * that can register device tokens; see the README.
   */
  const unread = useUnreadCountNotificationsUnreadCountGet({
    query: { refetchInterval: 60_000, refetchIntervalInBackground: false },
  });
  const unreadCount = unread.data?.unread ?? 0;

  return (
    <View
      testID="tab-bar"
      style={[
        {
          backgroundColor: t.surface.menu,
          borderColor: t.line.hairline,
        },
        rail
          ? {
              width: RAIL_WIDTH,
              paddingTop: insets.top + 12,
              paddingBottom: insets.bottom + 12,
              borderRightWidth: StyleSheet.hairlineWidth,
              gap: 4,
            }
          : {
              flexDirection: 'row',
              paddingBottom: insets.bottom,
              paddingTop: 8,
              borderTopWidth: StyleSheet.hairlineWidth,
            },
      ]}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;
        const label = options.title ?? route.name;
        const color = focused ? t.brand[600] : t.neutral[400];

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={label}
            style={{
              flex: rail ? 0 : 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 6,
              gap: 3,
            }}
          >
            <View
              style={{
                width: 40,
                height: 26,
                borderRadius: t.radius.pill,
                alignItems: 'center',
                justifyContent: 'center',
                // .nav-item[data-active] -- brand-500 at 14%
                backgroundColor: focused ? t.line.navActive : 'transparent',
              }}
            >
              <Icon name={ICONS[route.name] ?? 'board'} size={20} color={color} />

              {route.name === 'inbox' && unreadCount > 0 ? (
                <View
                  accessibilityLabel={`${unreadCount} unread`}
                  style={{
                    position: 'absolute',
                    top: -2,
                    right: 4,
                    minWidth: 16,
                    height: 16,
                    paddingHorizontal: 4,
                    borderRadius: 8,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: t.danger[500],
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#ffffff' }}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text
              numberOfLines={1}
              style={{ fontSize: 11, fontWeight: focused ? '600' : '500', color }}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
