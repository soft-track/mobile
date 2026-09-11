import { hasTaskList, taskProgress, toggleTaskAtIndex } from '@/markdown/tasks';

const DOC = `# Plan

- [ ] first
- [x] second
- [ ] third

Some prose with a literal [x] that is not a task.

1. [ ] numbered task
`;

describe('toggleTaskAtIndex', () => {
  it('ticks the nth box and leaves every other byte alone', () => {
    const next = toggleTaskAtIndex(DOC, 0)!;
    expect(next).toContain('- [x] first');
    // The surgical-edit property: nothing else moves, including the prose the
    // author chose and the literal [x] that is not a task.
    expect(next.replace('- [x] first', '- [ ] first')).toBe(DOC);
  });

  it('unticks a ticked box', () => {
    expect(toggleTaskAtIndex(DOC, 1)).toContain('- [ ] second');
  });

  it('counts ordered-list tasks in the same sequence', () => {
    const next = toggleTaskAtIndex(DOC, 3)!;
    expect(next).toContain('1. [x] numbered task');
  });

  it('never mistakes a literal marker in prose for a task', () => {
    // Four markers, not five -- the "[x]" in the sentence is not one.
    expect(taskProgress(DOC)).toEqual({ done: 1, total: 4 });
    expect(toggleTaskAtIndex(DOC, 4)).toBeNull();
  });

  it('does nothing when there is no such checkbox', () => {
    // Writing a guess back to the server would be worse than ignoring the tap.
    expect(toggleTaskAtIndex(DOC, 99)).toBeNull();
    expect(toggleTaskAtIndex(DOC, -1)).toBeNull();
    expect(toggleTaskAtIndex('no tasks here', 0)).toBeNull();
  });
});

describe('hasTaskList', () => {
  it('is true only for real task items', () => {
    expect(hasTaskList(DOC)).toBe(true);
    expect(hasTaskList('- a plain bullet')).toBe(false);
    expect(hasTaskList('a line with [x] in it')).toBe(false);
  });
});
