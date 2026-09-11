import { describeRule } from '@/team/admin/automation-panel';

const LOOK = {
  status: (id: number) => (id === 1 ? 'In Progress' : 'a deleted status'),
  label: (id: number) => (id === 2 ? 'bug' : 'a deleted label'),
  project: (id: number) => (id === 3 ? 'Platform' : 'a deleted project'),
  member: (id: number) => (id === 4 ? 'Ada Lovelace' : 'a former member'),
  cycle: (id: number) => (id === 5 ? 'Cycle 14' : 'a deleted cycle'),
};

function rule(over: Record<string, unknown> = {}) {
  return {
    id: 1,
    team_id: 1,
    name: 'Rule',
    trigger: 'issue_created',
    is_enabled: true,
    conditions: {},
    actions: {},
    created_by: { id: 1, username: 'a', full_name: 'A', avatar_color: '#000' },
    created_at: '',
    updated_at: '',
    ...over,
  } as never as Parameters<typeof describeRule>[0];
}

describe('describeRule', () => {
  it('reads as a sentence rather than a grid of fields', () => {
    expect(
      describeRule(rule({ actions: { set_priority: 'high' } }), LOOK),
    ).toBe('When an issue is created, set its priority to High.');
  });

  it('joins conditions with "and"', () => {
    expect(
      describeRule(
        rule({
          trigger: 'status_changed',
          conditions: { if_status_id: 1, if_unassigned: true },
          actions: { set_assignee_id: 4 },
        }),
        LOOK,
      ),
    ).toBe(
      'When an issue changes status and it is in In Progress and it is unassigned, assign it to Ada Lovelace.',
    );
  });

  it('joins multiple actions', () => {
    expect(
      describeRule(
        rule({ actions: { add_label_id: 2, move_to_active_cycle: true } }),
        LOOK,
      ),
    ).toBe('When an issue is created, add the bug label, and move it into the active cycle.');
  });

  it('names a row the team has since deleted rather than printing undefined', () => {
    // A rule outlives the label it points at, and a sentence with "undefined"
    // in it is worse than one that says the label is gone.
    expect(describeRule(rule({ actions: { add_label_id: 99 } }), LOOK)).toContain(
      'a deleted label',
    );
  });

  it('says so when a rule does nothing', () => {
    expect(describeRule(rule(), LOOK)).toBe('When an issue is created, do nothing.');
  });
});
