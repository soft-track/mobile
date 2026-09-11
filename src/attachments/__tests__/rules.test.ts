import { contentTypeFor, formatBytes, MAX_BYTES, rejectionFor } from '@/attachments/rules';
import { filenameFrom } from '@/attachments/upload';

describe('contentTypeFor', () => {
  it('accepts what the server accepts', () => {
    expect(contentTypeFor('shot.PNG')).toBe('image/png');
    expect(contentTypeFor('notes.md')).toBe('text/markdown');
    expect(contentTypeFor('fix.patch')).toBe('text/plain');
    expect(contentTypeFor('clip.mov')).toBe('video/quicktime');
  });

  it('refuses what it does not', () => {
    expect(contentTypeFor('page.html')).toBeNull();
    expect(contentTypeFor('noextension')).toBeNull();
  });
});

describe('rejectionFor', () => {
  it('says why an SVG is refused rather than just refusing it', () => {
    // The server leaves SVG out deliberately: it is a document that can carry
    // script. A generic "not allowed" would read as an oversight.
    const rejection = rejectionFor('diagram.svg', 1000);
    expect(rejection?.reason).toBe('type');
    expect(rejection?.message).toContain('script');
  });

  it('names the file and the limit when it is too big', () => {
    const rejection = rejectionFor('huge.zip', MAX_BYTES + 1);
    expect(rejection?.reason).toBe('size');
    expect(rejection?.message).toContain('huge.zip');
    expect(rejection?.message).toContain('25.0 MB');
  });

  it('passes a file the server would take', () => {
    expect(rejectionFor('shot.png', 500_000)).toBeNull();
    // Unknown size is not a reason to refuse; the server has the final say.
    expect(rejectionFor('shot.png', undefined)).toBeNull();
  });
});

describe('filenameFrom', () => {
  it('keeps the extension the server validates on', () => {
    expect(filenameFrom('file:///var/tmp/ABC123.jpg')).toBe('ABC123.jpg');
    expect(filenameFrom('file:///tmp/my%20shot.png')).toBe('my shot.png');
  });

  it('invents a name with an extension when the camera gives none', () => {
    expect(filenameFrom('file:///var/tmp/ABC123')).toMatch(/^upload-\d+\.jpg$/);
  });
});

describe('formatBytes', () => {
  it('reads the way a person would say it', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});
