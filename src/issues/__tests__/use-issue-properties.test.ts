import { labelFor } from '@/issues/use-issue-properties';

const OPTIONS = [
  { value: 1, label: 'Todo', color: '#abc' },
  { value: 2, label: 'Done', color: '#def' },
];

describe('labelFor', () => {
  it('names the chosen value and carries its colour', () => {
    expect(labelFor(OPTIONS, 1, 'None')).toEqual({
      text: 'Todo',
      color: '#abc',
      muted: false,
    });
  });

  it('shows the empty label when nothing is chosen', () => {
    // "Unassigned" and "Not sized" are real states the API distinguishes, so
    // they read as values rather than as a blank row.
    expect(labelFor(OPTIONS, null, 'Unassigned')).toEqual({
      text: 'Unassigned',
      muted: true,
    });
  });

  it('still renders a value whose row the team has deleted', () => {
    // An issue can outlive the label or project it points at; the row has to
    // draw something rather than crash or vanish.
    expect(labelFor(OPTIONS, 99, 'None')).toEqual({ text: '99', muted: true });
  });
});
