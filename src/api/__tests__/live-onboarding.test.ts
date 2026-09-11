/**
 * @jest-environment node
 */
import {
  loginAuthLoginPost,
  myInvitesAuthMeInvitesGet,
  registerAuthRegisterPost,
} from '@/api/generated/endpoints/auth/auth';
import {
  acceptInviteInvitesTokenAcceptPost,
  createInviteTeamsTeamIdInvitesPost,
  previewInviteInvitesTokenGet,
} from '@/api/generated/endpoints/invites/invites';
import {
  createTeamTeamsPost,
  listMyTeamsTeamsGet,
} from '@/api/generated/endpoints/teams/teams';
import { formatDuration, retryAfterSeconds } from '@/api/errors';
import { setInstanceUrl } from '@/api/instance';
import { persistToken } from '@/auth/session';

/**
 * The onboarding path -- register, create a team, invite, accept -- against a
 * real instance.
 *
 * Opt-in, same as `live.test.ts`:
 *
 *   cd ../soft-track && docker compose up -d
 *   SOFTTRACK_LIVE_URL=http://localhost:8000 npm test
 *
 * Writes real rows, so every run uses a fresh address and team key derived from
 * the index passed in, never a fixed one.
 */
const LIVE_URL = process.env.SOFTTRACK_LIVE_URL;
const describeLive = LIVE_URL ? describe : describe.skip;

/** Unique per run without Math.random, which jest-expo's env makes awkward. */
const RUN = `${process.pid}${Date.now().toString(36).slice(-4)}`.slice(-8).toLowerCase();
// example.com, not example.test: email-validator rejects special-use TLDs
// outright, which is a 422 before the account logic is ever reached.
const newEmail = (tag: string) => `mob-${tag}-${RUN}@example.com`;

/** Keys are 2-6 letters and permanent, so each run needs its own. */
function teamKeyFor(tag: string): string {
  const letters = `${tag}${RUN}`.replace(/[^a-z]/g, '').toUpperCase();
  return (letters + 'XXXXXX').slice(0, 6);
}

/**
 * Two registrations per run, deliberately: registration is throttled per IP -- 10 free, then exponential backoff up to an
 * hour (`backend/lib_utils/rate_limit.py`), charged even on success. This suite
 * creates three or four accounts per run, so running it repeatedly will hit it.
 * Turn that into something actionable rather than a bare AxiosError.
 */
async function register(...args: Parameters<typeof registerAuthRegisterPost>) {
  try {
    return await registerAuthRegisterPost(...args);
  } catch (err) {
    const wait = retryAfterSeconds(err);
    if (wait !== null) {
      throw new Error(
        `The instance is throttling registrations for ${formatDuration(wait)}. ` +
          'This suite registers real accounts, so re-running it in quick succession ' +
          'exhausts the per-IP budget. The counter is in-memory in the API ' +
          'process, so `docker compose restart backend` clears it without ' +
          'touching the database.',
      );
    }
    throw err;
  }
}

describeLive('onboarding against a live instance', () => {
  beforeAll(async () => {
    await setInstanceUrl(LIVE_URL!);
    await persistToken(null);
  });

  it('registers a new account and signs it in', async () => {
    const email = newEmail('reg');
    const token = await register({
      email,
      password: 'password123',
      full_name: 'Mobile Test',
    });

    expect(token.access_token).toEqual(expect.any(String));
    expect(token.user.email).toBe(email);
    // Derived from the address when not supplied (lib_identity/usernames.py).
    expect(token.user.username).toEqual(expect.any(String));

    await persistToken(token.access_token);
    // A brand new account belongs to nothing yet -- the empty state the teams
    // home and the board both have to handle.
    expect(await listMyTeamsTeamsGet()).toEqual([]);
  });

  it('rejects a password the backend considers too short', async () => {
    await expect(
      register({
        email: newEmail('short'),
        password: 'short',
        full_name: 'Too Short',
      }),
      // 422, whose `detail` is an ARRAY -- the case the web's errorDetail
      // drops and this one joins.
    ).rejects.toMatchObject({ response: { status: 422 } });
  });

  it('creates a team and uppercases its key', async () => {
    const key = teamKeyFor('a');
    const team = await createTeamTeamsPost({ name: 'Mobile QA', key: key.toLowerCase() });

    // lib_softtrack/teams.py:69 uppercases on the way in, which is what keeps
    // lowercase tab routes from ever colliding with a team key.
    expect(team.key).toBe(key);
    expect((await listMyTeamsTeamsGet()).map((t) => t.key)).toContain(key);
  });

  it('carries an invitation through preview and acceptance', async () => {
    // Signed in as the account from the first test, which owns a team now.
    const teams = await listMyTeamsTeamsGet();
    const team = teams[0];
    expect(team).toBeDefined();

    const guestEmail = newEmail('guest');
    const invite = await createInviteTeamsTeamIdInvitesPost(team.id, {
      email: guestEmail,
      role: 'member',
    });

    // The preview is public -- it is what the invite screen shows before the
    // recipient has any account at all.
    await persistToken(null);
    const preview = await previewInviteInvitesTokenGet(invite.token);
    expect(preview.team_key).toBe(team.key);
    expect(preview.email).toBe(guestEmail);
    expect(preview.role).toBe('member');

    // Registering with the token accepts the invitation best-effort, so the
    // team list is the thing to check rather than the register response.
    const guest = await register({
      email: guestEmail,
      password: 'password123',
      full_name: 'Invited Guest',
      invite_token: invite.token,
    });
    await persistToken(guest.access_token);
    expect((await listMyTeamsTeamsGet()).map((t) => t.key)).toContain(team.key);
  });

  it('surfaces a pending invitation to an existing account', async () => {
    // The banner case: someone who already has an account is invited to another
    // team, and with no email delivery this is the only way they find out.
    //
    // Reuses the guest registered by the previous test rather than creating a
    // third account. Registration is throttled at 10 per IP and charged even on
    // success, so a suite that registered once per scenario would throttle
    // itself after two runs.
    const owner = await loginAuthLoginPost({
      username: newEmail('reg'),
      password: 'password123',
    });
    await persistToken(owner.access_token);

    const second = await createTeamTeamsPost({
      name: 'Mobile Ops',
      key: teamKeyFor('b'),
    });
    const invite = await createInviteTeamsTeamIdInvitesPost(second.id, {
      email: newEmail('guest'),
      role: 'admin',
    });

    const guest = await loginAuthLoginPost({
      username: newEmail('guest'),
      password: 'password123',
    });
    await persistToken(guest.access_token);

    const pending = await myInvitesAuthMeInvitesGet();
    expect(pending.map((i) => i.token)).toContain(invite.token);
    expect(pending.find((i) => i.token === invite.token)?.role).toBe('admin');

    const joined = await acceptInviteInvitesTokenAcceptPost(invite.token);
    expect(joined.key).toBe(second.key);
    expect(await myInvitesAuthMeInvitesGet()).toEqual([]);
  });
});
