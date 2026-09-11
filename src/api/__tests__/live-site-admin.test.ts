/**
 * @jest-environment node
 */
import {
  listUsersAdminUsersGet,
  resetPasswordAdminUsersUserIdResetPasswordPost,
  updateUserAdminUsersUserIdPatch,
} from '@/api/generated/endpoints/admin/admin';
import {
  loginAuthLoginPost,
  meAuthMeGet,
  registerAuthRegisterPost,
} from '@/api/generated/endpoints/auth/auth';
import { setInstanceUrl } from '@/api/instance';
import { persistToken } from '@/auth/session';

/**
 * The user directory against a real instance.
 *
 * The demo account is a site admin, which is what makes this testable at all.
 */
const LIVE_URL = process.env.SOFTTRACK_LIVE_URL;
const describeLive = LIVE_URL ? describe : describe.skip;

const RUN = Date.now().toString(36).slice(-5);
const SUBJECT_EMAIL = `mob-subject-${RUN}@example.com`;

describeLive('site administration against a live instance', () => {
  let adminToken: string;
  let adminId: number;
  let subjectId: number;

  beforeAll(async () => {
    await setInstanceUrl(LIVE_URL!);
    const admin = await loginAuthLoginPost({
      username: process.env.SOFTTRACK_LIVE_EMAIL ?? 'demo@softtrack.dev',
      password: process.env.SOFTTRACK_LIVE_PASSWORD ?? 'password123',
    });
    adminToken = admin.access_token;
    adminId = admin.user.id;
    expect(admin.user.is_site_admin).toBe(true);

    const subject = await registerAuthRegisterPost({
      email: SUBJECT_EMAIL,
      password: 'password123',
      full_name: 'Directory Subject',
    });
    subjectId = subject.user.id;
    await persistToken(adminToken);
  });

  it('searches the directory', async () => {
    const page = await listUsersAdminUsersGet({ q: `mob-subject-${RUN}`, limit: 25 });
    const found = page.items.find((row) => row.id === subjectId);
    expect(found).toBeDefined();
    // Every field the row renders.
    expect(found?.email).toBe(SUBJECT_EMAIL);
    expect(found?.is_active).toBe(true);
    expect(found?.is_site_admin).toBe(false);
    expect(typeof found?.team_count).toBe('number');
  });

  it('grants and revokes site admin', async () => {
    const granted = await updateUserAdminUsersUserIdPatch(subjectId, {
      is_site_admin: true,
    });
    expect(granted.is_site_admin).toBe(true);

    const revoked = await updateUserAdminUsersUserIdPatch(subjectId, {
      is_site_admin: false,
    });
    expect(revoked.is_site_admin).toBe(false);
  });

  it('deactivates and reactivates, and a deactivated account cannot sign in', async () => {
    await updateUserAdminUsersUserIdPatch(subjectId, { is_active: false });

    // 403 with its own message, which is what login surfaces rather than
    // "incorrect password".
    await expect(
      loginAuthLoginPost({ username: SUBJECT_EMAIL, password: 'password123' }),
    ).rejects.toMatchObject({ response: { status: 403 } });

    const reactivated = await updateUserAdminUsersUserIdPatch(subjectId, {
      is_active: true,
    });
    expect(reactivated.is_active).toBe(true);
  });

  it('sets a password for somebody locked out', async () => {
    // There is no email here to send a reset link through, which is exactly why
    // this exists.
    await resetPasswordAdminUsersUserIdResetPasswordPost(subjectId, {
      new_password: 'brand-new-password',
    });

    const signedIn = await loginAuthLoginPost({
      username: SUBJECT_EMAIL,
      password: 'brand-new-password',
    });
    expect(signedIn.user.id).toBe(subjectId);
    await persistToken(adminToken);
  });

  it('refuses to let an admin deactivate or demote themselves', async () => {
    // Both guards the sheet explains up front rather than discovering.
    await expect(
      updateUserAdminUsersUserIdPatch(adminId, { is_active: false }),
    ).rejects.toMatchObject({ response: { status: 400 } });

    await expect(
      updateUserAdminUsersUserIdPatch(adminId, { is_site_admin: false }),
    ).rejects.toMatchObject({ response: { status: 400 } });

    // Still a working admin afterwards.
    expect((await meAuthMeGet()).is_site_admin).toBe(true);
  });
});
