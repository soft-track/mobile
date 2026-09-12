import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from '@/ui/icon';
import { AppText, Button, Dot, Field } from '@/ui/primitives';
import { Sheet } from '@/ui/sheet';
import { useTokens } from '@/ui/theme';

/**
 * The pickers every issue property is edited through.
 *
 * The web uses `<select>` elements, which a phone has no equivalent of worth
 * having. A sheet of rows is the mobile idiom, and it is the same component for
 * creating an issue and for editing one -- the difference is only whether the
 * change is held locally or written straight through.
 */
export type PickerOption<T> = {
  value: T;
  label: string;
  /** A dot before the label: status colours, label colours, priority. */
  color?: string;
  hint?: string;
};

/** A tappable row showing a property's current value, opening the sheet. */
export function PropertyRow({
  label,
  value,
  color,
  onPress,
  muted = false,
}: {
  label: string;
  value: string;
  color?: string;
  onPress: () => void;
  muted?: boolean;
}) {
  const t = useTokens();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 12,
      }}
    >
      <AppText variant="label" style={{ width: 92 }}>
        {label}
      </AppText>
      {color ? <Dot color={color} /> : null}
      <AppText
        variant="body"
        numberOfLines={1}
        style={{ flex: 1, color: muted ? t.neutral[400] : t.neutral[900] }}
      >
        {value}
      </AppText>
      <Icon name="chevron-right" size={16} color={t.neutral[300]} />
    </Pressable>
  );
}

function OptionRow({
  label,
  color,
  hint,
  selected,
  onPress,
}: {
  label: string;
  color?: string;
  hint?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const t = useTokens();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={selected ? { selected: true } : {}}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 12,
        paddingHorizontal: 10,
        borderRadius: t.radius.control,
        backgroundColor: selected ? t.line.navActive : 'transparent',
      }}
    >
      {color ? <Dot color={color} size={10} /> : null}
      <View style={{ flex: 1 }}>
        <AppText variant="body" numberOfLines={1}>
          {label}
        </AppText>
        {hint ? <AppText variant="hint">{hint}</AppText> : null}
      </View>
      {selected ? <Icon name="check" size={16} color={t.brand[600]} /> : null}
    </Pressable>
  );
}

/**
 * Pick one value, or none.
 *
 * `null` is a real choice here rather than an absent one -- "no assignee" and
 * "not sized yet" are meaningful states the API distinguishes, so they get their
 * own row instead of being expressed by closing the sheet.
 */
export function SinglePicker<T extends string | number>({
  visible,
  title,
  options,
  selected,
  emptyLabel,
  onSelect,
  onClose,
  footer,
}: {
  visible: boolean;
  title: string;
  options: PickerOption<T>[];
  selected: T | null;
  /** Row for "none"; omitted when the property cannot be empty. */
  emptyLabel?: string;
  onSelect: (value: T | null) => void;
  onClose: () => void;
  footer?: ReactNode;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <View style={{ gap: 2, paddingBottom: 12 }}>
        {emptyLabel ? (
          <OptionRow
            label={emptyLabel}
            selected={selected === null}
            onPress={() => {
              onSelect(null);
              onClose();
            }}
          />
        ) : null}
        {options.map((option) => (
          <OptionRow
            key={String(option.value)}
            label={option.label}
            color={option.color}
            hint={option.hint}
            selected={selected === option.value}
            onPress={() => {
              onSelect(option.value);
              onClose();
            }}
          />
        ))}
        {footer}
      </View>
    </Sheet>
  );
}

/**
 * Pick any number of values.
 *
 * Stays open as things are ticked, because labels are chosen in handfuls --
 * closing after each one would mean reopening the sheet for every label.
 */
export function MultiPicker<T extends string | number>({
  visible,
  title,
  options,
  selected,
  onToggle,
  onClose,
  footer,
}: {
  visible: boolean;
  title: string;
  options: PickerOption<T>[];
  selected: T[];
  onToggle: (value: T) => void;
  onClose: () => void;
  footer?: ReactNode;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <View style={{ gap: 2, paddingBottom: 12 }}>
        {options.map((option) => (
          <OptionRow
            key={String(option.value)}
            label={option.label}
            color={option.color}
            selected={selected.includes(option.value)}
            onPress={() => onToggle(option.value)}
          />
        ))}
        {options.length === 0 ? (
          <View style={{ paddingVertical: 16, alignItems: 'center' }}>
            <AppText variant="muted">Nothing to choose from yet.</AppText>
          </View>
        ) : null}
        {footer}
      </View>
    </Sheet>
  );
}

/**
 * The inline "create one while you are here" row.
 *
 * The web lets any member add a label or project from the issue form, and
 * needing to leave for team settings to add a label mid-triage would be worse
 * on a phone than it is on a desktop.
 */
export function InlineCreate({
  placeholder,
  busy,
  onCreate,
}: {
  placeholder: string;
  busy: boolean;
  onCreate: (name: string) => void;
}) {
  const t = useTokens();
  const [name, setName] = useState('');

  return (
    <View
      style={{
        gap: 8,
        paddingTop: 12,
        marginTop: 8,
        borderTopWidth: 1,
        borderTopColor: t.line.hairline,
      }}
    >
      <Field
        label="Create new"
        value={name}
        onChangeText={setName}
        placeholder={placeholder}
        autoCapitalize="none"
        returnKeyType="done"
        onSubmitEditing={() => {
          if (name.trim()) {
            onCreate(name.trim());
            setName('');
          }
        }}
      />
      <Button
        variant="ghost"
        loading={busy}
        disabled={!name.trim()}
        onPress={() => {
          onCreate(name.trim());
          setName('');
        }}
      >
        Create
      </Button>
    </View>
  );
}
