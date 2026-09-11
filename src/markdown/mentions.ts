/**
 * `@` mentions of team members.
 *
 * A port of `frontend/src/markdown/mentions.ts`. The handle is the user's own
 * `username` column, so a mention keeps pointing at the same person after they
 * change their email address. Usernames are unique instance-wide and validated
 * against the same character class as MENTION_PATTERN.
 */
export type Mentionable = {
  id: number;
  full_name: string;
  username: string;
};

/** Reverse lookup for the renderer. */
export function peopleByHandle(people: Mentionable[]): Map<string, Mentionable> {
  return new Map(people.map((person) => [person.username.toLowerCase(), person]));
}

/**
 * Matches `@handle` where a mention can plausibly start.
 *
 * The leading boundary stops `user@example.com` in prose from being read as a
 * mention of `@example.com`.
 */
export const MENTION_PATTERN = /(^|[^\w@/])@([a-z0-9][a-z0-9._-]*)/gi;

/** People whose handle or name matches what has been typed after the `@`. */
export function matchMentions(
  people: Mentionable[],
  query: string,
  limit = 6,
): Mentionable[] {
  const needle = query.toLowerCase();
  return people
    .filter(
      (person) =>
        !needle ||
        person.username.toLowerCase().includes(needle) ||
        person.full_name.toLowerCase().includes(needle),
    )
    .slice(0, limit);
}

/** The `@query` being typed immediately before the caret, if any. */
export function mentionQueryAt(
  value: string,
  caret: number,
): { query: string; start: number } | null {
  const upToCaret = value.slice(0, caret);
  // An `@` starting a word, followed by no whitespace. Bailing out on the
  // second `@` of an email address keeps the menu closed while someone is
  // simply typing an address into a comment.
  const match = /(^|[^\w@/])@([a-z0-9._@-]*)$/i.exec(upToCaret);
  if (!match) return null;
  return { query: match[2], start: caret - match[2].length - 1 };
}

/** Replace the `@query` at `start` with a handle, leaving a trailing space. */
export function applyMention(
  value: string,
  start: number,
  queryLength: number,
  handle: string,
): { text: string; caret: number } {
  const before = value.slice(0, start);
  const after = value.slice(start + queryLength + 1);
  const inserted = `@${handle} `;
  return { text: `${before}${inserted}${after}`, caret: before.length + inserted.length };
}
