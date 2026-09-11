import { resolveColor } from '@/ui/color';
import { dark, light } from '@/ui/tokens';

describe('resolveColor', () => {
  it('passes through what React Native can already paint', () => {
    expect(resolveColor('#6342db', light)).toBe('#6342db');
    expect(resolveColor('#FFF', light)).toBe('#FFF');
    expect(resolveColor('rgba(0,0,0,0.5)', light)).toBe('rgba(0,0,0,0.5)');
    expect(resolveColor('tomato', light)).toBe('tomato');
  });

  it('resolves the CSS variable production actually stores', () => {
    // A user-created status on the production instance carries exactly this,
    // and React Native renders it as nothing.
    expect(resolveColor('var(--color-status-progress)', light)).toBe(light.status.progress);
  });

  it('resolves every family the web can emit', () => {
    expect(resolveColor('var(--color-status-done)', light)).toBe(light.status.done);
    expect(resolveColor('var(--color-priority-urgent)', light)).toBe(light.priority.urgent);
    expect(resolveColor('var(--color-accent-sky)', light)).toBe(light.accent.sky);
    expect(resolveColor('var(--color-brand-600)', light)).toBe(light.brand[600]);
    expect(resolveColor('var(--color-neutral-400)', light)).toBe(light.neutral[400]);
  });

  it('resolves against the active theme, not a fixed palette', () => {
    // The neutral ramp inverts in dark, so the same variable is a different
    // colour -- which is the whole reason this takes tokens.
    expect(resolveColor('var(--color-neutral-900)', light)).toBe(light.neutral[900]);
    expect(resolveColor('var(--color-neutral-900)', dark)).toBe(dark.neutral[900]);
    expect(light.neutral[900]).not.toBe(dark.neutral[900]);
  });

  it('honours a fallback inside the variable syntax by ignoring it safely', () => {
    expect(resolveColor('var(--color-status-done, #fff)', light)).toBe(light.status.done);
  });

  it('falls back visibly rather than to nothing', () => {
    // An unknown variable, junk, or a missing value must still paint something.
    for (const input of ['var(--color-unknown-thing)', 'var(--nonsense)', '', null, undefined, '#nothex']) {
      expect(resolveColor(input as string, light)).toBe(light.neutral[400]);
    }
    expect(resolveColor(null, light, light.brand[600])).toBe(light.brand[600]);
  });
});
