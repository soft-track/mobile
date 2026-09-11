import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Appearance, type ColorSchemeName } from 'react-native';

import { THEME_KEY } from '@/storage/keys';
import { readPref, removePref, writePref } from '@/storage/prefs';
import { dark, light, type Tokens } from '@/ui/tokens';

/** What Appearance reports: a scheme, or nothing when the OS has no opinion. */
type SystemScheme = ColorSchemeName | null | undefined;

export type Theme = 'light' | 'dark';
/** `'system'` is represented by the *absence* of the stored key, as on web. */
export type ThemePreference = Theme | 'system';

/**
 * Resolve the theme the way `frontend/src/ui/theme.ts:13-23` does: an explicit
 * stored choice wins, and anything else (absent, corrupt, a stale value from an
 * older build) falls back to the system preference.
 *
 * Pure, so the branch table is unit-testable without a renderer.
 */
export function resolveTheme(stored: unknown, system: SystemScheme): Theme {
  if (stored === 'light' || stored === 'dark') return stored;
  return system === 'dark' ? 'dark' : 'light';
}

/** What the user explicitly chose, or `'system'` when nothing is stored. */
export function storedPreference(stored: unknown): ThemePreference {
  return stored === 'light' || stored === 'dark' ? stored : 'system';
}

type ThemeContextValue = {
  /** The resolved theme actually being painted. */
  theme: Theme;
  /** Tokens for `theme`. Named `t` because it is referenced constantly. */
  t: Tokens;
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => void;
  /** Binary light/dark flip, matching the web's single toggle button. */
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Read the persisted choice. Called once, behind the splash screen. */
export async function hydrateTheme(): Promise<ThemePreference> {
  return storedPreference(await readPref(THEME_KEY));
}

export function ThemeProvider({
  initialPreference,
  children,
}: {
  initialPreference: ThemePreference;
  children: ReactNode;
}) {
  const [preference, setPreferenceState] =
    useState<ThemePreference>(initialPreference);
  const [system, setSystem] = useState<SystemScheme>(() =>
    Appearance.getColorScheme(),
  );

  // Follow the OS live, but -- exactly as on web -- only while no explicit
  // choice is stored. A user who has picked a theme keeps it when the phone
  // switches to dark at sunset.
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystem(colorScheme);
    });
    return () => subscription.remove();
  }, []);

  const theme = resolveTheme(
    preference === 'system' ? null : preference,
    system,
  );

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    // Absence of the key *is* "system", so choosing it means removing the key.
    if (next === 'system') void removePref(THEME_KEY);
    else void writePref(THEME_KEY, next);
  }, []);

  const toggle = useCallback(() => {
    setPreferenceState((current) => {
      const resolved = resolveTheme(
        current === 'system' ? null : current,
        Appearance.getColorScheme(),
      );
      const next: Theme = resolved === 'dark' ? 'light' : 'dark';
      void writePref(THEME_KEY, next);
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      t: theme === 'dark' ? dark : light,
      preference,
      setPreference,
      toggle,
    }),
    [theme, preference, setPreference, toggle],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside a ThemeProvider');
  return value;
}

/** Convenience for the common case of only wanting the palette. */
export function useTokens(): Tokens {
  return useTheme().t;
}
