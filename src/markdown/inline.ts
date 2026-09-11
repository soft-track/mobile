import { MENTION_PATTERN, type Mentionable, peopleByHandle } from '@/markdown/mentions';

/**
 * Splitting a run of plain text into the things that should become tappable.
 *
 * Done on `text` tokens only, never on the raw source: `` `@demo` `` and fenced
 * blocks parse to code tokens and never reach here, so a comment full of shell
 * snippets keeps them literal. That is the same property the web gets from
 * running this as a remark plugin rather than a string replacement.
 */

/**
 * `TEAMKEY-123`. Team keys are 2-6 uppercase letters (the backend uppercases
 * them and caps the length), and the boundary stops it matching inside a longer
 * token like a commit trailer or a hyphenated word.
 */
export const ISSUE_PATTERN = /(^|[^\w-])([A-Z][A-Z0-9]{1,5})-(\d+)\b/g;

export type Segment =
  | { kind: 'text'; text: string }
  | { kind: 'mention'; text: string; person: Mentionable }
  | { kind: 'issue'; text: string; identifier: string };

/**
 * Break `text` into plain runs, mentions of known people, and issue references.
 *
 * An `@handle` matching nobody on the team stays plain text, exactly as on the
 * web -- an unknown handle is far more likely to be an email fragment or a
 * shell variable than a person.
 */
export function segments(text: string, people: Mentionable[]): Segment[] {
  const byHandle = peopleByHandle(people);
  const found: { start: number; end: number; segment: Segment }[] = [];

  MENTION_PATTERN.lastIndex = 0;
  for (const match of text.matchAll(MENTION_PATTERN)) {
    const [whole, boundary, handle] = match;
    const person = byHandle.get(handle.toLowerCase());
    if (!person) continue;
    const start = (match.index ?? 0) + boundary.length;
    found.push({
      start,
      end: start + whole.length - boundary.length,
      segment: { kind: 'mention', text: `@${handle}`, person },
    });
  }

  ISSUE_PATTERN.lastIndex = 0;
  for (const match of text.matchAll(ISSUE_PATTERN)) {
    const [whole, boundary, key, number] = match;
    const start = (match.index ?? 0) + boundary.length;
    const end = start + whole.length - boundary.length;
    // A mention and an identifier cannot overlap in practice, but if they did
    // the mention was found first and wins.
    if (found.some((f) => start < f.end && end > f.start)) continue;
    found.push({
      start,
      end,
      segment: { kind: 'issue', text: `${key}-${number}`, identifier: `${key}-${number}` },
    });
  }

  if (found.length === 0) return [{ kind: 'text', text }];

  found.sort((a, b) => a.start - b.start);

  const out: Segment[] = [];
  let cursor = 0;
  for (const item of found) {
    if (item.start > cursor) {
      out.push({ kind: 'text', text: text.slice(cursor, item.start) });
    }
    out.push(item.segment);
    cursor = item.end;
  }
  if (cursor < text.length) out.push({ kind: 'text', text: text.slice(cursor) });
  return out;
}
