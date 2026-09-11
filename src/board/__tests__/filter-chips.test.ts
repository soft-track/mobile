import { buildChips } from '@/board/filter-chips';
import { NO_FILTERS } from '@/board/filters';

const DATA = {
  statuses: [{ id: 1, team_id: 1, name: 'Todo', category: 'unstarted' as const, position: 1, color: '#000' }],
  labels: [{ id: 2, team_id: 1, name: 'bug', color: '#f00' }],
  projects: [{ id: 3, team_id: 1, name: 'Platform' }],
  cycles: [{ id: 4, display_name: 'Cycle 14' }],
  members: [{ user: { id: 5, username: 'ada', full_name: 'Ada Lovelace', avatar_color: '#000' } }],
} as never as Parameters<typeof buildChips>[1];

describe('buildChips', () => {
  it('says nothing when nothing narrows the board', () => {
    expect(buildChips(NO_FILTERS, DATA, jest.fn())).toEqual([]);
  });

  it('names the dimension as well as the value', () => {
    // With six possible filters the value alone is ambiguous: "bug" could be a
    // label or a project.
    const chips = buildChips(
      { statusId: 1, priority: 'urgent', assignee: 5, labelId: 2, projectId: 3, cycleId: 4 },
      DATA,
      jest.fn(),
    );
    expect(chips.map((c) => c.label)).toEqual([
      'Status: Todo',
      'Priority: Urgent',
      'Assignee: Ada Lovelace',
      'Label: bug',
      'Project: Platform',
      'Cycle: Cycle 14',
    ]);
  });

  it('labels unassigned as an answer rather than an id', () => {
    const chips = buildChips({ ...NO_FILTERS, assignee: 'unassigned' }, DATA, jest.fn());
    expect(chips[0].label).toBe('Assignee: Unassigned');
  });

  it('stays removable when the row it names is gone', () => {
    // A link naming a label another team deleted still has to be clearable,
    // so the chip falls back to the id rather than vanishing.
    const onChange = jest.fn();
    const chips = buildChips({ ...NO_FILTERS, labelId: 999 }, DATA, onChange);
    expect(chips[0].label).toBe('Label: 999');

    chips[0].clear();
    expect(onChange).toHaveBeenCalledWith({ ...NO_FILTERS, labelId: null });
  });

  it('clears only the filter it belongs to', () => {
    const onChange = jest.fn();
    const filters = { ...NO_FILTERS, priority: 'high' as const, labelId: 2 };
    const chips = buildChips(filters, DATA, onChange);

    chips[0].clear();
    expect(onChange).toHaveBeenCalledWith({ ...filters, priority: null });
  });
});
