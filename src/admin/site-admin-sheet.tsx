import { useState } from 'react';
import { Alert as RNAlert, Pressable, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import {
  resetPasswordAdminUsersUserIdResetPasswordPost,
  updateUserAdminUsersUserIdPatch,
  useListUsersAdminUsersGet,
} from '@/api/generated/endpoints/admin/admin';
import type { AdminUserRead, UserMe } from '@/api/generated/models';
import { errorDetail } from '@/api/errors';
import { AppText, Alert, Avatar, Button, Card, Field } from '@/ui/primitives';
import { Sheet } from '@/ui/sheet';
import { useDebouncedValue } from '@/ui/use-debounced-value';
import { useTokens } from '@/ui/theme';

/**
 * The user directory, per `docs/design/mobile/154-site-admin.svg`.
 *
 * Site admins only; the server refuses everyone else, and the entry point is
 * hidden for them so there is nothing to discover that would be denied.
 *
 * Every guard is the server's -- you cannot deactivate or demote yourself, and
 * the last active site admin is protected. Those two are checked here as well,
 * not to enforce them but so the action is explained rather than merely refused.
 */
const PAGE = 25;

export function SiteAdminSheet({
  visible,
  onClose,
  user,
}: {
  visible: boolean;
  onClose: () => void;
  user: UserMe | null;
}) {
  const t = useTokens();
  const queryClient = useQueryClient();

  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [error, setError] = useState<string | null>(null);
  const [resetting, setResetting] = useState<AdminUserRead | null>(null);

  const settled = useDebouncedValue(query.trim(), 300);
  const users = useListUsersAdminUsersGet(
    { q: settled || undefined, limit, offset: 0 },
    { query: { enabled: visible } },
  );

  const items = users.data?.items ?? [];
  const total = users.data?.total ?? 0;
  const activeAdmins = items.filter((row) => row.is_site_admin && row.is_active).length;

  async function run(action: () => Promise<void>, fallback: string) {
    setError(null);
    try {
      await action();
      await queryClient.invalidateQueries({ queryKey: ['/admin/users'] });
    } catch (err) {
      setError(errorDetail(err, fallback));
    }
  }

  function manage(row: AdminUserRead) {
    const isSelf = row.id === user?.id;
    // The page shows one page at a time, so this count is only a hint -- the
    // server has the real answer and will refuse regardless.
    const lastAdmin = row.is_site_admin && row.is_active && activeAdmins <= 1;

    const options: Parameters<typeof RNAlert.alert>[2] = [
      { text: 'Cancel', style: 'cancel' },
    ];

    if (!isSelf && !lastAdmin) {
      options.push({
        text: row.is_site_admin ? 'Revoke site admin' : 'Grant site admin',
        onPress: () =>
          void run(
            () =>
              updateUserAdminUsersUserIdPatch(row.id, {
                is_site_admin: !row.is_site_admin,
              }).then(() => undefined),
            'Could not change that role.',
          ),
      });
    }

    options.push({
      text: 'Set a password',
      onPress: () => setResetting(row),
    });

    if (!isSelf && !lastAdmin) {
      options.push({
        text: row.is_active ? 'Deactivate' : 'Reactivate',
        style: row.is_active ? 'destructive' : 'default',
        onPress: () =>
          void run(
            () =>
              updateUserAdminUsersUserIdPatch(row.id, {
                is_active: !row.is_active,
              }).then(() => undefined),
            'Could not change that account.',
          ),
      });
    }

    RNAlert.alert(
      row.full_name,
      isSelf
        ? 'You cannot deactivate or demote your own account.'
        : lastAdmin
          ? 'This is the last active site admin — promote somebody else first.'
          : row.email,
      options,
    );
  }

  if (!visible) return null;

  return (
    <Sheet visible onClose={onClose} title="All users">
      <View style={{ gap: 12, paddingBottom: 12 }}>
        {error ? <Alert>{error}</Alert> : null}

        <Field
          label="Search"
          value={query}
          onChangeText={setQuery}
          placeholder="Name, username or email"
          autoCapitalize="none"
          autoCorrect={false}
        />

        {items.map((row) => (
          <Pressable
            key={row.id}
            accessibilityRole="button"
            accessibilityLabel={`Manage ${row.full_name}`}
            onPress={() => manage(row)}
          >
            <Card
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                padding: 12,
                // A deactivated account is still listed, because reactivating
                // it is the whole point of it being here.
                opacity: row.is_active ? 1 : 0.55,
              }}
            >
              <Avatar name={row.full_name} color={row.avatar_color} size={32} />
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="body" numberOfLines={1} style={{ fontSize: 14 }}>
                  {row.full_name}
                  {row.id === user?.id ? ' (you)' : ''}
                </AppText>
                <AppText variant="hint" numberOfLines={1}>
                  {row.email} · {row.team_count} team{row.team_count === 1 ? '' : 's'}
                </AppText>
              </View>

              <View style={{ alignItems: 'flex-end', gap: 2 }}>
                {row.is_site_admin ? (
                  <AppText variant="hint" style={{ color: t.brand[600], fontWeight: '600' }}>
                    Site admin
                  </AppText>
                ) : null}
                {!row.is_active ? (
                  <AppText variant="hint" style={{ color: t.danger[700] }}>
                    Deactivated
                  </AppText>
                ) : null}
              </View>
            </Card>
          </Pressable>
        ))}

        {items.length === 0 && !users.isPending ? (
          <AppText variant="muted">No account matches that.</AppText>
        ) : null}

        {total > items.length ? (
          <Button variant="ghost" onPress={() => setLimit((current) => current + PAGE)}>
            Show more
          </Button>
        ) : null}
      </View>

      {resetting ? (
        <SetPasswordSheet
          row={resetting}
          onClose={() => setResetting(null)}
          onRun={run}
        />
      ) : null}
    </Sheet>
  );
}

/**
 * Setting a password for somebody locked out.
 *
 * The admin types it and passes it on out of band -- there is no email here to
 * send a reset link through, which is exactly why this exists.
 */
function SetPasswordSheet({
  row,
  onClose,
  onRun,
}: {
  row: AdminUserRead;
  onClose: () => void;
  onRun: (action: () => Promise<void>, fallback: string) => Promise<void>;
}) {
  const [password, setPassword] = useState('');
  const [invalid, setInvalid] = useState<string | null>(null);

  return (
    <Sheet visible onClose={onClose} title={`Password for ${row.full_name}`}>
      <View style={{ gap: 12, paddingBottom: 12 }}>
        {invalid ? <Alert>{invalid}</Alert> : null}

        <Field
          label="New password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          hint="At least 8 characters. Tell them out of band — nothing is emailed."
        />

        <Button
          onPress={() => {
            if (password.length < 8) {
              setInvalid('Passwords must be at least 8 characters.');
              return;
            }
            setInvalid(null);
            void onRun(async () => {
              await resetPasswordAdminUsersUserIdResetPasswordPost(row.id, {
                new_password: password,
              });
              setPassword('');
              onClose();
            }, 'Could not set that password.');
          }}
        >
          Set password
        </Button>
      </View>
    </Sheet>
  );
}
