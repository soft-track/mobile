import { useRef, useState } from 'react';
import { Pressable, TextInput, View, type TextInputSelectionChangeEventData } from 'react-native';

import { MarkdownBody } from '@/markdown/markdown';
import {
  applyMention,
  matchMentions,
  mentionQueryAt,
  type Mentionable,
} from '@/markdown/mentions';
import { AppText } from '@/ui/primitives';
import { useTokens } from '@/ui/theme';

/**
 * A markdown field with a preview toggle and `@` autocomplete.
 *
 * The suggestion list is driven by the caret rather than by the last character
 * typed, so it also opens when someone moves back into a half-written handle --
 * and closes on the second `@` of an email address, which is what stops it
 * appearing every time an address is pasted into a comment.
 */
export function MarkdownEditor({
  value,
  onChangeText,
  people,
  placeholder,
  minHeight = 110,
  autoFocus = false,
}: {
  value: string;
  onChangeText: (next: string) => void;
  people: Mentionable[];
  placeholder?: string;
  minHeight?: number;
  autoFocus?: boolean;
}) {
  const t = useTokens();
  const inputRef = useRef<TextInput>(null);
  const [preview, setPreview] = useState(false);
  const [caret, setCaret] = useState(0);

  const mention = mentionQueryAt(value, caret);
  const suggestions = mention ? matchMentions(people, mention.query) : [];

  function onSelectionChange(event: { nativeEvent: TextInputSelectionChangeEventData }) {
    setCaret(event.nativeEvent.selection.end);
  }

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1 }} />
        {(['Write', 'Preview'] as const).map((mode, index) => {
          const active = preview === (index === 1);
          return (
            <Pressable
              key={mode}
              accessibilityRole="button"
              accessibilityLabel={mode}
              accessibilityState={active ? { selected: true } : {}}
              onPress={() => setPreview(index === 1)}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: t.radius.pill,
                backgroundColor: active ? t.line.navActive : 'transparent',
              }}
            >
              <AppText
                variant="hint"
                style={{
                  color: active ? t.brand[600] : t.neutral[400],
                  fontWeight: '600',
                }}
              >
                {mode}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {preview ? (
        <View
          style={{
            minHeight,
            padding: 12,
            borderRadius: t.radius.control,
            borderWidth: 1,
            borderColor: t.line.field,
            backgroundColor: t.surface.card,
          }}
        >
          {value.trim() ? (
            // Read-only: ticking a box in a draft would have nowhere to write.
            <MarkdownBody source={value} people={people} />
          ) : (
            <AppText variant="hint">Nothing to preview yet.</AppText>
          )}
        </View>
      ) : (
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          onSelectionChange={onSelectionChange}
          placeholder={placeholder}
          placeholderTextColor={t.neutral[300]}
          multiline
          autoFocus={autoFocus}
          style={{
            minHeight,
            padding: 12,
            borderRadius: t.radius.control,
            borderWidth: 1,
            borderColor: t.line.field,
            backgroundColor: t.surface.card,
            color: t.neutral[900],
            fontSize: 15,
            textAlignVertical: 'top',
          }}
        />
      )}

      {!preview && mention && suggestions.length > 0 ? (
        <View
          style={{
            borderRadius: t.radius.control,
            borderWidth: 1,
            borderColor: t.line.hairline,
            backgroundColor: t.surface.menu,
            overflow: 'hidden',
          }}
        >
          {suggestions.map((person) => (
            <Pressable
              key={person.id}
              accessibilityRole="button"
              accessibilityLabel={`Mention ${person.username}`}
              onPress={() => {
                const next = applyMention(
                  value,
                  mention.start,
                  mention.query.length,
                  person.username,
                );
                onChangeText(next.text);
                setCaret(next.caret);
              }}
              style={{ paddingVertical: 10, paddingHorizontal: 12 }}
            >
              <AppText variant="body" style={{ fontSize: 14 }}>
                {person.full_name}{' '}
                <AppText variant="hint">@{person.username}</AppText>
              </AppText>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
