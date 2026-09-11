import { useState } from 'react';
import { View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { useMyInvitesAuthMeInvitesGet } from '@/api/generated/endpoints/auth/auth';
import {
  acceptInviteInvitesTokenAcceptPost,
  declineInviteInvitesTokenDeclinePost,
} from '@/api/generated/endpoints/invites/invites';
import { errorDetail } from '@/api/errors';
import { useTeams } from '@/team/team-context';
import { Alert, AppText, Button, Card } from '@/ui/primitives';
import { useTokens } from '@/ui/theme';

/**
 * Invitations waiting for the signed-in user.
 *
 * There is no email delivery in the picture, so this is the only thing that
 * tells someone an invitation exists once they already have an account --
 * without it, a person invited to a second team would never find out.
 */
export function InvitesBanner() {
  const t = useTokens();
  const invites = useMyInvitesAuthMeInvitesGet({ query: { staleTime: 30_000 } });
  const queryClient = useQueryClient();
  const { setTeamKey } = useTeams();

  const [busyToken, setBusyToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pending = invites.data ?? [];
  if (pending.length === 0) return null;

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['/auth/me/invites'] }),
      // refetchType 'all' so the team list updates even where nothing is
      // currently observing it -- the switcher reads it straight after.
      queryClient.invalidateQueries({ queryKey: ['/teams'], refetchType: 'all' }),
    ]);

  async function act(token: string, run: () => Promise<void>, fallback: string) {
    setError(null);
    setBusyToken(token);
    try {
      await run();
      await refresh();
    } catch (err) {
      setError(errorDetail(err, fallback));
    } finally {
      setBusyToken(null);
    }
  }

  return (
    <View style={{ gap: 8 }}>
      <AppText variant="eyebrow">INVITATIONS</AppText>
      {error ? <Alert>{error}</Alert> : null}

      {pending.map((invite) => (
        <Card key={invite.id} style={{ padding: 14, gap: 10, borderColor: t.brand[300] }}>
          <AppText variant="body">
            {invite.invited_by.full_name} invited you to {invite.team_name} (
            {invite.team_key}) as {invite.role}.
          </AppText>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button
              style={{ flex: 1 }}
              loading={busyToken === invite.token}
              onPress={() =>
                act(
                  invite.token,
                  async () => {
                    const team = await acceptInviteInvitesTokenAcceptPost(invite.token);
                    setTeamKey(team.key);
                  },
                  'Could not accept this invitation.',
                )
              }
            >
              Accept
            </Button>
            <Button
              variant="ghost"
              disabled={busyToken === invite.token}
              onPress={() =>
                act(
                  invite.token,
                  () => declineInviteInvitesTokenDeclinePost(invite.token).then(() => undefined),
                  'Could not decline this invitation.',
                )
              }
            >
              Decline
            </Button>
          </View>
        </Card>
      ))}
    </View>
  );
}
