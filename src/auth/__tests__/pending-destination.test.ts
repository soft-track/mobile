import {
  clearDestination,
  deepLinkPath,
  peekDestination,
  rememberDestination,
  takeDestination,
} from '@/auth/pending-destination';

beforeEach(() => clearDestination());

describe('rememberDestination', () => {
  it('keeps a same-app absolute path', () => {
    rememberDestination('/invite/abc123');
    expect(peekDestination()).toBe('/invite/abc123');
  });

  it('refuses shapes that could aim elsewhere', () => {
    // The web's signInDestination rejects these for open-redirect reasons
    // (frontend/src/auth/redirect.ts); a crafted deep link is the same risk.
    for (const hostile of ['//evil.example', '/\\evil.example', 'https://evil.example']) {
      clearDestination();
      rememberDestination(hostile);
      expect(peekDestination()).toBeNull();
    }
  });

  it('ignores the auth screens themselves', () => {
    // Recording /login as somewhere to return to after signing in is a loop.
    rememberDestination('/login');
    expect(peekDestination()).toBeNull();
    rememberDestination('/register?invite=abc');
    expect(peekDestination()).toBeNull();
  });

  it('ignores nothing at all', () => {
    rememberDestination(null);
    rememberDestination(undefined);
    rememberDestination('');
    expect(peekDestination()).toBeNull();
  });
});

describe('takeDestination', () => {
  it('replays a destination exactly once', () => {
    rememberDestination('/ENG');
    expect(takeDestination()).toBe('/ENG');
    expect(takeDestination()).toBeNull();
  });
});

describe('deepLinkPath', () => {
  it('reads the path out of a custom-scheme link', () => {
    // softtrack://invite/abc puts "invite" where a host would go, which is why
    // this cannot just read a URL's pathname.
    expect(deepLinkPath('softtrack://invite/abc')).toBe('/invite/abc');
    expect(deepLinkPath('softtrack://ENG')).toBe('/ENG');
  });

  it('reads the path out of an https link', () => {
    expect(deepLinkPath('https://track.acme.dev/invite/abc')).toBe('/invite/abc');
    expect(deepLinkPath('https://track.acme.dev/ENG?filter=mine')).toBe('/ENG?filter=mine');
    expect(deepLinkPath('https://track.acme.dev')).toBe('/');
  });

  it('returns null for something that is not a link', () => {
    expect(deepLinkPath('not a link')).toBeNull();
    expect(deepLinkPath('softtrack://')).toBeNull();
  });
});
