import { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useTokens } from '@/ui/theme';
import type { Tokens } from '@/ui/tokens';

/**
 * The shared primitives, sized from the web's control metrics in
 * `frontend/src/index.css` and scaled up where a touch target demands it -- a
 * 34px `.btn` is fine with a mouse and too small for a thumb, so buttons and
 * fields are 48px here.
 */

const SANS = Platform.select({ ios: 'System', default: 'sans-serif' });
const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

export type TextVariant =
  | 'title'
  | 'heading'
  | 'body'
  | 'muted'
  | 'label'
  | 'eyebrow'
  | 'hint'
  | 'identifier';

function textStyle(variant: TextVariant, t: Tokens) {
  switch (variant) {
    case 'title':
      // .page-title -- 1.5rem/600, tracking tight
      return { fontSize: 24, fontWeight: '700' as const, color: t.neutral[900], letterSpacing: -0.4 };
    case 'heading':
      return { fontSize: 17, fontWeight: '600' as const, color: t.neutral[900] };
    case 'body':
      return { fontSize: 15, fontWeight: '400' as const, color: t.neutral[900] };
    case 'muted':
      return { fontSize: 14, fontWeight: '400' as const, color: t.neutral[400] };
    case 'label':
      // .field label -- 0.8125rem/13px
      return { fontSize: 13, fontWeight: '500' as const, color: t.neutral[600] };
    case 'eyebrow':
      // .eyebrow -- 11px, 600, 0.08em tracking, uppercase, neutral-400
      return {
        fontSize: 11,
        fontWeight: '600' as const,
        color: t.neutral[400],
        letterSpacing: 0.9,
      };
    case 'hint':
      return { fontSize: 12, fontWeight: '400' as const, color: t.neutral[400] };
    case 'identifier':
      // .identifier -- monospace, tabular, for issue keys like ENG-42
      return { fontSize: 12, fontWeight: '600' as const, color: t.neutral[500], fontFamily: MONO };
  }
}

export function AppText({
  variant = 'body',
  children,
  style,
  numberOfLines,
}: {
  variant?: TextVariant;
  children: ReactNode;
  style?: ViewStyle | object;
  numberOfLines?: number;
}) {
  const t = useTokens();
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[{ fontFamily: SANS }, textStyle(variant, t), style]}
    >
      {children}
    </Text>
  );
}

export function Card({
  children,
  variant = 'card',
  style,
}: {
  children: ReactNode;
  variant?: 'card' | 'strong';
  style?: ViewStyle;
}) {
  const t = useTokens();
  return (
    <View
      style={[
        {
          backgroundColor: variant === 'strong' ? t.surface.strong : t.surface.card,
          borderRadius: variant === 'strong' ? t.radius.panel : t.radius.card,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: t.surface.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Field({
  label,
  hint,
  style,
  ...inputProps
}: { label: string; hint?: string; style?: ViewStyle } & TextInputProps) {
  const t = useTokens();
  return (
    <View style={[{ gap: 6 }, style]}>
      <AppText variant="label">{label}</AppText>
      <TextInput
        placeholderTextColor={t.neutral[300]}
        {...inputProps}
        style={{
          height: 48,
          paddingHorizontal: 14,
          borderRadius: t.radius.control,
          borderWidth: 1,
          borderColor: t.line.field,
          backgroundColor: t.surface.card,
          color: t.neutral[900],
          fontSize: 15,
          fontFamily: SANS,
        }}
      />
      {hint ? <AppText variant="hint">{hint}</AppText> : null}
    </View>
  );
}

export function Button({
  children,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
}: {
  children: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const t = useTokens();
  const inactive = disabled || loading;

  const label = (
    <Text
      style={{
        fontFamily: SANS,
        fontSize: 15,
        fontWeight: '600',
        color:
          variant === 'primary' ? '#ffffff' : variant === 'danger' ? t.danger[700] : t.neutral[700],
      }}
    >
      {children}
    </Text>
  );

  const content = loading ? (
    <ActivityIndicator color={variant === 'primary' ? '#ffffff' : t.neutral[500]} />
  ) : (
    label
  );

  const base: ViewStyle = {
    height: 48,
    borderRadius: t.radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    opacity: inactive ? 0.6 : 1,
  };

  if (variant === 'primary') {
    return (
      <Pressable
        onPress={onPress}
        disabled={inactive}
        accessibilityRole="button"
        accessibilityLabel={children}
        accessibilityState={{ disabled: inactive, busy: loading }}
        style={style}
      >
        {/* .btn-primary -- linear-gradient(135deg, brand-500, accent-sky) */}
        <LinearGradient
          colors={[t.brand[500], t.accent.sky]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={base}
        >
          {content}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={children}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={[
        base,
        {
          backgroundColor: variant === 'danger' ? t.danger[50] : t.line.ghost,
        },
        style,
      ]}
    >
      {content}
    </Pressable>
  );
}

export function Alert({ children }: { children: string }) {
  const t = useTokens();
  return (
    <View
      style={{
        backgroundColor: t.danger[50],
        borderRadius: t.radius.control,
        borderWidth: 1,
        borderColor: t.danger[500],
        padding: 12,
      }}
    >
      <Text style={{ fontFamily: SANS, fontSize: 14, color: t.danger[700] }}>{children}</Text>
    </View>
  );
}

export function Loading() {
  const t = useTokens();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={t.brand[600]} />
    </View>
  );
}

/**
 * The brand mark from `frontend/src/ui/Logo.tsx`: a rounded square carrying a
 * brand-to-sky diagonal gradient with three staggered white bars.
 */
export function Logo({ size = 40 }: { size?: number }) {
  const t = useTokens();
  const bar = (width: number) => ({
    width: size * width,
    height: Math.max(2, size * 0.075),
    borderRadius: 999,
    backgroundColor: '#ffffff',
  });

  return (
    <LinearGradient
      colors={[t.brand[400], t.brand[600], t.accent.sky]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        alignItems: 'center',
        justifyContent: 'center',
        gap: size * 0.09,
      }}
    >
      <View style={bar(0.46)} />
      <View style={bar(0.32)} />
      <View style={bar(0.4)} />
    </LinearGradient>
  );
}

/**
 * The team key tile from the mockups. The colour is a stable hash of the key, so
 * a given team looks the same on every device without the API carrying a colour
 * for it.
 */
export function TeamBadge({ teamKey, size = 44 }: { teamKey: string; size?: number }) {
  const t = useTokens();
  const palette = [t.brand[600], t.accent.pink, t.accent.mint, t.accent.sky, t.accent.amber];
  let hash = 0;
  for (let i = 0; i < teamKey.length; i += 1) hash = (hash * 31 + teamKey.charCodeAt(i)) >>> 0;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: t.radius.control,
        backgroundColor: palette[hash % palette.length],
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontFamily: SANS, fontSize: size * 0.4, fontWeight: '700', color: '#ffffff' }}>
        {teamKey.slice(0, 1).toUpperCase()}
      </Text>
    </View>
  );
}

/** Circular initials on the server-supplied `avatar_color`. */
export function Avatar({ name, color, size = 40 }: { name: string; color: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        backgroundColor: color,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontFamily: SANS, fontSize: size * 0.36, fontWeight: '700', color: '#ffffff' }}>
        {initials}
      </Text>
    </View>
  );
}
