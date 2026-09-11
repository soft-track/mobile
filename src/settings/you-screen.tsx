import { useState } from 'react';
import { Alert as RNAlert, Pressable, ScrollView, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';

import {
  changeMyPasswordAuthMePasswordPost,
  signOutEverywhereRouteAuthMeSignOutEverywherePost,
  updateMeAuthMePatch,
} from '@/api/generated/endpoints/auth/auth';
import {
  updateNotificationSettingsNotificationsSettingsPatch,
  useGetNotificationSettingsNotificationsSettingsGet,
} from '@/api/generated/endpoints/notifications/notifications';
import { errorDetail } from '@/api/errors';
import { instanceLabel, setInstanceUrl } from '@/api/instance';
import { useAuth } from '@/auth/auth-context';
import { SiteAdminSheet } from '@/admin/site-admin-sheet';
import { isValidUsername } from '@/settings/username';
import { useIsMultiPane } from '@/ui/layout';
import { AppText, Alert, Avatar, Button, Card, Field } from '@/ui/primitives';
import { Sheet } from '@/ui/sheet';
import { ThemePreferenceControl } from '@/ui/theme-control';
import { useTokens } from '@/ui/theme';

/**
 * Account settings, per `docs/design/mobile/152-settings.svg`.
 *
 * The seven the backend picks from; see AVATAR_COLORS in lib_identity. Offered
 * as swatches rather than a free colour because the server will only keep one
 * of these.
 */
const AVATAR_COLORS = [
  '#6366f1',
  '#ec4899',
  '#14b8a6',
  '#f59e0b',
  '#8b5cf6',
  '#ef4444',
  '#22c55e',
];

type Panel = 'profile' | 'security' | 'notifications' | 'instance' | 'admin' | null;

export function YouScreen() {
  const t = useTokens();
  const multiPane = useIsMultiPane();
  const { user, instanceUrl, signOut, setSession } = useAuth();
  const [panel, setPanel] = useState<Panel>(null);

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
          <AppText variant="eyebrow">ACCOUNT</AppText>
          <Card>
            <SettingsRow label="Profile" onPress={() => setPanel('profile')} />
            <SettingsRow label="Security" onPress={() => setPanel('security')} />
            <SettingsRow label="Notifications" onPress={() => setPanel('notifications')} />
          </Card>
        </View>

        {/* Only for an account that actually has it; there is nothing to
            discover here that the server would then refuse. */}
        {user?.is_site_admin ? (
          <View style={{ gap: 8 }}>
            <AppText variant="eyebrow">ADMINISTRATION</AppText>
            <Card>
              <SettingsRow label="All users" onPress={() => setPanel('admin')} />
            </Card>
          </View>
        ) : null}

        <View style={{ gap: 8 }}>
          <AppText variant="eyebrow">APPEARANCE</AppText>
          <ThemePreferenceControl />
        </View>

        <View style={{ gap: 8 }}>
          <AppText variant="eyebrow">INSTANCE</AppText>
          <Card>
            <SettingsRow
              label={instanceUrl ? instanceLabel(instanceUrl) : 'Not connected'}
              detail="Switch"
              onPress={() => setPanel('instance')}
            />
          </Card>
        </View>

        <Button variant="danger" onPress={signOut}>
          Sign out
        </Button>
      </ScrollView>

      <ProfilePanel
        visible={panel === 'profile'}
        onClose={() => setPanel(null)}
        onSaved={setSession}
      />
      <SecurityPanel
        visible={panel === 'security'}
        onClose={() => setPanel(null)}
        onReissued={setSession}
      />
      <NotificationsPanel
        visible={panel === 'notifications'}
        onClose={() => setPanel(null)}
      />
      <SiteAdminSheet
        visible={panel === 'admin'}
        onClose={() => setPanel(null)}
        user={user}
      />
      <InstancePanel
        visible={panel === 'instance'}
        onClose={() => setPanel(null)}
        onSwitch={signOut}
      />
    </SafeAreaView>
  );
}

