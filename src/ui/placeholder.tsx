import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useIsMultiPane } from '@/ui/layout';
import { AppText } from '@/ui/primitives';
import { useTokens } from '@/ui/theme';

/**
 * A destination whose screen belongs to a later issue.
 *
 * The five routes exist from the start because the navigation shell is what
 * this issue delivers -- the rail and the tab bar need somewhere real to
 * switch to, and a route that appears later would change the shell's shape.
 */
export function Placeholder({ title, issue }: { title: string; issue: number }) {
  const t = useTokens();
  const multiPane = useIsMultiPane();

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: t.canvas }}
      edges={multiPane ? ['top', 'bottom'] : ['top']}
    >
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 }}>
        <AppText variant="title">{title}</AppText>
        <AppText variant="muted" style={{ textAlign: 'center' }}>
          Arrives with issue #{issue}.
        </AppText>
      </View>
    </SafeAreaView>
  );
}
