import { useState } from 'react';
import { Alert as RNAlert, Pressable, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import {
  createInviteTeamsTeamIdInvitesPost,
  revokeInviteTeamsTeamIdInvitesInviteIdDelete,
  useListInvitesTeamsTeamIdInvitesGet,
} from '@/api/generated/endpoints/invites/invites';
import {
  removeTeamMemberTeamsTeamIdMembersUserIdDelete,
  updateTeamMemberRoleTeamsTeamIdMembersUserIdPatch,
  useListTeamMembersTeamsTeamIdMembersGet,
} from '@/api/generated/endpoints/teams/teams';
import type { TeamRead, UserMe } from '@/api/generated/models';
import { errorDetail } from '@/api/errors';
import { getInstanceUrl } from '@/api/instance';
import { shareInvite } from '@/team/admin/share';
import { Alert, AppText, Avatar, Button, Card, Field, RoleChip } from '@/ui/primitives';
import { Sheet } from '@/ui/sheet';
import { useTokens } from '@/ui/theme';

/**
 * Members and invitations.
 *
 * Every guard here is the server's -- last-active-admin, self-demotion, admin
 * only. The client mirrors the messages rather than the rules, so an action that
 * would be refused says why instead of failing opaquely.
 */
export function MembersPanel({
  visible,
  onClose,
  team,
  user,
  isAdmin,
}: {
  visible: boolean;
  onClose: () => void;
  team: TeamRead;
  user: UserMe | null;
  isAdmin: boolean;
}) {
  const t = useTokens();
  const queryClient = useQueryClient();
  const members = useListTeamMembersTeamsTeamIdMembersGet(team.id, {
    query: { enabled: visible },
  });
  const invites = useListInvitesTeamsTeamIdInvitesGet(team.id, {
    query: { enabled: visible && isAdmin },
  });

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const list = members.data ?? [];
  const admins = list.filter((member) => member.role === 'admin');

  async function run(action: () => Promise<void>, fallback: string) {
    setError(null);
    setBusy(true);
    try {
      await action();
      await queryClient.invalidateQueries({ queryKey: [`/teams/${team.id}/members`] });
      await queryClient.invalidateQueries({ queryKey: [`/teams/${team.id}/invites`] });
    } catch (err) {
      setError(errorDetail(err, fallback));
    } finally {
      setBusy(false);
    }
  }

  if (!visible) return null;

  return (
    <Sheet visible onClose={onClose} title="Members">
      <View style={{ gap: 14, paddingBottom: 12 }}>
        {error ? <Alert>{error}</Alert> : null}

        {list.map((member) => {
          const isSelf = member.user.id === user?.id;
          const isLastAdmin = member.role === 'admin' && admins.length === 1;

          return (
            <Card
              key={member.user.id}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}
            >
              <Avatar
                name={member.user.full_name}
                color={member.user.avatar_color}
                size={32}
              />
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="body" numberOfLines={1} style={{ fontSize: 14 }}>
                  {member.user.full_name}
                  {isSelf ? ' (you)' : ''}
                </AppText>
                <AppText variant="hint" numberOfLines={1}>
                  @{member.user.username}
                </AppText>
              </View>

              <RoleChip role={member.role} />

              {isAdmin ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Manage ${member.user.full_name}`}
                  onPress={() => {
                    const options: Parameters<typeof RNAlert.alert>[2] = [
                      { text: 'Cancel', style: 'cancel' },
                    ];

                    if (!isLastAdmin) {
                      options.push({
                        text: member.role === 'admin' ? 'Make member' : 'Make admin',
                        onPress: () =>
                          void run(
                            () =>
                              updateTeamMemberRoleTeamsTeamIdMembersUserIdPatch(
                                team.id,
                                member.user.id,
                                { role: member.role === 'admin' ? 'member' : 'admin' },
                              ).then(() => undefined),
                            'Could not change that role.',
                          ),
                      });
                    }

                    options.push({
                      text: isSelf ? 'Leave team' : 'Remove from team',
                      style: 'destructive',
                      onPress: () =>
                        void run(
                          () =>
                            removeTeamMemberTeamsTeamIdMembersUserIdDelete(
                              team.id,
                              member.user.id,
                            ).then(() => undefined),
                          isSelf ? 'Could not leave the team.' : 'Could not remove them.',
                        ),
                    });

                    RNAlert.alert(
                      member.user.full_name,
                      isLastAdmin
                        ? 'The last admin cannot be demoted — promote somebody else first.'
                        : undefined,
                      options,
                    );
                  }}
                >
                  <AppText variant="hint" style={{ color: t.brand[600] }}>
                    Manage
                  </AppText>
                </Pressable>
              ) : null}
            </Card>
          );
        })}

        {isAdmin ? (
          <View
            style={{
              gap: 10,
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: t.line.hairline,
            }}
          >
            <AppText variant="eyebrow">INVITE</AppText>

            {(invites.data ?? []).map((invite) => (
              <Card
                key={invite.id}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 }}
              >
                <View style={{ flex: 1 }}>
                  <AppText variant="body" numberOfLines={1} style={{ fontSize: 14 }}>
                    {invite.email}
                  </AppText>
                  <AppText variant="hint">Invited as {invite.role}</AppText>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Share the invitation for ${invite.email}`}
                  onPress={() =>
                    void shareInvite(invite.token, team.name, getInstanceUrl())
                  }
                >
                  <AppText variant="hint" style={{ color: t.brand[600] }}>
                    Share
                  </AppText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Revoke the invitation for ${invite.email}`}
                  onPress={() =>
                    void run(
                      () =>
                        revokeInviteTeamsTeamIdInvitesInviteIdDelete(
                          team.id,
                          invite.id,
                        ).then(() => undefined),
                      'Could not revoke that invitation.',
                    )
                  }
                >
                  <AppText variant="hint" style={{ color: t.neutral[400] }}>
                    Revoke
                  </AppText>
                </Pressable>
              </Card>
            ))}

            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="new.person@company.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Button
              loading={busy}
              disabled={!email.trim()}
              onPress={() =>
                void run(async () => {
                  const invite = await createInviteTeamsTeamIdInvitesPost(team.id, {
                    email: email.trim(),
                    role: 'member',
                  });
                  setEmail('');
                  // Nothing sends email, so handing the link straight to the
                  // share sheet is the only way it reaches anybody.
                  await shareInvite(invite.token, team.name, getInstanceUrl());
                }, 'Could not create that invitation.')
              }
            >
              Invite and share link
            </Button>
          </View>
        ) : null}
      </View>
    </Sheet>
  );
}