function SettingsRow({
  label,
  detail,
  onPress,
}: {
  label: string;
  detail?: string;
  onPress: () => void;
}) {
  const t = useTokens();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 14,
        paddingHorizontal: 14,
      }}
    >
      <AppText variant="body" numberOfLines={1} style={{ flex: 1 }}>
        {label}
      </AppText>
      {detail ? (
        <AppText variant="hint" style={{ color: t.brand[600] }}>
          {detail}
        </AppText>
      ) : null}
    </Pressable>
  );
}

function ProfilePanel({
  visible,
  onClose,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: (token: string, user: import('@/api/generated/models').UserMe) => void;
}) {
  const t = useTokens();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [color, setColor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!visible || !user) return null;

  const chosenColor = color ?? user.avatar_color;
  const emailChanged = email.trim() !== '' && email.trim() !== user.email;

  return (
    <Sheet visible onClose={onClose} title="Profile">
      <View style={{ gap: 14, paddingBottom: 12 }}>
        {error ? <Alert>{error}</Alert> : null}

        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          {AVATAR_COLORS.map((swatch) => (
            <Pressable
              key={swatch}
              accessibilityRole="button"
              accessibilityLabel={`Avatar colour ${swatch}`}
              accessibilityState={chosenColor === swatch ? { selected: true } : {}}
              onPress={() => setColor(swatch)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: swatch,
                borderWidth: chosenColor === swatch ? 3 : 0,
                borderColor: t.brand[600],
              }}
            />
          ))}
        </View>

        <Field
          label="Full name"
          value={fullName || user.full_name}
          onChangeText={setFullName}
        />
        <Field
          label="Username"
          value={username || user.username}
          onChangeText={(value) => setUsername(value.toLowerCase())}
          autoCapitalize="none"
          autoCorrect={false}
          hint="Lowercase letters, digits, dot, dash or underscore. 2 to 39 characters."
        />
        <Field
          label="Email"
          value={email || user.email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        {/* Only asked for when it is actually needed, which is the one case the
            server demands it. */}
        {emailChanged ? (
          <Field
            label="Current password"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            hint="Changing your email address needs your password."
          />
        ) : null}

        <Button
          loading={busy}
          onPress={async () => {
            const nextUsername = (username || user.username).trim();
            if (!isValidUsername(nextUsername)) {
              setError(
                'A username is 2 to 39 characters: lowercase letters, digits, dot, dash or underscore, starting with a letter or digit.',
              );
              return;
            }
            setError(null);
            setBusy(true);
            try {
              await updateMeAuthMePatch({
                full_name: (fullName || user.full_name).trim(),
                username: nextUsername,
                avatar_color: chosenColor,
                email: emailChanged ? email.trim() : undefined,
                current_password: emailChanged ? currentPassword : undefined,
              });
              await queryClient.invalidateQueries({ queryKey: ['/auth/me'] });
              onClose();
            } catch (err) {
              setError(errorDetail(err, 'Could not save your profile.'));
            } finally {
              setBusy(false);
            }
          }}
        >
          Save
        </Button>
      </View>
    </Sheet>
  );
}

