import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { LoginScreen } from '@/auth/login-screen';
import { AuthProvider } from '@/auth/auth-context';
import { ThemeProvider } from '@/ui/theme';

jest.mock('@/api/instance', () => {
  const actual = jest.requireActual('@/api/instance');
  return { ...actual, probeInstance: jest.fn() };
});

const { probeInstance } = jest.requireMock('@/api/instance');

/** RNTL 14 renders through a concurrent root, so `render` and `fireEvent` are
 *  both async -- an un-awaited fireEvent silently does nothing. */
function renderLogin() {
  const queryClient = new QueryClient({
    // gcTime 0 so no garbage-collection timer outlives the test and keeps the
    // jest event loop alive.
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <ThemeProvider initialPreference="light">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <LoginScreen />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  probeInstance.mockReset();
});

describe('LoginScreen', () => {
  it('renders the three inputs the issue calls for', async () => {
    const view = await renderLogin();

    expect(view.getByText('Server link')).toBeTruthy();
    // Labelled Email, not Username: the API only ever resolves the OAuth2
    // `username` field against the email column.
    expect(view.getByText('Email')).toBeTruthy();
    expect(view.getByText('Password')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Sign in' })).toBeTruthy();
  });

  it('rejects a malformed server link before touching the network', async () => {
    const view = await renderLogin();

    await fireEvent.changeText(
      view.getByPlaceholderText('https://track.yourcompany.com'),
      'not a url',
    );
    await fireEvent.press(view.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(
        view.getByText('That server link does not look like a web address.'),
      ).toBeTruthy();
    });
    expect(probeInstance).not.toHaveBeenCalled();
  });

  it('reports an unreachable instance instead of posting credentials', async () => {
    probeInstance.mockResolvedValue({
      ok: false,
      reason: 'unreachable',
      message: 'Could not reach track.acme.dev. Check the link and your connection.',
    });

    const view = await renderLogin();

    await fireEvent.changeText(
      view.getByPlaceholderText('https://track.yourcompany.com'),
      'track.acme.dev',
    );
    await fireEvent.changeText(view.getByPlaceholderText('you@company.com'), 'a@b.com');
    await fireEvent.press(view.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(
        view.getByText('Could not reach track.acme.dev. Check the link and your connection.'),
      ).toBeTruthy();
    });
    // A bare host is normalized to https:// before anything is probed.
    expect(probeInstance).toHaveBeenCalledWith('https://track.acme.dev');
  });
});
