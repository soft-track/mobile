import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { LoginScreen } from '@/auth/login-screen';
import { AuthProvider } from '@/auth/auth-context';
import { ThemeProvider } from '@/ui/theme';

jest.mock('@/api/instance', () => {
  const actual = jest.requireActual('@/api/instance');
  return { ...actual, probeInstance: jest.fn() };
});

const { probeInstance, setInstanceUrl } = jest.requireMock('@/api/instance');

const CONFIG_OPEN = {
  open_registration: true,
  landing_page: true,
  demo_credentials: true,
};

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

beforeEach(async () => {
  probeInstance.mockReset();
  await setInstanceUrl(null);
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

describe('LoginScreen, once the instance has answered', () => {
  /**
   * Pre-seeding the stored instance makes the field start populated, and
   * `useDebouncedValue` starts settled on its initial value -- so the probe
   * fires on mount with no timer to wait out.
   */
  async function renderConnected(config: Partial<typeof CONFIG_OPEN>) {
    await setInstanceUrl('https://track.acme.dev');
    probeInstance.mockResolvedValue({ ok: true, config: { ...CONFIG_OPEN, ...config } });
    return renderLogin();
  }

  it('offers the demo account only where the instance advertises one', async () => {
    const view = await renderConnected({ demo_credentials: true });

    const hint = await view.findByLabelText('Use the demo account');
    // Derived, not written back in an effect: the field shows the demo address
    // as soon as the config says there is one.
    expect(view.getByDisplayValue('demo@softtrack.dev')).toBeTruthy();

    await fireEvent.press(hint);
    expect(view.getByDisplayValue('password123')).toBeTruthy();
  });

  it('says nothing about a demo account where there is none', async () => {
    const view = await renderConnected({ demo_credentials: false });

    await waitFor(() => expect(probeInstance).toHaveBeenCalled());
    expect(view.queryByLabelText('Use the demo account')).toBeNull();
    expect(view.queryByDisplayValue('demo@softtrack.dev')).toBeNull();
  });

  it('offers sign-up only where registration is open', async () => {
    const open = await renderConnected({ open_registration: true });
    expect(await open.findByLabelText('Create an account')).toBeTruthy();

    // An invite-only instance would make the register screen a dead end.
    const closed = await renderConnected({ open_registration: false });
    await waitFor(() => expect(probeInstance).toHaveBeenCalled());
    expect(closed.queryByLabelText('Create an account')).toBeNull();
  });
});
