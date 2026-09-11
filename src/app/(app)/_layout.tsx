import { Tabs } from 'expo-router/js-tabs';

import { useIsMultiPane } from '@/ui/layout';
import { SoftTrackTabBar } from '@/ui/tab-bar';
import { useTokens } from '@/ui/theme';

/**
 * The signed-in shell: one navigator, five destinations, at every size class.
 *
 * `tabBarPosition` is the whole of the responsive switch. React Navigation reads
 * it from the focused screen's options and flips the navigator's own flex
 * direction, rendering the custom bar on the matching edge
 * (`react-navigation/bottom-tabs/views/BottomTabView.js`), so a phone gets a
 * bottom bar and anything wider gets the 76dp rail from the mockups without a
 * second navigator or a remount.
 *
 * The panes the wider mockups show -- a board preview at medium, sidebar plus
 * columns at expanded -- are screen-level concerns, not navigator ones. They
 * arrive via `Panes` inside the individual screens, so this file does not change
 * as later issues land.
 *
 * Route names here are lowercase, and team keys are uppercased by the backend
 * (`backend/lib_softtrack/teams.py:69`). That is what keeps a future
 * `[teamKey]` route at `/ENG` from ever colliding with `/board`.
 */
export default function AppLayout() {
  const t = useTokens();
  const rail = useIsMultiPane();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarPosition: rail ? 'left' : 'bottom',
        sceneStyle: { backgroundColor: t.canvas },
      }}
      tabBar={(props) => (
        <SoftTrackTabBar {...props} orientation={rail ? 'rail' : 'bar'} />
      )}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="board" options={{ title: 'Board' }} />
      <Tabs.Screen name="search" options={{ title: 'Search' }} />
      <Tabs.Screen name="inbox" options={{ title: 'Inbox' }} />
      <Tabs.Screen name="you" options={{ title: 'You' }} />
    </Tabs>
  );
}
