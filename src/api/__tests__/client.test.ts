import { AXIOS_INSTANCE } from '@/api/client';
import { setInstanceUrl } from '@/api/instance';
import { getAccessToken, persistToken } from '@/auth/session';

/**
 * These cover the three things the mobile mutator does that the web's does not,
 * each of which fails silently if it regresses.
 */

type RequestConfig = {
  url?: string;
  baseURL?: string;
  data?: unknown;
  headers: Record<string, string>;
};

/** Run the request interceptors the way axios would, without a network. */
async function runRequestInterceptors(
  config: Partial<RequestConfig>,
): Promise<RequestConfig> {
  let result: RequestConfig = { headers: {}, ...config };
  for (const handler of (AXIOS_INSTANCE.interceptors.request as never as {
    handlers: { fulfilled: (c: RequestConfig) => RequestConfig | Promise<RequestConfig> }[];
  }).handlers) {
    result = await handler.fulfilled(result);
  }
  return result;
}

async function runResponseError(error: unknown) {
  for (const handler of (AXIOS_INSTANCE.interceptors.response as never as {
    handlers: { rejected: (e: unknown) => unknown }[];
  }).handlers) {
    await expect(handler.rejected(error)).rejects.toBe(error);
  }
}

beforeEach(async () => {
  await persistToken(null);
  await setInstanceUrl(null);
});

describe('request interceptor', () => {
  it('takes the base URL from the instance store at request time', async () => {
    await setInstanceUrl('https://track.acme.dev');
    const config = await runRequestInterceptors({ url: '/teams' });
    expect(config.baseURL).toBe('https://track.acme.dev');
  });

  it('follows a change of instance without rebuilding the client', async () => {
    // The whole of issue #15's instance switch depends on this: hoisting
    // baseURL onto Axios.create would pin one build to one server.
    await setInstanceUrl('https://one.example');
    expect((await runRequestInterceptors({ url: '/teams' })).baseURL).toBe('https://one.example');

    await setInstanceUrl('https://two.example');
    expect((await runRequestInterceptors({ url: '/teams' })).baseURL).toBe('https://two.example');
  });

  it('attaches the bearer token only when there is one', async () => {
    expect(
      (await runRequestInterceptors({ url: '/teams' })).headers,
    ).not.toHaveProperty('Authorization');

    await persistToken('jwt-123');
    expect((await runRequestInterceptors({ url: '/teams' })).headers).toMatchObject({
      Authorization: 'Bearer jwt-123',
    });
  });

  it('serializes a URLSearchParams body itself', async () => {
    // React Native's URLSearchParams defines no Symbol.toStringTag, so axios's
    // isURLSearchParams check fails and it would JSON.stringify the body --
    // a 422 on every sign-in. Orval emits one of these for POST /auth/login.
    const body = new URLSearchParams();
    body.append('username', 'demo@softtrack.dev');
    body.append('password', 'pa ss&word');

    const config = await runRequestInterceptors({ url: '/auth/login', data: body });

    expect(typeof config.data).toBe('string');
    expect(config.data).toBe('username=demo%40softtrack.dev&password=pa+ss%26word');
  });

  it('leaves a JSON body alone', async () => {
    const config = await runRequestInterceptors({
      url: '/auth/register',
      data: { email: 'a@b.com' },
    });
    expect(config.data).toEqual({ email: 'a@b.com' });
  });
});

describe('response interceptor', () => {
  it('clears the session on a 401 from a protected route', async () => {
    await persistToken('jwt-123');
    await runResponseError({ config: { url: '/teams' }, response: { status: 401 } });
    expect(getAccessToken()).toBeNull();
  });

  it('does NOT clear the session on a 401 from /auth/login', async () => {
    // A wrong password is also a 401. Without the public-path guard, every
    // failed sign-in attempt would wipe an existing session and bounce the
    // router out from under the user.
    await persistToken('jwt-123');
    await runResponseError({ config: { url: '/auth/login' }, response: { status: 401 } });
    expect(getAccessToken()).toBe('jwt-123');
  });

  it('leaves the session alone for non-401 failures', async () => {
    await persistToken('jwt-123');
    await runResponseError({ config: { url: '/teams' }, response: { status: 500 } });
    expect(getAccessToken()).toBe('jwt-123');
  });
});
