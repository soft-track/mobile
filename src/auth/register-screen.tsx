import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { registerAuthRegisterPost } from '@/api/generated/endpoints/auth/auth';
import { usePreviewInviteInvitesTokenGet } from '@/api/generated/endpoints/invites/invites';
import { errorDetail, formatDuration, retryAfterSeconds } from '@/api/errors';
import { getInstanceUrl, instanceLabel, probeInstance, type InstanceConfig } from '@/api/instance';
import { useAuth } from '@/auth/auth-context';
import { Alert, AppText, Button, Card, Field, Logo } from '@/ui/primitives';
import { useTokens } from '@/ui/theme';

/**
 * Create an account, per `docs/design/mobile/140-register-invite.svg`.
 *
 * Reached from the login screen, which is where the instance link is entered --
 * so by the time anyone is here there is already an instance to register
 * against. Arriving without one (a stale deep link, say) sends them back rather
 * than posting into the void.
 */
export function RegisterScreen() {
  const t = useTokens();
  const { setSession } = useAuth();
  const params = useLocalSearchParams<{ invite?: string }>();
  const inviteToken = params.invite ?? '';
  const instance = getInstanceUrl();

  const [config, setConfig] = useState<InstanceConfig | null>(null);
  const [configPending, setConfigPending] = useState(true);

  const invite = usePreviewInviteInvitesTokenGet(inviteToken, {
    query: { enabled: Boolean(inviteToken) && Boolean(instance), retry: false },
  });

  const [fullName, setFullName] = useState('');
  const [typedEmail, setTypedEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!instance) {
      router.replace('/login');
      return;
    }
    let cancelled = false;
    void (async () => {
      const result = await probeInstance(instance);
      if (cancelled) return;
      setConfigPending(false);
      if (result.ok) setConfig(result.config);
    })();
    return () => {
      cancelled = true;
    };
  }, [instance]);

  const openRegistration = config?.open_registration ?? true;
  const invitedIn = Boolean(invite.data);
  // The invitation names the address it admits, so that is the address the form
  // uses -- typing a different one would only earn a 403 on submit. Derived
  // rather than copied into state: the invite simply *is* the answer when there
  // is one.
  const email = invite.data ? invite.data.email : typedEmail;
  const locked = !openRegistration && !invitedIn && !configPending;

  async function submit() {
    setError(null);
    if (password.length < 8) {
      setError('Passwords must be at least 8 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const token = await registerAuthRegisterPost({
        email: email.trim(),
        password,
        full_name: fullName.trim(),
        username: username.trim() || undefined,
        invite_token: inviteToken || undefined,
      });
      setSession(token.access_token, token.user);
      // The backend accepts an invite best-effort after creating the account
      // and swallows failures (`lib_identity/identity.py:144-150`), so the team
      // list is re-read rather than assumed -- landing on Home shows whatever
      // actually happened.
      router.replace('/');
    } catch (err) {
      const wait = retryAfterSeconds(err);
      setError(
        wait !== null
          ? `Too many sign-up attempts. Try again in ${formatDuration(wait)}.`
          : errorDetail(err, 'Could not create your account.'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  const body = locked ? (
    <Card variant="strong" style={{ padding: 18, gap: 8 }}>
      <AppText variant="heading">This SoftTrack is invite-only</AppText>
      <AppText variant="muted">
        New accounts can only be created from an invitation link. Ask an
        administrator to send you one.
      </AppText>
    </Card>
  ) : (
    <Card variant="strong" style={{ padding: 18, gap: 14 }}>
      {error ? <Alert>{error}</Alert> : null}

      <Field
        label="Full name"
        value={fullName}
        onChangeText={setFullName}
        placeholder="Ada Lovelace"
        autoComplete="name"
        returnKeyType="next"
      />
      <Field
        label="Email"
        value={email}
        onChangeText={setTypedEmail}
        editable={!invitedIn}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        returnKeyType="next"
        hint={invitedIn ? 'The address this invitation was sent to.' : undefined}
      />
      <Field
        label="Username (optional)"
        value={username}
        onChangeText={(value) => setUsername(value.toLowerCase())}
        placeholder="Leave blank for the part before the @"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="next"
      />
      <Field
        label="Password"
        value={password}
        onChangeText={setPassword}
        placeholder="At least 8 characters"
        secureTextEntry
        autoComplete="new-password"
        returnKeyType="go"
        onSubmitEditing={submit}
      />

      <Button onPress={submit} loading={submitting}>
        Create account
      </Button>
    </Card>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.canvas }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ width: '100%', maxWidth: 380, alignSelf: 'center', gap: 20 }}>
            <View style={{ alignItems: 'center', gap: 10 }}>
              <Logo size={48} />
              <AppText variant="title">Create your account</AppText>
              <AppText variant="muted" style={{ textAlign: 'center' }}>
                {invite.data
                  ? `${invite.data.invited_by_name} invited you to ${invite.data.team_name}.`
                  : locked
                    ? 'This instance is closed to open sign-ups.'
                    : instance
                      ? `On ${instanceLabel(instance)}.`
                      : ''}
              </AppText>
            </View>

            {body}

            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Sign in instead"
              onPress={() => router.replace('/login')}
              style={{ alignSelf: 'center' }}
            >
              <AppText variant="label" style={{ color: t.brand[600] }}>
                Already have an account? Sign in
              </AppText>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
