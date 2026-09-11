import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';

import { hydrateInstanceUrl } from '@/api/instance';
import { queryClient } from '@/api/query-client';
import { AuthProvider, useAuth } from '@/auth/auth-context';
import { hydrateSession } from '@/auth/session';
import { useDeepLinkCapture } from '@/auth/use-deep-link-capture';
import { hydrateActiveTeam, TeamProvider } from '@/team/team-context';
import { AppText, Button, Loading } from '@/ui/primitives';
import {
  hydrateTheme,
  ThemeProvider,
  useTheme,
  type ThemePreference,
} from '@/ui/theme';

/**
 * Hold the splash from module scope, not an effect.
 *
 * The web stamps `data-theme` in a synchronous script before first paint
 * (`frontend/index.html:54-69`). React Native has no pre-paint hook, so the
 * equivalent is to never paint before the theme is known: the native splash --
 * which the expo-splash-screen plugin already gives a dark variant -- stays up
 * until storage has been read. An effect would run after the first frame, which
 * is exactly the flash this avoids.
 */
void SplashScreen.preventAutoHideAsync();

type Hydrated = { theme: ThemePreference; teamKey: string | null };

function RootNavigator() {
  const { status } = useAuth();
  const { t } = useTheme();

  useDeepLinkCapture(status === 'signedOut');

  // The splash is still up while /auth/me decides, so render nothing rather
  // than a half-built shell.
  if (status === 'loading') return <Loading />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: t.canvas },
      }}
    >
      {/* Declarative guards rather than an imperative redirect: the router
          reacts to the session going away -- including when the 401 interceptor
          clears it -- so no navigation call is needed and a redirect loop is
          structurally impossible. */}
      <Stack.Protected guard={status !== 'signedOut'}>
        <Stack.Screen name="(app)" />
        {/* Pushed over the tabs rather than being tab destinations: both are
            things you enter from somewhere and come back from. */}
        <Stack.Screen name="issue/[id]" />
        <Stack.Screen name="new-issue" options={{ presentation: 'modal' }} />
      </Stack.Protected>
      <Stack.Protected guard={status === 'signedOut'}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>

      {/* Guarded by neither: an invitation has to be readable before you have
          an account, and a team link has to resolve once you do. Both decide
          for themselves what to do with the session they find. */}
      <Stack.Screen name="invite/[token]" />
      <Stack.Screen name="[teamKey]" />
    </Stack>
  );
}

/**
 * A reachability failure keeps the session and offers a retry.
 *
 * Signing the user out here -- which is what the web's
 * `Boolean(token) && Boolean(meQuery.data)` effectively does -- would destroy a
 * working session because a phone went through a tunnel, and demand the server
 * link, email and password again to get it back.
 */
function Unreachable() {
  const { retry, signOut } = useAuth();
  const { t } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: t.canvas,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        gap: 16,
      }}
    >
      <AppText variant="heading">Can&apos;t reach your instance</AppText>
      <AppText variant="muted" style={{ textAlign: 'center' }}>
        You are still signed in. Check your connection and try again.
      </AppText>
      <View style={{ alignSelf: 'stretch', gap: 8 }}>
        <Button onPress={retry}>Try again</Button>
        <Button variant="ghost" onPress={signOut}>
          Sign out
        </Button>
      </View>
    </View>
  );
}

function Themed({ children }: { children: React.ReactNode }) {
  const { theme, t } = useTheme();
  const splashHidden = useRef(false);

  // Paint the window itself, not just the React tree. Without this the native
  // background shows through during screen transitions as a white flash in dark
  // mode.
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(t.canvas);
  }, [t.canvas]);

  return (
    <View
      style={{ flex: 1, backgroundColor: t.canvas }}
      onLayout={() => {
        // onLayout fires on every resize -- a rotation, a fold -- so only the
        // first one means "the first themed frame is committed".
        if (splashHidden.current) return;
        splashHidden.current = true;
        void SplashScreen.hideAsync();
      }}
    >
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      {children}
    </View>
  );
}

function Gate() {
  const { status } = useAuth();
  return status === 'unreachable' ? <Unreachable /> : <RootNavigator />;
}

export default function RootLayout() {
  const [hydrated, setHydrated] = useState<Hydrated | null>(null);

  useEffect(() => {
    // One pass over persisted state before anything renders: the stored theme,
    // the instance URL, and the token -- each into its module-level mirror so
    // the axios interceptor can read them synchronously from the first request.
    void (async () => {
      const [theme, , , teamKey] = await Promise.all([
        hydrateTheme(),
        hydrateInstanceUrl(),
        hydrateSession(),
        hydrateActiveTeam(),
      ]);
      setHydrated({ theme, teamKey });
    })();
  }, []);

  if (!hydrated) return null;

  return (
    <ThemeProvider initialPreference={hydrated.theme}>
      {/* Required by react-native-gesture-handler, which the board's
          long-press-to-lift drag is built on. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <Themed>
            <QueryClientProvider client={queryClient}>
              <AuthProvider>
                <TeamProvider initialTeamKey={hydrated.teamKey}>
                  <Gate />
                </TeamProvider>
              </AuthProvider>
            </QueryClientProvider>
          </Themed>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ThemeProvider>
  );
}
