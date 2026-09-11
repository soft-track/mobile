import { useState } from 'react';
import { Alert as RNAlert, Linking, Pressable, Share, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useQueryClient } from '@tanstack/react-query';

import {
  deleteRepositoryRepositoriesRepositoryIdDelete,
  rotateSecretRepositoriesRepositoryIdRotatePost,
  useListRepositoriesTeamsTeamIdRepositoriesGet,
} from '@/api/generated/endpoints/integrations/integrations';
import { updateTeamTeamsTeamIdPatch } from '@/api/generated/endpoints/teams/teams';
import { useListTeamMembersTeamsTeamIdMembersGet } from '@/api/generated/endpoints/teams/teams';
import type { TeamRead } from '@/api/generated/models';
import { errorDetail } from '@/api/errors';
import { getInstanceUrl } from '@/api/instance';
import { useAuth } from '@/auth/auth-context';
import { AutomationPanel } from '@/team/admin/automation-panel';
import { MembersPanel } from '@/team/admin/members-panel';
import { StatusesPanel } from '@/team/admin/statuses-panel';
import { Alert, AppText, Button, Card, Field } from '@/ui/primitives';
import { Sheet } from '@/ui/sheet';
import { useTokens } from '@/ui/theme';

/**
 * Team administration, per `docs/design/mobile/153-team-admin.svg`.
 *
 * A menu of panels rather than one long form: five unrelated areas on one phone
 * screen would be a scroll with no landmarks.
 */
type Panel = 'general' | 'members' | 'statuses' | 'automation' | 'repositories' | null;

export function TeamAdminSheet({
  visible,
  onClose,
  team,
}: {
  visible: boolean;
  onClose: () => void;
  team: TeamRead;
}) {
  const t = useTokens();
  const { user } = useAuth();
  const [panel, setPanel] = useState<Panel>(null);

  const members = useListTeamMembersTeamsTeamIdMembersGet(team.id, {
    query: { enabled: visible },
  });
  // The server enforces every admin rule; this only decides what to offer, so
  // nothing is presented that would be refused.
  const isAdmin =
    (members.data ?? []).find((member) => member.user.id === user?.id)?.role === 'admin';

  if (!visible) return null;

  return (
    <Sheet visible onClose={onClose} title={team.name}>
      <View style={{ gap: 2, paddingBottom: 12 }}>
        {(
          [
            ['general', 'General'],
            ['members', 'Members and invitations'],
            ['statuses', 'Statuses'],
            ['automation', 'Automation'],
            ['repositories', 'Repositories'],
          ] as const
        ).map(([key, label]) => (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityLabel={label}
            onPress={() => setPanel(key)}
            style={{
              paddingVertical: 14,
              paddingHorizontal: 10,
              borderRadius: t.radius.control,
            }}
          >
            <AppText variant="body">{label}</AppText>
          </Pressable>
        ))}

        {!isAdmin ? (
          <AppText variant="hint" style={{ paddingHorizontal: 10, paddingTop: 8 }}>
            You are a member of this team, so some settings are read-only.
          </AppText>
        ) : null}

        {/* Importing from Jira is a long, file-driven flow that stays on the
            web settings page, as the issue allows. */}
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Import from Jira on the web"
          onPress={() => {
            const base = getInstanceUrl();
            if (base) void Linking.openURL(`${base}/settings/teams/${team.key}/general`);
          }}
          style={{ paddingVertical: 14, paddingHorizontal: 10 }}
        >
          <AppText variant="hint" style={{ color: t.brand[600] }}>
            Import from Jira (opens the web app)
          </AppText>
        </Pressable>
      </View>

      <GeneralPanel
        visible={panel === 'general'}
        onClose={() => setPanel(null)}
        team={team}
        isAdmin={isAdmin}
      />
      <MembersPanel
        visible={panel === 'members'}
        onClose={() => setPanel(null)}
        team={team}
        user={user}
        isAdmin={isAdmin}
      />
      <StatusesPanel
        visible={panel === 'statuses'}
        onClose={() => setPanel(null)}
        team={team}
        isAdmin={isAdmin}
      />
      <AutomationPanel
        visible={panel === 'automation'}
        onClose={() => setPanel(null)}
        team={team}
        isAdmin={isAdmin}
      />
      <RepositoriesPanel
        visible={panel === 'repositories'}
        onClose={() => setPanel(null)}
        team={team}
        isAdmin={isAdmin}
      />
    </Sheet>
  );
}

