import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import {
  acceptInviteInvitesTokenAcceptPost,
  declineInviteInvitesTokenDeclinePost,
  usePreviewInviteInvitesTokenGet,
} from '@/api/generated/endpoints/invites/invites';
import { errorDetail } from '@/api/errors';
import { getInstanceUrl, instanceLabel } from '@/api/instance';
import { useAuth } from '@/auth/auth-context';
import { rememberDestination } from '@/auth/pending-destination';
import { useTeams } from '@/team/team-context';
import { href } from '@/ui/href';
import { Alert, AppText, Button, Card, Loading, Logo, RoleChip } from '@/ui/primitives';
import { useTokens } from '@/ui/theme';

/**
 * The landing screen for an invitation link, per
 * `docs/design/mobile/140-register-invite.svg`.
 *
 * Deliberately outside both the `(auth)` and `(app)` groups, so neither guard
 * covers it: most people opening one of these have no account yet, and bouncing
 * them to a login screen without saying what they were invited to is how an
 * invitation gets ignored. Same reasoning as the web keeping `/invite/:token`
 * outside `RequireAuth` (`frontend/src/app/App.tsx:31-34`).
 *
 * One thing the web gets for free that this cannot: on the web the page's own
 * origin IS the instance. A `softtrack://` deep link carries no host, so the
 * instance has to already be known. Arriving with none sends the user to sign in
 * first, with this screen recorded as where to come back to.
 */
export function InviteScreen() {
  const t = useTokens();
  const { token = '' } = useLocalSearchParams<{ token: string }>();
  const { isAuthenticated, user, signOut } = useAuth();
  const { setTeamKey } = useTeams();
  const queryClient = useQueryClient();

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const instance = getInstanceUrl();
  const preview = usePreviewInviteInvitesTokenGet(token, {
    query: { enabled: Boolean(token) && Boolean(instance), retry: false },
  });

  const shell = (children: React.ReactNode) => (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.canvas }} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
      >
        <View style={{ width: '100%', maxWidth: 420, alignSelf: 'center', gap: 20 }}>
          <View style={{ alignItems: 'center' }}>
            <Logo size={48} />
          </View>
          <Card variant="strong" style={{ padding: 20, gap: 14 }}>
            {children}
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );

  if (!instance) {
    return shell(
      <>
        <AppText variant="heading">Which SoftTrack is this?</AppText>
        <AppText variant="muted">
          An invitation link does not say which instance it belongs to. Sign in to
          your instance and the invitation will open straight after.
        </AppText>
        <Button
          onPress={() => {
            rememberDestination(`/invite/${token}`);
            router.replace('/login');
          }}
        >
          Go to sign in
        </Button>
      </>,
    );
  }

  if (preview.isPending) {
    return shell(<Loading />);
  }

  if (preview.isError || !preview.data) {
    return shell(
      <>
        <AppText variant="heading">This invitation is no longer valid</AppText>
        <AppText variant="muted">
          It may have been used, revoked, or simply run out. Ask whoever invited
          you to send a fresh link.
        </AppText>
        <Button variant="ghost" onPress={() => router.replace('/')}>
          Continue to SoftTrack
        </Button>
      </>,
    );
  }

  const invite = preview.data;
  const wrongAccount =
    isAuthenticated &&
    user !== null &&
    user.email.toLowerCase() !== invite.email.toLowerCase();

  async function act(run: () => Promise<void>, fallback: string) {
    setError(null);
    setBusy(true);
    try {
      await run();
    } catch (err) {
      setError(errorDetail(err, fallback));
    } finally {
      setBusy(false);
    }
  }

  const onAccept = () =>
    act(async () => {
      const team = await acceptInviteInvitesTokenAcceptPost(token);
      // Awaited, with refetchType 'all': the team list drives which team the
      // board shows, so switching to a team the list has not caught up with
      // would land on nothing.
      await queryClient.invalidateQueries({ queryKey: ['/teams'], refetchType: 'all' });
      await queryClient.invalidateQueries({ queryKey: ['/auth/me/invites'] });
      setTeamKey(team.key);
      router.replace('/');
    }, 'Could not accept this invitation.');

  const onDecline = () =>
    act(async () => {
      await declineInviteInvitesTokenDeclinePost(token);
      await queryClient.invalidateQueries({ queryKey: ['/auth/me/invites'] });
      router.replace('/');
    }, 'Could not decline this invitation.');

  return shell(
    <>
      <AppText variant="eyebrow">INVITATION</AppText>
      <AppText variant="heading">
        {invite.invited_by_name} invited you to join {invite.team_name}
      </AppText>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <View
          style={{
            backgroundColor: t.line.well,
            borderRadius: t.radius.control,
            paddingHorizontal: 8,
            paddingVertical: 4,
          }}
        >
          <AppText variant="identifier">{invite.team_key}</AppText>
        </View>
        <AppText variant="muted">as</AppText>
        <RoleChip role={invite.role} />
      </View>

      <AppText variant="muted">
        Sent to {invite.email} on {instanceLabel(instance)}.
      </AppText>

      {error ? <Alert>{error}</Alert> : null}

      {!isAuthenticated ? (
        <View style={{ gap: 8 }}>
          <Button onPress={() => router.push(href(`/register?invite=${encodeURIComponent(token)}`))}>
            Create an account
          </Button>
          <Button
            variant="ghost"
            onPress={() => {
              rememberDestination(`/invite/${token}`);
              router.push('/login');
            }}
          >
            Sign in to accept
          </Button>
        </View>
      ) : wrongAccount ? (
        <View style={{ gap: 10, backgroundColor: t.line.well, borderRadius: t.radius.control, padding: 12 }}>
          <AppText variant="body">
            You are signed in as {user?.email}, and this invitation was sent to{' '}
            {invite.email}. An invitation only admits the address it was
            addressed to.
          </AppText>
          <Button variant="ghost" onPress={signOut}>
            Sign out and use the other account
          </Button>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          <Button onPress={onAccept} loading={busy}>
            {`Join ${invite.team_name}`}
          </Button>
          <Button variant="ghost" onPress={onDecline} disabled={busy}>
            Decline
          </Button>
        </View>
      )}
    </>,
  );
}
