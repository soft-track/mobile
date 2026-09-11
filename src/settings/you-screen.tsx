import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { instanceLabel } from '@/api/instance';
import { useAuth } from '@/auth/auth-context';
import { useIsMultiPane } from '@/ui/layout';
import { AppText, Avatar, Button, Card } from '@/ui/primitives';
import { ThemePreferenceControl } from '@/ui/theme-control';
import { useTokens } from '@/ui/theme';

/**
 * The You destination, per `docs/design/mobile/152-settings.svg`.
 *
 * Deliberately minimal -- issue #15 owns real account settings. What is here is
 * what makes issue #1's acceptance criteria exercisable from the running app:
 * the theme control, the connected instance, and sign out.
 */
export function YouScreen() {
  const t = useTokens();
  const multiPane = useIsMultiPane();
  const { user, instanceUrl, signOut } = useAuth();

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: t.canvas }}
      edges={multiPane ? ['top', 'bottom'] : ['top']}
    >
      <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
        <AppText variant="title">You</AppText>

        {user ? (
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 }}>
            <Avatar name={user.full_name} color={user.avatar_color} />
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="heading" numberOfLines={1}>
                {user.full_name}
              </AppText>
              <AppText variant="muted" numberOfLines={1}>
                @{user.username}
              </AppText>
            </View>
          </Card>
        ) : null}

        <View style={{ gap: 8 }}>
          <AppText variant="eyebrow">APPEARANCE</AppText>
          <ThemePreferenceControl />
        </View>

        <View style={{ gap: 8 }}>
          <AppText variant="eyebrow">INSTANCE</AppText>
          <Card style={{ padding: 16, gap: 4 }}>
            <AppText variant="body">
              {instanceUrl ? instanceLabel(instanceUrl) : 'Not connected'}
            </AppText>
            <AppText variant="hint">
              Switching instances arrives with the settings work.
            </AppText>
          </Card>
        </View>

        <Button variant="danger" onPress={signOut}>
          Sign out
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}
