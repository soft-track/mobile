/**
 * @jest-environment node
 */
import {
  changeMyPasswordAuthMePasswordPost,
  loginAuthLoginPost,
  meAuthMeGet,
  registerAuthRegisterPost,
  signOutEverywhereRouteAuthMeSignOutEverywherePost,
  updateMeAuthMePatch,
} from '@/api/generated/endpoints/auth/auth';
import {
  getNotificationSettingsNotificationsSettingsGet,
  updateNotificationSettingsNotificationsSettingsPatch,
} from '@/api/generated/endpoints/notifications/notifications';
import { setInstanceUrl } from '@/api/instance';
import { getAccessToken, persistToken } from '@/auth/session';

/**
 * Account settings against a real instance.
 *
 * Uses a throwaway account rather than the demo one, because these change a
 * password and invalidate sessions -- doing that to the account every other
 * suite signs in as would be antisocial.
 */
const LIVE_URL = process.env.SOFTTRACK_LIVE_URL;
const describeLive = LIVE_URL ? describe : describe.skip;

const RUN = Date.now().toString(36).slice(-5);
const EMAIL = `mob-settings-${RUN}@example.com`;
const PASSWORD = 'password123';

describeLive('account settings against a live instance', () => {
  beforeAll(async () => {
    await setInstanceUrl(LIVE_URL!);
    const token = await registerAuthRegisterPost({
      email: EMAIL,
      password: PASSWORD,
      full_name: 'Settings Tester',
    });
    await persistToken(token.access_token);
  });

  it('edits the profile fields the form offers', async () => {
    const updated = await updateMeAuthMePatch({
      full_name: 'Renamed Tester',
      username: `mob${RUN}`,
      avatar_color: '#14b8a6',
    });

    expect(updated.full_name).toBe('Renamed Tester');
    expect(updated.username).toBe(`mob${RUN}`);
    expect(updated.avatar_color).toBe('#14b8a6');
  });

  it('refuses an email change without the current password', async () => {
    // Which is exactly why the field only appears once the address is edited.
    await expect(
      updateMeAuthMePatch({ email: `changed-${RUN}@example.com` }),
    ).rejects.toMatchObject({ response: { status: 400 } });

    const withPassword = await updateMeAuthMePatch({
      email: `changed-${RUN}@example.com`,
      current_password: PASSWORD,
    });
    expect(withPassword.email).toBe(`changed-${RUN}@example.com`);
  });

  it('reports whether the instance can actually send email', async () => {
    const settings = await getNotificationSettingsNotificationsSettingsGet();
    expect(typeof settings.email_notifications).toBe('boolean');
    // The toggle is disabled and explained when this is false, rather than
    // silently doing nothing.
    expect(typeof settings.email_delivery_configured).toBe('boolean');

    const toggled = await updateNotificationSettingsNotificationsSettingsPatch({
      email_notifications: !settings.email_notifications,
    });
    expect(toggled.email_notifications).toBe(!settings.email_notifications);
  });

  it('hands back a working token when the password changes', async () => {
    const before = getAccessToken();

    const reissued = await changeMyPasswordAuthMePasswordPost({
      current_password: PASSWORD,
      new_password: 'password456',
    });
    expect(reissued.access_token).not.toBe(before);

    // The old token is dead -- which is why the app adopts the new one rather
    // than leaving the user signed out of the account they just secured.
    await persistToken(before);
    await expect(meAuthMeGet()).rejects.toMatchObject({ response: { status: 401 } });

    await persistToken(reissued.access_token);
    expect((await meAuthMeGet()).email).toBe(`changed-${RUN}@example.com`);
  });

  it('signs other devices out while keeping this one', async () => {
    // A second session, as if from another device.
    const other = await loginAuthLoginPost({
      username: `changed-${RUN}@example.com`,
      password: 'password456',
    });

    const reissued = await signOutEverywhereRouteAuthMeSignOutEverywherePost();
    await persistToken(reissued.access_token);
    expect((await meAuthMeGet()).email).toBe(`changed-${RUN}@example.com`);

    await persistToken(other.access_token);
    await expect(meAuthMeGet()).rejects.toMatchObject({ response: { status: 401 } });

    await persistToken(reissued.access_token);
  });
});
