/**
 * @jest-environment node
 */
import { loginAuthLoginPost, meAuthMeGet } from '@/api/generated/endpoints/auth/auth';
import { listMyTeamsTeamsGet } from '@/api/generated/endpoints/teams/teams';
import { normalizeInstanceUrl, probeInstance, setInstanceUrl } from '@/api/instance';
import { getAccessToken, persistToken } from '@/auth/session';

/**
 * End-to-end against a real SoftTrack instance, driving the same modules the app
 * does -- the mutator, the instance store and the generated client.
 *
 * Opt-in, because it needs a server:
 *
 *   cd ../soft-track && docker compose up -d
 *   SOFTTRACK_LIVE_URL=http://localhost:8000 npm test
 *
 * Skipped otherwise, so CI stays hermetic.
 *
 * Runs in the node environment on purpose: jest-expo's default environment has
 * no XMLHttpRequest, so axios silently resolves every request to an empty
 * response instead of reaching the server.
 */
const LIVE_URL = process.env.SOFTTRACK_LIVE_URL;
const DEMO_EMAIL = process.env.SOFTTRACK_LIVE_EMAIL ?? 'demo@softtrack.dev';
const DEMO_PASSWORD = process.env.SOFTTRACK_LIVE_PASSWORD ?? 'password123';

const describeLive = LIVE_URL ? describe : describe.skip;

describeLive('against a live instance', () => {
  const base = normalizeInstanceUrl(LIVE_URL ?? '') ?? '';

  beforeAll(async () => {
    await setInstanceUrl(base);
    await persistToken(null);
  });

  it('probes as a SoftTrack instance', async () => {
    const result = await probeInstance(base);
    expect(result.ok).toBe(true);
    if (result.ok) expect(typeof result.config.open_registration).toBe('boolean');
  });

  it('reports a server that is not SoftTrack', async () => {
    const result = await probeInstance('http://127.0.0.1:1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('unreachable');
  });

  it('signs in through the generated client', async () => {
    // The real test of the URLSearchParams handling in the mutator: the body has
    // to arrive form-encoded or the backend answers 422.
    const token = await loginAuthLoginPost({
      username: DEMO_EMAIL,
      password: DEMO_PASSWORD,
    });

    expect(token.access_token).toEqual(expect.any(String));
    expect(token.token_type).toBe('bearer');
    // The login response embeds the user, which is why the app seeds the query
    // cache instead of following up with /auth/me.
    expect(token.user.email).toBe(DEMO_EMAIL);

    await persistToken(token.access_token);
  });

  it('attaches the token to subsequent requests', async () => {
    const me = await meAuthMeGet();
    expect(me.email).toBe(DEMO_EMAIL);
    expect(me).toHaveProperty('avatar_color');
  });

  it('loads the teams the home screen renders', async () => {
    const teams = await listMyTeamsTeamsGet();
    expect(Array.isArray(teams)).toBe(true);
    for (const team of teams) {
      expect(team).toHaveProperty('key');
      expect(team.key).toBe(team.key.toUpperCase());
    }
  });

  it('surfaces a bad password without destroying the session', async () => {
    const before = getAccessToken();
    expect(before).not.toBeNull();

    await expect(
      loginAuthLoginPost({ username: DEMO_EMAIL, password: 'wrong-password' }),
    ).rejects.toMatchObject({ response: { status: 401 } });

    // The public-path guard: a failed sign-in is a 401 too.
    expect(getAccessToken()).toBe(before);
  });

  it('clears the session on a 401 from a protected route', async () => {
    await persistToken('not-a-real-token');
    await expect(meAuthMeGet()).rejects.toMatchObject({ response: { status: 401 } });
    expect(getAccessToken()).toBeNull();
  });
});
