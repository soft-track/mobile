import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Pressable, Text } from 'react-native';

import { AuthProvider, useAuth } from '@/auth/auth-context';
import { setInstanceUrl } from '@/api/instance';
import { persistToken } from '@/auth/session';
import type { Token, UserMe } from '@/api/generated/models';

/**
 * The regression this file exists for.
 *
 * Signing in stores a token and seeds /auth/me, and the root layout's gate is
 * meant to flip to the app the instant that happens. It did not: the gate read
 * the instance URL non-reactively, so a sign-in could store a valid token and
 * leave the user staring at the login screen -- "unable to see screen after
 * login" -- until a manual reload, which mounts fresh and reads everything at
 * once. Two things had to change together: the instance URL became a reactive
 * store like the token, and `setSession` now seeds the user before flipping the
 * token so the token-driven render never lands in the gap between the two.
 *
 * The test drives the real AuthProvider, session store, instance store and
 * generated /auth/me hook against a stubbed transport, so it fails if either
 * half regresses.
 */
jest.mock('@/api/client', () => ({
  apiClient: jest.fn(),
}));

const { apiClient } = jest.requireMock('@/api/client');

const USER: UserMe = {
  id: 3,
  email: 'qais@quantadev.io',
  username: 'qais',
  full_name: 'Qais Rasool',
  avatar_color: '#f59e0b',
  is_active: true,
  is_site_admin: false,
  created_at: '2026-09-12T17:31:22.081324',
};

const TOKEN: Token = { access_token: 'header.payload.sig', token_type: 'bearer', user: USER };

function route(config: { url?: string; method?: string }) {
  const url = config.url ?? '';
  if (url === '/auth/login') return Promise.resolve(TOKEN);
  if (url === '/auth/me') return Promise.resolve(USER);
  return Promise.reject(new Error(`unexpected request: ${config.method} ${url}`));
}

/** Renders the one thing the gate turns on, plus a button that signs in. */
function Harness() {
  const { status, signIn } = useAuth();
  return (
    <>
      <Text>status:{status}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="do sign in"
        onPress={() => {
          void signIn('https://softback.quantadev.io', USER.email, 'pw');
        }}
      >
        <Text>go</Text>
      </Pressable>
    </>
  );
}

function renderHarness() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Harness />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  apiClient.mockReset();
  apiClient.mockImplementation(route);
  // A fresh session every time: no token, no instance, exactly as a first launch.
  await persistToken(null);
  await setInstanceUrl(null);
});

describe('the auth gate on sign-in', () => {
  it('starts signed out with no session', async () => {
    const view = await renderHarness();
    expect(await view.findByText('status:signedOut')).toBeTruthy();
  });

  it('reaches signedIn after signing in, without a reload', async () => {
    const view = await renderHarness();
    await view.findByText('status:signedOut');

    await fireEvent.press(view.getByRole('button', { name: 'do sign in' }));

    // The whole point: the gate flips on its own once the token lands.
    await waitFor(() => expect(view.getByText('status:signedIn')).toBeTruthy());
  });

  it('never rests on signedOut once a token and instance are both set', async () => {
    // Guards the ordering half directly: setSession seeds the user before the
    // token, so no committed render sees a token without a user and reads it as
    // signed-out. If that reordering regresses, the seed-after-token gap makes
    // this flap to signedOut.
    const view = await renderHarness();
    await view.findByText('status:signedOut');
    await fireEvent.press(view.getByRole('button', { name: 'do sign in' }));
    await waitFor(() => expect(view.getByText('status:signedIn')).toBeTruthy());

    // And it stays there: a background /auth/me refetch resolves to the same
    // user rather than knocking the session back out.
    await waitFor(() => expect(apiClient).toHaveBeenCalled());
    expect(view.getByText('status:signedIn')).toBeTruthy();
  });
});