function GeneralPanel({
  visible,
  onClose,
  team,
  isAdmin,
}: {
  visible: boolean;
  onClose: () => void;
  team: TeamRead;
  isAdmin: boolean;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!visible) return null;

  return (
    <Sheet visible onClose={onClose} title="General">
      <View style={{ gap: 12, paddingBottom: 12 }}>
        {error ? <Alert>{error}</Alert> : null}

        <Field
          label="Name"
          value={name || team.name}
          onChangeText={setName}
          editable={isAdmin}
        />
        <Field
          label="Description"
          value={description || team.description || ''}
          onChangeText={setDescription}
          editable={isAdmin}
          multiline
          style={{ minHeight: 70 }}
        />
        <Field label="Key" value={team.key} editable={false} hint="A key is permanent." />

        {isAdmin ? (
          <Button
            loading={busy}
            onPress={async () => {
              setError(null);
              setBusy(true);
              try {
                await updateTeamTeamsTeamIdPatch(team.id, {
                  name: (name || team.name).trim(),
                  description: (description || team.description || '').trim() || null,
                });
                await queryClient.invalidateQueries({ queryKey: ['/teams'] });
                onClose();
              } catch (err) {
                setError(errorDetail(err, 'Could not save the team.'));
              } finally {
                setBusy(false);
              }
            }}
          >
            Save
          </Button>
        ) : null}
      </View>
    </Sheet>
  );
}

function RepositoriesPanel({
  visible,
  onClose,
  team,
  isAdmin,
}: {
  visible: boolean;
  onClose: () => void;
  team: TeamRead;
  isAdmin: boolean;
}) {
  const t = useTokens();
  const queryClient = useQueryClient();
  const repositories = useListRepositoriesTeamsTeamIdRepositoriesGet(team.id, {
    query: { enabled: visible },
  });
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<number | null>(null);

  async function run(action: () => Promise<void>, fallback: string) {
    setError(null);
    try {
      await action();
      await queryClient.invalidateQueries({
        queryKey: [`/teams/${team.id}/repositories`],
      });
    } catch (err) {
      setError(errorDetail(err, fallback));
    }
  }

  if (!visible) return null;
  const items = repositories.data ?? [];

  return (
    <Sheet visible onClose={onClose} title="Repositories">
      <View style={{ gap: 12, paddingBottom: 12 }}>
        {error ? <Alert>{error}</Alert> : null}

        {items.map((repository) => (
          <Card key={repository.id} style={{ padding: 14, gap: 8 }}>
            <AppText variant="label">{repository.full_name}</AppText>
            <AppText variant="hint">
              {repository.provider} ·{' '}
              {repository.last_delivery_at
                ? `last delivery ${repository.last_delivery_at.slice(0, 10)}`
                : 'nothing delivered yet'}
            </AppText>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Copy payload URL"
                onPress={() => void Clipboard.setStringAsync(repository.webhook_url)}
              >
                <AppText variant="hint" style={{ color: t.brand[600] }}>
                  Copy payload URL
                </AppText>
              </Pressable>

              {/* A secret is not put on screen until it is asked for -- these
                  screens get shown to other people. */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  revealed === repository.id ? 'Copy secret' : 'Reveal secret'
                }
                onPress={() => {
                  if (revealed === repository.id) {
                    void Clipboard.setStringAsync(repository.secret);
                  } else {
                    setRevealed(repository.id);
                  }
                }}
              >
                <AppText variant="hint" style={{ color: t.brand[600] }}>
                  {revealed === repository.id ? 'Copy secret' : 'Reveal secret'}
                </AppText>
              </Pressable>

              {isAdmin ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Rotate secret"
                  onPress={() =>
                    RNAlert.alert(
                      'Rotate the secret?',
                      'Deliveries stop until the new secret is set on the repository.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Rotate',
                          style: 'destructive',
                          onPress: () =>
                            void run(
                              () =>
                                rotateSecretRepositoriesRepositoryIdRotatePost(
                                  repository.id,
                                ).then(() => undefined),
                              'Could not rotate the secret.',
                            ),
                        },
                      ],
                    )
                  }
                >
                  <AppText variant="hint" style={{ color: t.neutral[500] }}>
                    Rotate secret
                  </AppText>
                </Pressable>
              ) : null}

              {isAdmin ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Disconnect ${repository.full_name}`}
                  onPress={() =>
                    RNAlert.alert(
                      `Disconnect ${repository.full_name}?`,
                      'Branches and pull requests stop being linked to issues.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Disconnect',
                          style: 'destructive',
                          onPress: () =>
                            void run(
                              () =>
                                deleteRepositoryRepositoriesRepositoryIdDelete(
                                  repository.id,
                                ).then(() => undefined),
                              'Could not disconnect that repository.',
                            ),
                        },
                      ],
                    )
                  }
                >
                  <AppText variant="hint" style={{ color: t.danger[700] }}>
                    Disconnect
                  </AppText>
                </Pressable>
              ) : null}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Share payload URL"
                onPress={() => void Share.share({ message: repository.webhook_url })}
              >
                <AppText variant="hint" style={{ color: t.neutral[500] }}>
                  Share URL
                </AppText>
              </Pressable>
            </View>

            {revealed === repository.id ? (
              <AppText variant="identifier" numberOfLines={2}>
                {repository.secret}
              </AppText>
            ) : null}
          </Card>
        ))}

        {items.length === 0 && !repositories.isPending ? (
          <Card style={{ padding: 14 }}>
            <AppText variant="muted">No repositories connected.</AppText>
          </Card>
        ) : null}
      </View>
    </Sheet>
  );
}
