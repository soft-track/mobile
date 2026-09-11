import { useMemo, type ReactNode } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import Markdown, { MarkedLexer, Renderer, type RendererInterface } from 'react-native-marked';
import type { Token, Tokens } from 'marked';

import { segments } from '@/markdown/inline';
import type { Mentionable } from '@/markdown/mentions';
import { Icon } from '@/ui/icon';
import { AppText } from '@/ui/primitives';
import { useTokens } from '@/ui/theme';
import type { Tokens as ThemeTokens } from '@/ui/tokens';

/**
 * Markdown for descriptions and comments.
 *
 * GFM comes from `react-native-marked`, except for task lists, which it cannot
 * render: its parser drops marked's `task` and `checked` flags before the
 * renderer sees them, so a checklist would come out as bare bullets with no box.
 * So the source is lexed at block level here, task lists are drawn directly --
 * which is also what makes them tappable -- and every other block is handed
 * back to the library by its own `raw` text.
 */
export function MarkdownBody({
  source,
  people = [],
  onToggleTask,
  onOpenIssue,
}: {
  source: string;
  people?: Mentionable[];
  /** Omit to render checkboxes read-only, where the viewer cannot edit. */
  onToggleTask?: (index: number) => void;
  onOpenIssue?: (identifier: string) => void;
}) {
  const t = useTokens();

  /**
   * Blocks, each already carrying where its task numbering starts.
   *
   * Counted here rather than while mapping, because a counter mutated during
   * render is exactly what the compiler refuses -- and precomputing is clearer
   * anyway: the nth checkbox on screen is the nth marker in the source.
   */
  const blocks = useMemo(() => {
    let tokens: Token[];
    try {
      tokens = MarkedLexer(source ?? '', { gfm: true }) as Token[];
    } catch {
      // A body that will not lex still has to render as something.
      return [];
    }

    let seen = 0;
    return tokens.map((token) => {
      const taskStart = seen;
      if (token.type === 'list') {
        seen += (token as Tokens.List).items.filter((item) => item.task).length;
      }
      return { token, taskStart };
    });
  }, [source]);

  const renderer = useMemo(
    () => new SoftTrackRenderer(t, people, onOpenIssue),
    [t, people, onOpenIssue],
  );

  if (blocks.length === 0) {
    return source ? <AppText variant="body">{source}</AppText> : null;
  }

  return (
    <View style={{ gap: 4 }}>
      {blocks.map(({ token, taskStart }, index) => {
        if (token.type === 'space') return null;

        const list = token as Tokens.List;
        if (token.type === 'list' && list.items.some((item) => item.task)) {
          return (
            <TaskList
              key={index}
              items={list.items}
              startIndex={taskStart}
              people={people}
              onToggleTask={onToggleTask}
              onOpenIssue={onOpenIssue}
            />
          );
        }

        return (
          <Markdown
            key={index}
            value={token.raw}
            renderer={renderer}
            flatListProps={{ scrollEnabled: false, initialNumToRender: 20 }}
          />
        );
      })}
    </View>
  );
}

function TaskList({
  items,
  startIndex,
  people,
  onToggleTask,
  onOpenIssue,
}: {
  items: Tokens.ListItem[];
  startIndex: number;
  people: Mentionable[];
  onToggleTask?: (index: number) => void;
  onOpenIssue?: (identifier: string) => void;
}) {
  const t = useTokens();
  // Only task items are numbered, so a plain item between two tasks must not
  // consume an index. Precomputed for the same reason as above.
  const indices: number[] = [];
  let offset = startIndex;
  for (const item of items) indices.push(item.task === true ? offset++ : -1);

  return (
    <View style={{ gap: 6, paddingVertical: 4 }}>
      {items.map((item, index) => {
        const isTask = item.task === true;
        const taskIndex = indices[index];

        return (
          <Pressable
            key={index}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: item.checked === true }}
            accessibilityLabel={item.text}
            disabled={!isTask || !onToggleTask}
            onPress={() => onToggleTask?.(taskIndex)}
            style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}
          >
            <View
              style={{
                width: 18,
                height: 18,
                marginTop: 1,
                borderRadius: 5,
                borderWidth: 1.5,
                borderColor: item.checked ? t.brand[600] : t.line.field,
                backgroundColor: item.checked ? t.brand[600] : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {item.checked ? <Icon name="check" size={12} color="#ffffff" strokeWidth={3} /> : null}
            </View>
            <AppText
              variant="body"
              style={{
                flex: 1,
                fontSize: 14,
                color: item.checked ? t.neutral[400] : t.neutral[900],
                textDecorationLine: item.checked ? 'line-through' : 'none',
              }}
            >
              <InlineText text={item.text} people={people} onOpenIssue={onOpenIssue} />
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Plain text with mentions and issue identifiers made tappable. */
function InlineText({
  text,
  people,
  onOpenIssue,
  style,
}: {
  text: string;
  people: Mentionable[];
  onOpenIssue?: (identifier: string) => void;
  style?: object;
}) {
  const t = useTokens();
  const parts = segments(text, people);

  return (
    <>
      {parts.map((part, index) => {
        if (part.kind === 'text') {
          return (
            <Text key={index} style={style}>
              {part.text}
            </Text>
          );
        }
        if (part.kind === 'mention') {
          return (
            <Text key={index} style={[style, { color: t.brand[600], fontWeight: '600' }]}>
              {part.text}
            </Text>
          );
        }
        return (
          <Text
            key={index}
            accessibilityRole="link"
            onPress={() => onOpenIssue?.(part.identifier)}
            style={[style, { color: t.brand[600], fontWeight: '600' }]}
          >
            {part.text}
          </Text>
        );
      })}
    </>
  );
}

/**
 * The library's renderer, themed and with inline text routed through the
 * mention/identifier pass.
 */
class SoftTrackRenderer extends Renderer implements RendererInterface {
  constructor(
    private readonly tokens: ThemeTokens,
    private readonly people: Mentionable[],
    private readonly onOpenIssue?: (identifier: string) => void,
  ) {
    super();
  }

  text(text: string | ReactNode[], styles?: object): ReactNode {
    if (typeof text !== 'string') return super.text(text, styles);
    return (
      <Text key={this.getKey()} style={styles}>
        <InlineText
          text={text}
          people={this.people}
          onOpenIssue={this.onOpenIssue}
          style={styles}
        />
      </Text>
    );
  }

  link(children: string | ReactNode[], href: string, styles?: object): ReactNode {
    return (
      <Text
        key={this.getKey()}
        accessibilityRole="link"
        accessibilityLabel={typeof children === 'string' ? children : href}
        onPress={() => void Linking.openURL(href)}
        style={[styles, { color: this.tokens.brand[600] }]}
      >
        {children}
      </Text>
    );
  }

}
