/**
 * Toggling a task-list checkbox writes back to the markdown source.
 *
 * A port of `frontend/src/markdown/tasks.ts`, keyed by the checkbox's index in
 * the document rather than by a source offset: the web's renderer carries hast
 * positions, and React Native's does not. Order is the same either way, because
 * markdown renders in source order.
 *
 * The edit stays surgical for the same reason it does on the web -- round
 * tripping markdown through a parser normalises things the author chose on
 * purpose (bullet characters, indentation, hard breaks, trailing spaces).
 * Editing the source in place leaves every byte where it was except the one
 * character being toggled.
 */

/** Anchored on the list bullet, so a literal "[x]" in prose is never a task. */
const TASK_MARKER = /^([ \t]*(?:[-*+]|\d+[.)])[ \t]+)\[([ xX])\]/gm;

/** Whether `source` contains at least one task-list item. */
export function hasTaskList(source: string): boolean {
  TASK_MARKER.lastIndex = 0;
  return TASK_MARKER.test(source);
}

/** `{done, total}` for the task lists in `source`, for a progress summary. */
export function taskProgress(source: string): { done: number; total: number } {
  let done = 0;
  let total = 0;
  TASK_MARKER.lastIndex = 0;
  for (const match of source.matchAll(TASK_MARKER)) {
    total += 1;
    if (match[2] !== ' ') done += 1;
  }
  return { done, total };
}

/**
 * `source` with the nth task checkbox flipped, or `null` when there is no such
 * checkbox -- in which case the caller should do nothing rather than write a
 * guess back to the server.
 */
export function toggleTaskAtIndex(source: string, index: number): string | null {
  if (index < 0) return null;

  let seen = 0;
  TASK_MARKER.lastIndex = 0;
  for (const match of source.matchAll(TASK_MARKER)) {
    if (seen === index) {
      const markerStart = (match.index ?? 0) + match[1].length;
      const next = match[2] === ' ' ? 'x' : ' ';
      // markerStart points at "[", so the state is the character after it.
      return source.slice(0, markerStart + 1) + next + source.slice(markerStart + 2);
    }
    seen += 1;
  }
  return null;
}
