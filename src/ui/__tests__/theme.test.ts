import { resolveTheme, storedPreference } from '@/ui/theme';
import { dark, light } from '@/ui/tokens';

describe('resolveTheme', () => {
  it('honours an explicit stored choice over the system', () => {
    expect(resolveTheme('dark', 'light')).toBe('dark');
    expect(resolveTheme('light', 'dark')).toBe('light');
  });

  it('follows the system when nothing is stored', () => {
    // Absence of the key IS "follow system" -- the same contract as the web's
    // `softtrack.theme`, so the two clients agree on what an empty store means.
    expect(resolveTheme(null, 'dark')).toBe('dark');
    expect(resolveTheme(null, 'light')).toBe('light');
    expect(resolveTheme(undefined, 'dark')).toBe('dark');
  });

  it('treats an unusable stored value as absent', () => {
    expect(resolveTheme('DARK', 'dark')).toBe('dark');
    expect(resolveTheme('sepia', 'light')).toBe('light');
    expect(resolveTheme(42, 'dark')).toBe('dark');
  });

  it('falls back to light when the system has no opinion', () => {
    expect(resolveTheme(null, null)).toBe('light');
    expect(resolveTheme(null, undefined)).toBe('light');
  });
});

describe('storedPreference', () => {
  it('maps anything that is not an explicit choice to system', () => {
    expect(storedPreference('dark')).toBe('dark');
    expect(storedPreference('light')).toBe('light');
    expect(storedPreference(null)).toBe('system');
    expect(storedPreference('nonsense')).toBe('system');
  });
});

describe('palettes', () => {
  it('inverts the neutral ramp in dark, as index.css does', () => {
    // The single most load-bearing fact about these tokens: a palette that
    // merely darkened the light one would render unreadable text.
    expect(light.neutral[50]).toBe('#f7f6fb');
    expect(dark.neutral[50]).toBe('#1b1a27');
    expect(light.neutral[900]).toBe('#15131f');
    expect(dark.neutral[900]).toBe('#f6f5fb');
  });

  it('keeps the brand colour that carries meaning identical across themes', () => {
    expect(light.brand[600]).toBe('#6342db');
    expect(dark.brand[600]).toBe('#6342db');
    // Only the two tint steps move.
    expect(light.brand[50]).toBe('#f3f1ff');
    expect(dark.brand[50]).toBe('#221d3d');
  });

  it('derives hairlines from whichever neutral ramp applies', () => {
    // color-mix(in oklab, neutral-900 9%, transparent) is neutral-900 at alpha .09.
    expect(light.line.hairline).toBe('rgba(21, 19, 31, 0.09)');
    expect(dark.line.hairline).toBe('rgba(246, 245, 251, 0.09)');
  });
});
