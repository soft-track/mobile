import { instanceLabel, normalizeInstanceUrl } from '@/api/instance';

describe('normalizeInstanceUrl', () => {
  const accepted: [string, string][] = [
    // A bare host is what people actually type. Assume TLS.
    ['track.company.com', 'https://track.company.com'],
    ['  track.company.com  ', 'https://track.company.com'],
    ['https://track.company.com', 'https://track.company.com'],
    ['https://track.company.com/', 'https://track.company.com'],
    ['https://track.company.com///', 'https://track.company.com'],
    // Explicit http survives: plenty of self-hosted instances are LAN-only.
    ['http://192.168.1.20:8000', 'http://192.168.1.20:8000'],
    ['localhost:8000', 'https://localhost:8000'],
    // Host case is not significant; path case is.
    ['HTTPS://Track.Company.COM', 'https://track.company.com'],
    ['https://co.com/SoftTrack', 'https://co.com/SoftTrack'],
    // Reverse-proxied sub-paths are real deployments, so keep the path.
    ['https://co.com/softtrack/', 'https://co.com/softtrack'],
    // Query and fragment are never meaningful in a base URL -- drop, don't reject.
    ['https://co.com/?utm=1', 'https://co.com'],
    ['https://co.com/st?a=1#b', 'https://co.com/st'],
    // Zero-width characters survive a paste out of a chat app.
    ['https://co.com​', 'https://co.com'],
  ];

  it.each(accepted)('normalizes %j to %j', (input, expected) => {
    expect(normalizeInstanceUrl(input)).toBe(expected);
  });

  const rejected: [string, string][] = [
    ['', 'empty'],
    ['   ', 'whitespace only'],
    ['javascript:alert(1)', 'not a server'],
    ['file:///etc/passwd', 'not a server'],
    ['softtrack://open', 'not a server'],
    ['https://', 'no host'],
    ['https://user:pass@co.com', 'credentials in the URL are a phishing shape'],
    ['https://co.com:notaport', 'non-numeric port'],
    ['https://co.com:80:90', 'two ports'],
    ['https://two hosts.com', 'whitespace inside the authority'],
    ['https://under_score.com', 'underscore is not a legal host character'],
  ];

  it.each(rejected)('rejects %j (%s)', (input) => {
    expect(normalizeInstanceUrl(input)).toBeNull();
  });
});

describe('instanceLabel', () => {
  it('shows the host alone', () => {
    expect(instanceLabel('https://track.acme.dev')).toBe('track.acme.dev');
    expect(instanceLabel('https://track.acme.dev/st')).toBe('track.acme.dev');
    expect(instanceLabel('http://192.168.1.20:8000')).toBe('192.168.1.20:8000');
  });
});
