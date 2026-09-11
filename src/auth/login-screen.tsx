import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { errorDetail, formatDuration, retryAfterSeconds } from '@/api/errors';
import {
  getInstanceUrl,
  instanceLabel,
  normalizeInstanceUrl,
  probeInstance,
  type InstanceConfig,
} from '@/api/instance';
import { useAuth } from '@/auth/auth-context';
import { DEMO_EMAIL, DEMO_PASSWORD } from '@/auth/demo';
import { takeDestination } from '@/auth/pending-destination';
import { useDebouncedValue } from '@/ui/use-debounced-value';
import { href } from '@/ui/href';
import { useIsMultiPane } from '@/ui/layout';
import { Alert, AppText, Button, Card, Field, Logo } from '@/ui/primitives';
import { useTokens } from '@/ui/theme';

/**
 * Sign in, per `docs/design/mobile/139-login.svg`.
 *
 * Three inputs, because an instance is wherever the user self-hosts it. The
 * identity field is an EMAIL despite the mockup's "Username / amina": the
 * backend resolves the OAuth2 `username` field with `find_user_by_email` and has
 * no username lookup at all (`backend/lib_identity/identity.py:170`), so a
 * "Username" label would promise something that always fails.
 *
 * State is plain `useState` with a local error/submitting pair, matching
 * `frontend/src/auth/LoginPage.tsx` -- the web uses no form library and neither
 * does this.
 */

/** How long to wait after typing stops before probing the entered link. */
const PROBE_DEBOUNCE_MS = 600;

export function LoginScreen() {
  const t = useTokens();
  const { signIn } = useAuth();
  const multiPane = useIsMultiPane();

  const [server, setServer] = useState(getInstanceUrl() ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /**
   * The instance's own `/auth/config`.
   *
   * The web reads this at load, because its instance is fixed at build time.
   * Here there is no instance until someone types one, so it is fetched as the
   * link settles -- and everything it drives (the demo prefill, whether sign-up
   * is offered) stays absent until then, which is the right default anyway.
   */
  const normalized = normalizeInstanceUrl(server);
  // Settle before probing, so a probe is not fired at every keystroke.
  const settled = useDebouncedValue(normalized, PROBE_DEBOUNCE_MS);

  const probe = useQuery({
    queryKey: ['instance-config', settled],
    queryFn: () => probeInstance(settled!),
    enabled: Boolean(settled),
    // The instance has to answer for itself; a stale config from the last
    // server someone typed would mean the wrong sign-up affordance.
    staleTime: 30_000,
    retry: false,
  });

  const config: InstanceConfig | null =
    settled === normalized && probe.data?.ok ? probe.data.config : null;
  const probing = Boolean(settled) && (probe.isFetching || settled !== normalized);

  /**
   * `null` means nobody has touched the field yet, which is not the same as
   * having emptied it. The prefill cannot be initial state -- it depends on a
   * response that has not arrived at first render -- and deriving it rather than
   * writing it back in an effect keeps that race harmless: whatever was typed
   * while the probe was in flight simply wins, and clearing the field does not
   * snap the demo address back. Same reasoning as `LoginPage.tsx:31-42`.
   */
  const [typedEmail, setTypedEmail] = useState<string | null>(null);
  const demo = config?.demo_credentials === true;
  const email = typedEmail ?? (demo ? DEMO_EMAIL : '');

  async function submit() {
    setError(null);

    const instance = normalizeInstanceUrl(server);
    if (!instance) {
      setError('That server link does not look like a web address.');
      return;
    }

    setSubmitting(true);
    try {
      // Probe before posting credentials, so a typo reports "cannot reach this
      // server" rather than an opaque network failure mid-sign-in. Skipped when
      // the debounced probe has already answered for this link.
      if (!config) {
        const probe = await probeInstance(instance);
        if (!probe.ok) {
          setError(probe.message);
          return;
        }
      }

      await signIn(instance, email.trim(), password);

      // Replay whatever deep link the auth gate interrupted.
      const destination = takeDestination();
      if (destination) router.replace(href(destination));
    } catch (err) {
      const wait = retryAfterSeconds(err);
      if (wait !== null) {
        // Throttled, not wrong. Saying "incorrect password" here would send
        // someone straight into a longer backoff.
        setError(`Too many sign-in attempts. Try again in ${formatDuration(wait)}.`);
        return;
      }
      // Otherwise show what the API said rather than always blaming the
      // password: the 401 text is identical for a wrong password and an unknown
      // address, so showing it leaks nothing.
      setError(errorDetail(err, 'Incorrect email or password.'));
    } finally {
      setSubmitting(false);
    }
  }

  const form = (
    <View style={{ width: '100%', maxWidth: 380, alignSelf: 'center', gap: 20 }}>
      {!multiPane ? (
        <View style={{ alignItems: 'center', gap: 12 }}>
          <Logo size={48} />
          <AppText variant="title">Welcome back</AppText>
          <AppText variant="muted">Sign in to your workspace</AppText>
        </View>
      ) : (
        <View style={{ gap: 4 }}>
          <AppText variant="title">Sign in</AppText>
          <AppText variant="muted">Connect to your workspace</AppText>
        </View>
      )}

      <Card variant="strong" style={{ padding: 18, gap: 14 }}>
        {error ? <Alert>{error}</Alert> : null}

        <Field
          label="Server link"
          value={server}
          onChangeText={setServer}
          placeholder="https://track.yourcompany.com"
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="URL"
          returnKeyType="next"
          hint={
            probing
              ? 'Checking this instance…'
              : config
                ? `Connected to ${normalized ? instanceLabel(normalized) : ''}`
                : undefined
          }
        />
        <Field
          label="Email"
          value={email}
          onChangeText={setTypedEmail}
          placeholder="you@company.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="username"
          returnKeyType="next"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={submit}
        />

        {/* Only the instance that is actually seeded with the demo account
            advertises it, so this appears nowhere else. */}
        {demo ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Use the demo account"
            onPress={() => {
              setTypedEmail(DEMO_EMAIL);
              setPassword(DEMO_PASSWORD);
            }}
            style={{
              backgroundColor: t.line.well,
              borderRadius: t.radius.control,
              padding: 10,
            }}
          >
            <AppText variant="hint">
              This instance has a demo account. Tap to fill it in.
            </AppText>
          </Pressable>
        ) : null}

        <Button onPress={submit} loading={submitting}>
          Sign in
        </Button>
      </Card>

      <AppText variant="hint" style={{ textAlign: 'center' }}>
        Self-hosted? Point the server link at your instance.
      </AppText>
    </View>
  );

  const welcome = (
    <View
      style={{
        flex: 1,
        backgroundColor: t.brand[50],
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        gap: 16,
      }}
    >
      <Logo size={56} />
      <AppText variant="title">SoftTrack</AppText>
      <AppText variant="muted">Track issues. Ship faster.</AppText>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.canvas }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1, flexDirection: 'row' }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Login sits outside the app shell, so it owns its own split: the
            welcome panel appears from medium upward. */}
        {multiPane ? <View style={{ flex: 1 }}>{welcome}</View> : null}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            padding: 24,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {form}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
