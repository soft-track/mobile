import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { errorDetail } from '@/api/errors';
import { getInstanceUrl, normalizeInstanceUrl, probeInstance } from '@/api/instance';
import { useAuth } from '@/auth/auth-context';
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
 *
 * Issue #2 owns the rest: demo-credential prefill, 429 + Retry-After handling,
 * richer link validation, and continuing to a deep link after signing in.
 */
export function LoginScreen() {
  const t = useTokens();
  const { signIn } = useAuth();
  const multiPane = useIsMultiPane();

  const [server, setServer] = useState(getInstanceUrl() ?? '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
      // server" rather than an opaque network failure mid-sign-in.
      const probe = await probeInstance(instance);
      if (!probe.ok) {
        setError(probe.message);
        return;
      }
      await signIn(instance, email.trim(), password);
    } catch (err) {
      // Show the API's own message. Sign-in is rate limited, and a canned
      // "wrong password" would send a throttled user round the loop again --
      // the same reasoning as `LoginPage.tsx:51-56`.
      setError(errorDetail(err, 'Could not sign in. Please try again.'));
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
        />
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
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
