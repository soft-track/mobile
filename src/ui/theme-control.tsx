import { Pressable, View } from 'react-native';

import { Icon } from '@/ui/icon';
import { AppText } from '@/ui/primitives';
import { useTheme, type ThemePreference } from '@/ui/theme';

/** The compact sun/moon toggle the web puts in its sidebar header. */
export function ThemeControl() {
  const { theme, toggle, t } = useTheme();
  return (
    <Pressable
      onPress={toggle}
      accessibilityRole="button"
      accessibilityLabel={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      style={{
        width: 36,
        height: 36,
        borderRadius: t.radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: t.line.ghost,
      }}
    >
      <Icon name={theme === 'dark' ? 'moon' : 'sun'} size={18} color={t.neutral[600]} />
    </Pressable>
  );
}

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/**
 * The three-way control, for Settings.
 *
 * A strict superset of the web's binary toggle rather than a schema change:
 * "system" is the absence of the stored key, which is exactly how the web
 * already represents "never chose" (`frontend/src/ui/theme.ts:13-20`). The web
 * simply has no affordance to get back there once you have toggled.
 */
export function ThemePreferenceControl() {
  const { preference, setPreference, t } = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: t.line.well,
        borderRadius: t.radius.control,
        padding: 3,
        gap: 3,
      }}
    >
      {OPTIONS.map((option) => {
        const active = preference === option.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => setPreference(option.value)}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={active ? { selected: true } : {}}
            aria-selected={active}
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: t.radius.control - 3,
              alignItems: 'center',
              backgroundColor: active ? t.surface.card : 'transparent',
            }}
          >
            <AppText
              variant="label"
              style={{ color: active ? t.neutral[900] : t.neutral[500] }}
            >
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