function SecurityPanel({
  visible,
  onClose,
  onReissued,
}: {
  visible: boolean;
  onClose: () => void;
  onReissued: (token: string, user: import('@/api/generated/models').UserMe) => void;
}) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!visible) return null;

  return (
    <Sheet visible onClose={onClose} title="Security">
      <View style={{ gap: 14, paddingBottom: 12 }}>
        {error ? <Alert>{error}</Alert> : null}

        <Field label="Current password" value={current} onChangeText={setCurrent} secureTextEntry />
        <Field
          label="New password"
          value={next}
          onChangeText={setNext}
          secureTextEntry
          hint="At least 8 characters."
        />
        <Field label="Confirm new password" value={confirm} onChangeText={setConfirm} secureTextEntry />

        <Button
          loading={busy}
          onPress={async () => {
            if (next !== confirm) {
              setError('The new passwords do not match.');
              return;
            }
            if (next.length < 8) {
              setError('Passwords must be at least 8 characters.');
              return;
            }
            setError(null);
            setBusy(true);
            try {
              // Changing a password invalidates every token including this
              // device's, and the response carries the replacement -- adopting
              // it is what keeps you signed in to the account you just secured.
              const token = await changeMyPasswordAuthMePasswordPost({
                current_password: current,
                new_password: next,
              });
              onReissued(token.access_token, token.user);
              setCurrent('');
              setNext('');
              setConfirm('');
              onClose();
            } catch (err) {
              setError(errorDetail(err, 'Could not change your password.'));
            } finally {
              setBusy(false);
            }
          }}
        >
          Update password
        </Button>

        <Button
          variant="ghost"
          onPress={() =>
            RNAlert.alert(
              'Sign out everywhere?',
              'Every other device is signed out. This one stays signed in.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Sign out everywhere',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      const token = await signOutEverywhereRouteAuthMeSignOutEverywherePost();
                      onReissued(token.access_token, token.user);
                      onClose();
                    } catch (err) {
                      setError(errorDetail(err, 'Could not sign out everywhere.'));
                    }
                  },
                },
              ],
            )
          }
        >
          Sign out everywhere
        </Button>
      </View>
    </Sheet>
  );
}

function NotificationsPanel({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const settings = useGetNotificationSettingsNotificationsSettingsGet({
    query: { enabled: visible },
  });
  const [error, setError] = useState<string | null>(null);

  if (!visible) return null;
  const data = settings.data;

  return (
    <Sheet visible onClose={onClose} title="Notifications">
      <View style={{ gap: 14, paddingBottom: 12 }}>
        {error ? <Alert>{error}</Alert> : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Switch
            value={data?.email_notifications ?? false}
            disabled={!data || !data.email_delivery_configured}
            accessibilityLabel="Email notifications"
            onValueChange={async (value) => {
              setError(null);
              try {
                await updateNotificationSettingsNotificationsSettingsPatch({
                  email_notifications: value,
                });
                await queryClient.invalidateQueries({
                  queryKey: ['/notifications/settings'],
                });
              } catch (err) {
                setError(errorDetail(err, 'Could not change that setting.'));
              }
            }}
          />
          <AppText variant="body" style={{ flex: 1, fontSize: 14 }}>
            Email me about my issues
          </AppText>
        </View>

        {/* The toggle is meaningless where the instance cannot send email, and
            silently doing nothing would be worse than saying so. */}
        {data && !data.email_delivery_configured ? (
          <AppText variant="hint">
            This instance has no email configured, so nothing would be sent. Ask
            an administrator to set up SMTP.
          </AppText>
        ) : null}
      </View>
    </Sheet>
  );
}

function InstancePanel({
  visible,
  onClose,
  onSwitch,
}: {
  visible: boolean;
  onClose: () => void;
  onSwitch: () => void;
}) {
  const { instanceUrl } = useAuth();
  if (!visible) return null;

  return (
    <Sheet visible onClose={onClose} title="Instance">
      <View style={{ gap: 14, paddingBottom: 12 }}>
        <AppText variant="body">
          Connected to {instanceUrl ? instanceLabel(instanceUrl) : 'nothing'}.
        </AppText>
        <AppText variant="hint">
          Switching signs you out of this instance. Your account here is not
          affected.
        </AppText>
        <Button
          variant="ghost"
          onPress={async () => {
            // The base URL is read per request, so clearing it and the session
            // is the whole of switching -- no restart, no rebuild.
            await setInstanceUrl(null);
            onSwitch();
            onClose();
          }}
        >
          Switch instance
        </Button>
      </View>
    </Sheet>
  );
}
